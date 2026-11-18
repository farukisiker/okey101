import { describe, expect, it, vi } from 'vitest';
import { type LkModule, type LkParticipant, type LkRoom, type TokenReply, VoiceController } from '../src/net/voice';

const OK: TokenReply = { ok: true, url: 'wss://lk.test', token: 'jwt', room: 'ABCDE', identity: 's1-abc' };

type Remote = LkParticipant & { volume: number };

function mock(opts: { connectFails?: boolean; micFails?: boolean } = {}) {
  const handlers: Record<string, (...a: unknown[]) => void> = {};
  const remotes = new Map<string, Remote>();
  const log: string[] = [];
  const room: LkRoom = {
    remoteParticipants: remotes,
    localParticipant: {
      setMicrophoneEnabled: async (on) => {
        if (opts.micFails && on) throw new Error('NotAllowedError');
        log.push(`mic:${on}`);
      },
    },
    connect: async (url, token) => {
      log.push(`connect:${url}:${token}`);
      if (opts.connectFails) throw new Error('boom');
    },
    disconnect: () => void log.push('disconnect'),
    on: (ev, cb) => void (handlers[ev] = cb as (...a: unknown[]) => void),
  };
  const lk: LkModule = {
    createRoom: () => {
      log.push('createRoom');
      return room;
    },
    events: { activeSpeakers: 'speakers', participantConnected: 'joined', disconnected: 'gone' },
    startAudio: async () => void log.push('audio:start'),
    stopAudio: async () => void log.push('audio:stop'),
  };
  const addRemote = (identity: string): Remote => {
    const p: Remote = {
      identity,
      volume: 1,
      setVolume(v: number) {
        p.volume = v;
      },
    };
    remotes.set(identity, p);
    return p;
  };
  return { lk, log, handlers, addRemote };
}

describe('VoiceController', () => {
  it('is unavailable and does nothing without the native module', async () => {
    const fetchToken = vi.fn();
    const v = new VoiceController({ lk: null, fetchToken });
    expect(v.available).toBe(false);
    expect(v.snapshot.status).toBe('unavailable');
    await v.join();
    await v.toggleMic();
    expect(fetchToken).not.toHaveBeenCalled();
    expect(v.snapshot.status).toBe('unavailable');
  });

  it('joins with the microphone off: token, audio session, room', async () => {
    const m = mock();
    const v = new VoiceController({ lk: m.lk, fetchToken: async () => OK });
    const states: string[] = [];
    v.subscribe((s) => states.push(s.status));
    await v.join();
    expect(states).toEqual(['connecting', 'connected']);
    expect(v.snapshot).toMatchObject({ status: 'connected', micOn: false, error: null });
    expect(m.log).toEqual(['audio:start', 'createRoom', 'connect:wss://lk.test:jwt']);
  });

  it('turns the microphone on and off with one tap each', async () => {
    const m = mock();
    const v = new VoiceController({ lk: m.lk, fetchToken: async () => OK });
    await v.join();
    await v.toggleMic();
    expect(v.snapshot.micOn).toBe(true);
    await v.toggleMic();
    expect(v.snapshot.micOn).toBe(false);
    expect(m.log.filter((l) => l.startsWith('mic:'))).toEqual(['mic:true', 'mic:false']);
  });

  it('joins first when the mic is tapped before the room is connected', async () => {
    const v = new VoiceController({ lk: mock().lk, fetchToken: async () => OK });
    await v.toggleMic();
    expect(v.snapshot).toMatchObject({ status: 'connected', micOn: true });
  });

  it('maps server refusals to failed + the error code', async () => {
    for (const error of ['voice_off', 'not_seated', 'not_configured'] as const) {
      const v = new VoiceController({ lk: mock().lk, fetchToken: async () => ({ ok: false, error }) });
      await v.join();
      expect(v.snapshot).toMatchObject({ status: 'failed', error, micOn: false });
    }
  });

  it('a connection error or a token request that throws is "connect"; join can be retried', async () => {
    const m = mock({ connectFails: true });
    const v = new VoiceController({ lk: m.lk, fetchToken: async () => OK });
    await v.join();
    expect(v.snapshot).toMatchObject({ status: 'failed', error: 'connect' });
    expect(m.log).toContain('disconnect');

    const v2 = new VoiceController({
      lk: mock().lk,
      fetchToken: async () => {
        throw new Error('no socket');
      },
    });
    await v2.join();
    expect(v2.snapshot).toMatchObject({ status: 'failed', error: 'connect' });

    let first = true;
    const v3 = new VoiceController({
      lk: mock().lk,
      fetchToken: async (): Promise<TokenReply> => {
        if (!first) return OK;
        first = false;
        return { ok: false, error: 'not_configured' };
      },
    });
    await v3.join();
    expect(v3.snapshot.status).toBe('failed');
    await v3.join();
    expect(v3.snapshot.status).toBe('connected');
  });

  it('a refused microphone permission leaves the mic off and says so', async () => {
    const v = new VoiceController({ lk: mock({ micFails: true }).lk, fetchToken: async () => OK });
    await v.toggleMic();
    expect(v.snapshot).toMatchObject({ status: 'connected', micOn: false, error: 'permission' });
  });

  it('a reported player (banned) cannot open the microphone, and an open one is closed', async () => {
    const now = 1_000_000;
    const v = new VoiceController({ lk: mock().lk, fetchToken: async () => OK, now: () => now });
    await v.join();
    await v.toggleMic();
    expect(v.snapshot.micOn).toBe(true);
    v.setBannedUntil(now + 3_600_000);
    await new Promise((r) => setTimeout(r, 0));
    expect(v.snapshot.micOn).toBe(false);
    await v.toggleMic();
    expect(v.snapshot).toMatchObject({ micOn: false, error: 'banned' });
    v.setBannedUntil(now - 1);
    expect(v.isBanned()).toBe(false);
  });

  it('E2b: a server answer of banned shows the 24 h closed state and leaves the mic off', async () => {
    const v = new VoiceController({ lk: mock().lk, fetchToken: async () => ({ ok: false, error: 'banned' }) as unknown as TokenReply });
    await v.join();
    expect(v.snapshot).toMatchObject({ status: 'failed', micOn: false, error: 'banned' });
  });

  it('silences chosen seats at once and for people who join later', async () => {
    const m = mock();
    const v = new VoiceController({ lk: m.lk, fetchToken: async () => OK });
    const ali = m.addRemote('s2-aaa');
    const veli = m.addRemote('s3-bbb');
    await v.join();
    v.setSilenced(new Set([2]));
    expect([ali.volume, veli.volume]).toEqual([0, 1]);
    const late = m.addRemote('s2-ccc'); // the same seat reconnects with a new identity
    m.handlers.joined();
    expect(late.volume).toBe(0);
    v.setSilenced(new Set());
    expect([ali.volume, late.volume]).toEqual([1, 1]);
  });

  it('shows who is speaking and leaves silenced people out', async () => {
    const m = mock();
    const v = new VoiceController({ lk: m.lk, fetchToken: async () => OK });
    await v.join();
    v.setSilenced(new Set([3]));
    m.handlers.speakers([{ identity: 's2-a' }, { identity: 's3-b' }, { identity: 's1-me' }]);
    expect(v.snapshot.speaking).toEqual([2, 1]);
  });

  it('leaving closes the mic, the room and the audio session; a late token after leave connects nothing', async () => {
    const m = mock();
    const v = new VoiceController({ lk: m.lk, fetchToken: async () => OK });
    await v.join();
    await v.toggleMic();
    await v.leave();
    expect(v.snapshot).toMatchObject({ status: 'idle', micOn: false, speaking: [] });
    expect(m.log.slice(-3)).toEqual(['mic:false', 'disconnect', 'audio:stop']);

    const slow = mock();
    let release: (r: TokenReply) => void = () => {};
    const v2 = new VoiceController({ lk: slow.lk, fetchToken: () => new Promise<TokenReply>((r) => (release = r)) });
    const joining = v2.join();
    await v2.leave();
    release(OK);
    await joining;
    expect(v2.snapshot.status).toBe('idle');
    expect(slow.log).not.toContain('createRoom');
  });

  it('goes back to idle when the server drops the connection', async () => {
    const m = mock();
    const v = new VoiceController({ lk: m.lk, fetchToken: async () => OK });
    await v.join();
    await v.toggleMic();
    m.handlers.gone();
    expect(v.snapshot).toMatchObject({ status: 'idle', micOn: false });
  });
});
