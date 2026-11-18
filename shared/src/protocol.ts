import type { GameId } from '@kahve/core';
import type { Action, GameMode, PlayerView } from './game';

export type { GameId } from '@kahve/core';

/*
 * Protocol versions (A0, owner: Fable; frozen, changes via docs/kahve/requests/).
 *  v1 = Demli Okey ≤ 1.0.1 in the stores: no `handshake.auth.v`, okey only, `mode` field,
 *       bare PlayerView on 'game:view', `salon:watch(on)` without filter.
 *  v2 = Demli Kahve: sends `auth: { v: 2 }`, may send `game`/`options`, gets GameViewEnvelope.
 * Every v2 field is optional, so a v1 client keeps working unchanged against a v2 server.
 */
export const PROTOCOL_VERSION = 2;

/** What a client puts in socket.io's `auth` option. v1 clients send nothing. */
export interface HandshakeAuth {
  v?: number;
  /**
   * E2, v2 only: the accounts-server id of the player (UNVERIFIED; used only as a report/block target).
   * Same as `accountId` on room:create / room:join / room:quickPlay; the payload wins when both are sent.
   */
  accountId?: string;
}

/** The client's protocol version from `socket.handshake.auth`: missing or junk = 1. */
export function clientProtocol(auth: unknown): number {
  const v = (auth as HandshakeAuth | null | undefined)?.v;
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 ? v : 1;
}

/** Older apps send no `game`: the legacy `mode` decides ('duz' -> okeyDuz, anything else -> okey101). */
export function gameOfMode(mode: unknown): GameId {
  return mode === 'duz' ? 'okeyDuz' : 'okey101';
}

/** The legacy `mode` for okey games (still sent to v1 clients); undefined for every other game. */
export function modeOfGame(game: GameId): GameMode | undefined {
  return game === 'okey101' ? '101' : game === 'okeyDuz' ? 'duz' : undefined;
}

export const isOkeyGame = (game: GameId): boolean => game === 'okey101' || game === 'okeyDuz';

/**
 * Error text a v2 server returns when a v1 client tries a non-okey table.
 * A v2 client that asked for `game` and gets back a RoomInfo without `game` (or with a
 * different one) is talking to an old server: it leaves the room and shows i18n 'serverUpdating'.
 */
export const ERR_UPDATE_APP = 'Bu masa için uygulamayı güncelleyin';

/** v2: which tables a salon watcher wants. Missing filter (v1) = okey tables only. */
export interface SalonFilter {
  games?: GameId[];
}

/** v2 'game:view' payload. v1 clients keep getting the bare okey PlayerView. */
export interface GameViewEnvelope<V = unknown> {
  game: GameId;
  view: V;
}

export interface SeatInfo {
  seat: number;
  name: string;
  isBot: boolean;
  connected: boolean;
  /**
   * E2, v2 sockets only (never sent to v1): the accounts id the player's app sent with hello/join.
   * UNVERIFIED (the game server does not check it): only a target for report/block. Missing for bots and guests without one.
   */
  accountId?: string;
}

export interface RoomInfo {
  id: string;
  /** Legacy, still sent for okey tables (v1 clients read it). Non-okey tables send '101' as a harmless placeholder; v2 clients read `game`. */
  mode: GameMode;
  /** v2 server always sets it. Missing = old server: derive with gameOfMode(mode). */
  game?: GameId;
  /** The last finished round ended the match (per the table's options); "Yeni maç" then starts from zero. Missing = false. */
  matchOver?: boolean;
  seats: (SeatInfo | null)[];
  hostSeat: number;
  started: boolean;
  round: number;
  /** Cumulative scores across rounds (düz okey: points lost this game). */
  totals: number[];
  /** Listed in the salon for anyone to sit at; otherwise joined by code only. */
  isPublic?: boolean;
  /** Listed, but sitting down needs this 6-digit password. Sent only to the people at the table. */
  password?: string;
  /** E2, v2 sockets only: the host opened voice chat for this table (voice:token works). */
  voice?: boolean;
}

/** One table in the salon list. */
export interface TableSummary {
  id: string;
  /** Legacy, see RoomInfo.mode. */
  mode: GameMode;
  /** v2 server always sets it. Missing = old server: derive with gameOfMode(mode). */
  game?: GameId;
  /** Names of the people at the table, by seat; null = free seat. */
  seats: (string | null)[];
  /** Free seats: empty before the start, bot-played once the game is on. */
  free: number;
  started: boolean;
  /** Sitting down needs the table's 6-digit password. */
  locked?: boolean;
}

/** A table password: exactly 6 digits. */
export const isTablePassword = (p: unknown): p is string => typeof p === 'string' && /^\d{6}$/.test(p);

/** E2: the fixed "Kahve Sözleri". No free text at the table; the app shows them through i18n keys. */
export const QUICK_SAYINGS = [
  'hayirliOlsun',
  'cayBenden',
  'eline',
  'gecmisOlsun',
  'kolayGelsin',
  'sansinBol',
  'tebrikler',
  'biraBekle',
  'tesekkurler',
  'hadiBakalim',
] as const;
export type QuickSaying = (typeof QUICK_SAYINGS)[number];
export const QUICK_EMOJI = ['👍', '😄', '👏', '☕', '😮', '🙏'] as const;
export type QuickEmoji = (typeof QUICK_EMOJI)[number];

export const isQuickSaying = (v: unknown): v is QuickSaying => typeof v === 'string' && (QUICK_SAYINGS as readonly string[]).includes(v);
export const isQuickEmoji = (v: unknown): v is QuickEmoji => typeof v === 'string' && (QUICK_EMOJI as readonly string[]).includes(v);

/** 'table:say' payload: exactly one of the two. */
export interface TableSay {
  saying?: QuickSaying;
  emoji?: QuickEmoji;
}
/** 'table:said': someone at the table said something (v2 sockets only). `at` = server epoch ms. */
export interface TableSaid extends TableSay {
  seat: number;
  at: number;
}
/** 'table:say' errors: not seated at a table, bad payload, or over the limit (1 per 2 s, 15 per minute). */
export type TableSayError = 'not_seated' | 'invalid' | 'rate_limited';
export const SAY_MIN_GAP_MS = 2000;
export const SAY_PER_MINUTE = 15;

/** 'voice:token' answer: a LiveKit access token for the table's audio room. */
export type VoiceTokenResult =
  | { ok: true; url: string; token: string; room: string; identity: string }
  | { ok: false; error: 'voice_off' | 'not_seated' | 'not_configured' };

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  /** `isPublic`: list the table in the salon. `password` (6 digits): listed, locked with it. */
  /** E2 (v2): `voice` = voice chat at this table (missing: on for a friends table, off for an open listed one); `accountId` see SeatInfo. */
  'room:create': (
    p: {
      name: string;
      mode?: GameMode;
      game?: GameId;
      options?: unknown;
      isPublic?: boolean;
      password?: string;
      voice?: boolean;
      accountId?: string;
    },
    ack: Ack<{ roomId: string; seat: number }>,
  ) => void;
  /** `password`: needed for a locked table. */
  /** `game` (v2): what the client expects to find; a mismatch is an error, not a silent okey table. */
  'room:join': (p: { roomId: string; name: string; password?: string; game?: GameId; accountId?: string }, ack: Ack<{ roomId: string; seat: number }>) => void;
  /** Creates a room, fills empty seats with bots and starts immediately. */
  'room:quickPlay': (p: { name: string; mode?: GameMode; game?: GameId; options?: unknown; accountId?: string }, ack: Ack<{ roomId: string; seat: number }>) => void;
  /** Host only: fill empty seats with bots and start. */
  'room:start': (ack: Ack) => void;
  'room:nextRound': (ack: Ack) => void;
  /** Leaving on purpose: mid-game a bot takes the seat for good, freeing it for someone else. */
  'room:leave': () => void;
  /** Receive the salon list now and whenever it changes, until unwatched or seated. */
  'salon:watch': (on: boolean, filter?: SalonFilter) => void;
  /** v1 sends an okey Action; v2 non-okey tables send that game's action (checked with def.isAction, then def.apply). */
  'game:action': (action: Action, ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (room: RoomInfo) => void;
  'game:view': (view: PlayerView) => void;
  'salon:list': (tables: TableSummary[]) => void;
}

/**
 * The v2 server's event map (A4 switches server/ and app/net to it). Same event names, so a
 * v1 client on a v2 server sees no difference; the server picks the payload per socket.
 */
export interface KahveClientToServerEvents extends Omit<ClientToServerEvents, 'game:action'> {
  'game:action': (action: unknown, ack: Ack) => void;
  /** E2: a quick saying or emoji to the table. Seated humans only; 1 per 2 s and 15 per minute per socket. */
  'table:say': (msg: TableSay, ack: (res: { ok: true } | { ok: false; error: TableSayError }) => void) => void;
  /** E2: LiveKit token for the table's voice room (table opened with voice, caller seated, server configured). */
  'voice:token': (ack: (r: VoiceTokenResult) => void) => void;
}

export interface KahveServerToClientEvents extends Omit<ServerToClientEvents, 'game:view'> {
  /** v1 socket: bare okey PlayerView. v2 socket: GameViewEnvelope for every game, okey included. */
  'game:view': (view: PlayerView | GameViewEnvelope) => void;
  /** E2, v2 sockets only: a saying/emoji from `seat`. */
  'table:said': (m: TableSaid) => void;
}
