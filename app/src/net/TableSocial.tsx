// E2 (Claude Sonnet): the table's social state (ready sayings, voice, mute/block/report) for every card and board game.
// App.tsx wraps the screens in <TableSocialProvider client={kahve}>; GameShell reads useTableSocial() and draws the controls.
// Outside an online table (offline bots, okey, previews) there is no provider value and nothing is drawn.
import { type ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AccountsError, type ReportContext, type ReportReason } from './accountsClient';
import { accounts, accountsEnabled } from './accounts';
import { blockList } from './blockStore';
import {
  type Bubble,
  type QuickEmoji,
  type QuickSaying,
  type SaidMsg,
  type TableSeat,
  addBubble,
  cooldownLeft,
  liveBubbles,
  occupantKey,
  otherPeople,
  silencedSeats,
  blockedSeats,
  tableSeats,
  withoutSeats,
  SAY_COOLDOWN_MS,
} from './social';
import { type LkModule, type VoiceSnapshot, VoiceController, loadLiveKit } from './voice';
import type { RoomInfo } from '@okey/shared';
import type { Result } from './tableClient';
import type { SayMsg } from './social';
import type { TokenReply } from './voice';
import { type Key, t } from '../i18n';

const EXPLAINED_KEY = 'kahve.voice.explained';

export interface TableSocialValue {
  mySeat: number;
  /** The other people at the table (no bots). Empty: nobody to talk to, the controls stay hidden. */
  others: TableSeat[];
  bubbles: Bubble[];
  nameOf(seat: number): string;
  /** Seats I blocked / muted by hand (both are silent and have no bubbles). */
  blocked: ReadonlySet<number>;
  muted: ReadonlySet<number>;
  /** The table is a voice table and this build has the native module. */
  voiceOn: boolean;
  voice: VoiceSnapshot;
  /** True once the person has seen the permission explanation. */
  explained: boolean;
  markExplained(): void;
  toggleMic(): void;
  sayWaitMs: number;
  say(msg: { saying: QuickSaying } | { emoji: QuickEmoji }): Promise<string | null>;
  toggleMute(seat: number): void;
  block(seat: number): Promise<string>;
  unblock(seat: number): Promise<string>;
  /** Returns the text to show: success or the reason it did not work. */
  report(seat: number, reason: ReportReason, context?: ReportContext): Promise<string>;
  /** Seats whose bubble is drawn next to their own chip (SeatBubble); the corner stack skips them. */
  anchored: ReadonlySet<number>;
  /** SeatBubble registers its seat on mount; returns the unregister function. */
  anchor(seat: number): () => void;
}

const Ctx = createContext<TableSocialValue | null>(null);
export const useTableSocial = () => useContext(Ctx);

let lkCache: LkModule | null | undefined;
const getLk = () => (lkCache === undefined ? (lkCache = loadLiveKit()) : lkCache);
/** False in Expo Go and in builds without the LiveKit native modules: every voice control stays hidden. */
export const voiceAvailable = (): boolean => getLk() !== null;

const IDLE_VOICE: VoiceSnapshot = { status: 'unavailable', micOn: false, speaking: [], error: null, bannedUntil: 0 };

/**
 * What the provider needs from a connection. The card/board client (useKahveGame) fits it as it is; the okey
 * client is wrapped by App (E2c). `fetchVoiceToken` missing = no voice at that table (okey: sayings only).
 */
export interface SocialClient {
  mode: 'online' | 'offline' | null;
  room: RoomInfo | null;
  session: unknown;
  seat: number;
  say(msg: SayMsg): Promise<Result>;
  subscribeSaid(fn: (m: SaidMsg) => void): () => void;
  fetchVoiceToken?: () => Promise<TokenReply>;
}

export function TableSocialProvider({ client, children }: { client: SocialClient; children: ReactNode }) {
  const online = client.mode === 'online' && client.room !== null && client.session !== null;
  const room = online ? client.room : null;
  const mySeat = client.seat;
  const roomVoice = room?.voice === true;
  const started = room?.started === true;

  const seats = useMemo(() => tableSeats(room), [room]);
  const others = useMemo(() => otherPeople(seats, mySeat), [seats, mySeat]);

  // ---- block list (device + server) ----
  const [blockedIds, setBlockedIds] = useState<ReadonlySet<string>>(() => blockList.snapshot);
  useEffect(() => {
    const off = blockList.subscribe(setBlockedIds);
    void blockList.load();
    return off;
  }, []);
  const blocked = useMemo(() => blockedSeats(seats, blockedIds), [seats, blockedIds]);

  // ---- hand mutes (per person, session only) ----
  const [mutedKeys, setMutedKeys] = useState<ReadonlySet<string>>(new Set());
  const silenced = useMemo(() => silencedSeats(seats, mutedKeys, blockedIds), [seats, mutedKeys, blockedIds]);
  const muted = useMemo(() => {
    const out = new Set<number>();
    for (const s of seats) if (mutedKeys.has(occupantKey(s))) out.add(s.seat);
    return out;
  }, [seats, mutedKeys]);
  useEffect(() => {
    if (!online) setMutedKeys(new Set());
  }, [online]);

  // ---- bubbles ----
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const nextId = useRef(1);
  const silencedRef = useRef(silenced);
  silencedRef.current = silenced;
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;
  useEffect(() => {
    if (!online) return;
    return client.subscribeSaid((m: SaidMsg) => {
      // My own saying shows too: the server echoes it, and seeing it is the confirmation that it went out.
      setBubbles((list) => addBubble(list, m, Date.now(), blockedRef.current, nextId.current++));
    });
  }, [online, client, mySeat]);
  useEffect(() => {
    if (blocked.size) setBubbles((list) => withoutSeats(list, blocked));
  }, [blocked]);
  useEffect(() => {
    if (!bubbles.length) return;
    const next = Math.min(...bubbles.map((b) => b.until)) - Date.now();
    const timer = setTimeout(() => setBubbles((list) => liveBubbles(list, Date.now())), Math.max(50, next + 20));
    return () => clearTimeout(timer);
  }, [bubbles]);
  useEffect(() => {
    if (!online) setBubbles([]);
  }, [online]);

  // ---- saying cooldown ----
  const lastSent = useRef<number | null>(null);
  const [sayWaitMs, setSayWaitMs] = useState(0);
  useEffect(() => {
    if (sayWaitMs <= 0) return;
    const timer = setTimeout(() => setSayWaitMs(cooldownLeft(lastSent.current, Date.now())), Math.min(sayWaitMs, 500));
    return () => clearTimeout(timer);
  }, [sayWaitMs]);
  const say = useCallback(
    async (msg: { saying: QuickSaying } | { emoji: QuickEmoji }): Promise<string | null> => {
      if (cooldownLeft(lastSent.current, Date.now()) > 0) return t('sayWait');
      lastSent.current = Date.now();
      setSayWaitMs(SAY_COOLDOWN_MS);
      const res = await client.say(msg);
      if (!res.ok) {
        lastSent.current = null;
        setSayWaitMs(0);
        return res.error;
      }
      return null;
    },
    [client],
  );

  // ---- voice ----
  const lk = getLk();
  const voiceOn = online && roomVoice && lk !== null && client.fetchVoiceToken !== undefined;
  const fetchRef = useRef(client.fetchVoiceToken);
  fetchRef.current = client.fetchVoiceToken;
  const controller = useMemo(() => new VoiceController({ lk, fetchToken: () => (fetchRef.current ? fetchRef.current() : Promise.reject(new Error('no voice'))) }), [lk]);
  const [voice, setVoice] = useState<VoiceSnapshot>(controller.snapshot);
  useEffect(() => {
    setVoice(controller.snapshot);
    return controller.subscribe(setVoice);
  }, [controller]);
  const seated = mySeat >= 0;
  useEffect(() => {
    if (!voiceOn || !started || !seated) return;
    void controller.join();
    if (accountsEnabled()) {
      void accounts
        .getMe()
        .then((me) => controller.setBannedUntil(me.voiceBannedUntil ?? null))
        .catch(() => {});
    }
    return () => void controller.leave();
  }, [voiceOn, started, seated, controller, room?.id]);
  useEffect(() => controller.setSilenced(silenced), [controller, silenced]);

  const [explained, setExplained] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(EXPLAINED_KEY)
      .then((v) => setExplained(v === '1'))
      .catch(() => setExplained(false));
  }, []);
  const markExplained = useCallback(() => {
    setExplained(true);
    AsyncStorage.setItem(EXPLAINED_KEY, '1').catch(() => {});
  }, []);
  const toggleMic = useCallback(() => void controller.toggleMic(), [controller]);

  // ---- people actions ----
  const seatOf = useCallback((seat: number) => seats.find((s) => s.seat === seat), [seats]);
  const toggleMute = useCallback(
    (seat: number) => {
      const s = seatOf(seat);
      if (!s) return;
      const key = occupantKey(s);
      setMutedKeys((cur) => {
        const next = new Set(cur);
        if (!next.delete(key)) next.add(key);
        return next;
      });
    },
    [seatOf],
  );
  const block = useCallback(
    async (seat: number): Promise<string> => {
      const s = seatOf(seat);
      if (!s?.accountId) return t('tableNoAccount');
      const out = await blockList.block(s.accountId);
      return out === 'ok' ? t('tableBlockedDone', { name: s.name }) : t('tableTryAgain');
    },
    [seatOf],
  );
  const unblock = useCallback(
    async (seat: number): Promise<string> => {
      const s = seatOf(seat);
      if (!s?.accountId) return t('tableNoAccount');
      await blockList.unblock(s.accountId);
      return t('tableUnblockedDone', { name: s.name });
    },
    [seatOf],
  );
  const report = useCallback(
    async (seat: number, reason: ReportReason, context?: ReportContext): Promise<string> => {
      const s = seatOf(seat);
      if (!s?.accountId || !accountsEnabled()) return t('tableNoAccount');
      try {
        await accounts.report(s.accountId, reason, context);
        return t('tableReportSent');
      } catch (e) {
        return e instanceof AccountsError && e.code === 'bad_request' ? t('tableNoAccount') : t('tableTryAgain');
      }
    },
    [seatOf],
  );
  const nameOf = useCallback((seat: number) => seatOf(seat)?.name ?? '', [seatOf]);
  const [anchored, setAnchored] = useState<ReadonlySet<number>>(new Set());
  const anchor = useCallback((seat: number) => {
    setAnchored((cur) => (cur.has(seat) ? cur : new Set(cur).add(seat)));
    return () =>
      setAnchored((cur) => {
        if (!cur.has(seat)) return cur;
        const next = new Set(cur);
        next.delete(seat);
        return next;
      });
  }, []);

  const value = useMemo<TableSocialValue | null>(
    () =>
      online
        ? {
            mySeat,
            others,
            bubbles,
            nameOf,
            blocked,
            muted,
            voiceOn,
            voice: voiceOn ? voice : IDLE_VOICE,
            explained,
            markExplained,
            toggleMic,
            sayWaitMs,
            say,
            toggleMute,
            block,
            unblock,
            report,
            anchored,
            anchor,
          }
        : null,
    [online, mySeat, others, bubbles, nameOf, blocked, muted, voiceOn, voice, explained, markExplained, toggleMic, sayWaitMs, say, toggleMute, block, unblock, report, anchored, anchor],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Voice error as the text the person sees (null = nothing to say). */
export function voiceStatusKey(v: VoiceSnapshot): Key | null {
  if (v.status === 'connecting') return 'voiceConnecting';
  if (v.error === 'banned' || v.bannedUntil > Date.now()) return 'voiceBanned';
  if (v.error === 'permission') return 'voiceDenied';
  if (v.status === 'failed') return 'voiceFailed';
  return null;
}
