// E2 (Claude Sonnet): the voice table. A small state machine around a LiveKit room, audio only.
//   - The microphone is OFF when you join; the person turns it on and off with one tap.
//   - Audio mode is "talking" (echo cancellation on, phone-call audio route), nothing is recorded.
//   - Each other person can be silenced on this device (setSilenced); a blocked or muted person is never heard.
//   - Without the native module (Expo Go, tests, a build made before the plugins) loadLiveKit() gives null and
//     the controller reports 'unavailable': the screens hide every voice control.
// The controller only knows the tiny LkModule interface below; loadLiveKit() fills it from the real libraries,
// and the tests fill it with a mock. No React here.
import type { VoiceTokenResult } from '@okey/shared';
import { seatOfIdentity } from './social';

// ---- what we need from LiveKit ----
export interface LkParticipant {
  identity: string;
  setVolume(volume: number): void;
}
export interface LkRoom {
  remoteParticipants: Map<string, LkParticipant>;
  localParticipant: { setMicrophoneEnabled(on: boolean): Promise<unknown> };
  connect(url: string, token: string): Promise<unknown>;
  disconnect(): Promise<unknown> | void;
  on(event: string, cb: (...args: never[]) => void): unknown;
}
export interface LkModule {
  createRoom(): LkRoom;
  events: { activeSpeakers: string; participantConnected: string; disconnected: string };
  startAudio(): Promise<void>;
  stopAudio(): Promise<void>;
}

/**
 * The real LiveKit, or null when the native module is not in this build.
 * `@livekit/react-native-webrtc` throws on import without its native code, which is what we catch.
 */
export function loadLiveKit(): LkModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const rn = require('@livekit/react-native') as typeof import('@livekit/react-native');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const lk = require('livekit-client') as typeof import('livekit-client');
    rn.registerGlobals();
    const { AudioSession, AndroidAudioTypePresets } = rn;
    return {
      createRoom: () =>
        new lk.Room({
          adaptiveStream: false,
          dynacast: false,
          audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        }) as unknown as LkRoom,
      events: {
        activeSpeakers: lk.RoomEvent.ActiveSpeakersChanged,
        participantConnected: lk.RoomEvent.ParticipantConnected,
        disconnected: lk.RoomEvent.Disconnected,
      },
      async startAudio() {
        await AudioSession.configureAudio({
          android: { preferredOutputList: ['speaker', 'headset', 'bluetooth'], audioTypeOptions: AndroidAudioTypePresets.communication },
          ios: { defaultOutput: 'speaker' },
        });
        await AudioSession.setAppleAudioConfiguration({
          audioCategory: 'playAndRecord',
          audioCategoryOptions: ['allowBluetooth', 'defaultToSpeaker'],
          audioMode: 'voiceChat',
        });
        await AudioSession.startAudioSession();
      },
      async stopAudio() {
        await AudioSession.stopAudioSession();
      },
    };
  } catch {
    return null;
  }
}

// ---- the controller ----
export type VoiceStatus = 'unavailable' | 'idle' | 'connecting' | 'connected' | 'failed';
export type VoiceError = 'voice_off' | 'not_seated' | 'not_configured' | 'connect' | 'permission' | 'banned';

export type TokenReply = VoiceTokenResult;

export interface VoiceSnapshot {
  status: VoiceStatus;
  micOn: boolean;
  /** Seats heard speaking right now (including mine). */
  speaking: readonly number[];
  error: VoiceError | null;
  /** Epoch ms until which my own microphone is closed by reports; 0 = open. */
  bannedUntil: number;
}

export interface VoiceDeps {
  lk: LkModule | null;
  /** `voice:token` over the table socket. A thrown error counts as 'connect'. */
  fetchToken(): Promise<TokenReply>;
  now?(): number;
}

export class VoiceController {
  private room: LkRoom | null = null;
  private gen = 0;
  private silenced: ReadonlySet<number> = new Set();
  private listeners = new Set<(s: VoiceSnapshot) => void>();
  private snap: VoiceSnapshot;
  private busy = false;
  /** Identity of my own seat, so "speaking" can include me. */
  private mySeat: number | null = null;

  constructor(private deps: VoiceDeps) {
    this.snap = { status: deps.lk ? 'idle' : 'unavailable', micOn: false, speaking: [], error: null, bannedUntil: 0 };
  }

  get snapshot(): VoiceSnapshot {
    return this.snap;
  }

  get available(): boolean {
    return this.deps.lk !== null;
  }

  subscribe(fn: (s: VoiceSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /** From Me.voiceBannedUntil. While it lies in the future my microphone cannot be switched on. */
  setBannedUntil(until: number | null | undefined) {
    this.set({ bannedUntil: until && until > 0 ? until : 0 });
    if (this.isBanned() && this.snap.micOn) void this.setMic(false);
  }

  isBanned(): boolean {
    return this.snap.bannedUntil > (this.deps.now?.() ?? Date.now());
  }

  /** Which seats I will not hear (muted by hand or blocked). Applies at once and to people who join later. */
  setSilenced(seats: ReadonlySet<number>) {
    this.silenced = seats;
    this.applyVolumes();
  }

  /** Connects with the microphone OFF. Does nothing when already connecting or connected. */
  async join(): Promise<void> {
    const lk = this.deps.lk;
    if (!lk || this.snap.status === 'connecting' || this.snap.status === 'connected') return;
    const gen = ++this.gen;
    this.set({ status: 'connecting', error: null, micOn: false, speaking: [] });
    let room: LkRoom | null = null;
    try {
      const reply = await this.deps.fetchToken();
      if (gen !== this.gen) return;
      if (!reply.ok) return this.fail(reply.error);
      this.mySeat = seatOfIdentity(reply.identity);
      await lk.startAudio();
      if (gen !== this.gen) return void lk.stopAudio().catch(() => {});
      room = lk.createRoom();
      room.on(lk.events.activeSpeakers, ((speakers: { identity: string }[]) => {
        if (this.room !== room) return;
        const seats = speakers.map((p) => seatOfIdentity(p.identity)).filter((n): n is number => n !== null && !this.silenced.has(n));
        this.set({ speaking: seats });
      }) as never);
      room.on(lk.events.participantConnected, (() => this.applyVolumes()) as never);
      room.on(lk.events.disconnected, (() => {
        if (this.room !== room) return;
        this.room = null;
        void lk.stopAudio().catch(() => {});
        this.set({ status: 'idle', micOn: false, speaking: [] });
      }) as never);
      this.room = room;
      await room.connect(reply.url, reply.token);
      if (gen !== this.gen) {
        await this.closeRoom(room);
        return;
      }
      this.set({ status: 'connected' });
      this.applyVolumes();
    } catch {
      if (gen !== this.gen) return;
      if (room && this.room === room) await this.closeRoom(room);
      this.fail('connect');
    }
  }

  /** One tap: microphone on or off. Joins first when not connected (the mic then starts on, the person asked for it). */
  async toggleMic(): Promise<void> {
    if (this.busy) return;
    if (this.snap.micOn) return this.setMic(false);
    if (this.isBanned()) return this.set({ error: 'banned' });
    this.busy = true;
    try {
      if (this.snap.status !== 'connected') await this.join();
      if (this.snap.status === 'connected') await this.setMic(true);
    } finally {
      this.busy = false;
    }
  }

  private async setMic(on: boolean): Promise<void> {
    const room = this.room;
    if (!room) return;
    if (on && this.isBanned()) return this.set({ error: 'banned' });
    try {
      await room.localParticipant.setMicrophoneEnabled(on);
      this.set({ micOn: on, error: null });
    } catch {
      // The phone refused the microphone (permission denied) or the device has none.
      this.set({ micOn: false, error: on ? 'permission' : 'connect' });
    }
  }

  /** Leaves the voice room (leaving the table, or the screen closing). Safe to call at any time. */
  async leave(): Promise<void> {
    this.gen++;
    const room = this.room;
    this.room = null;
    this.mySeat = null;
    if (this.snap.status !== 'unavailable') this.set({ status: 'idle', micOn: false, speaking: [], error: null });
    if (room) {
      try {
        await room.localParticipant.setMicrophoneEnabled(false);
      } catch {
        // already gone
      }
      await this.closeRoom(room, false);
    }
  }

  private async closeRoom(room: LkRoom, resetRoom = true) {
    if (resetRoom && this.room === room) this.room = null;
    try {
      await room.disconnect();
    } catch {
      // closing anyway
    }
    await this.deps.lk?.stopAudio().catch(() => {});
  }

  private fail(error: VoiceError) {
    this.set({ status: 'failed', micOn: false, speaking: [], error });
  }

  private applyVolumes() {
    if (!this.room) return;
    for (const p of this.room.remoteParticipants.values()) {
      const seat = seatOfIdentity(p.identity);
      p.setVolume(seat !== null && this.silenced.has(seat) ? 0 : 1);
    }
  }

  private set(patch: Partial<VoiceSnapshot>) {
    this.snap = { ...this.snap, ...patch };
    for (const fn of this.listeners) fn(this.snap);
  }
}
