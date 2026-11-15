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
 * different one) is talking to an old server: it leaves the room and shows i18n 'net.serverUpdating'.
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
}

export interface RoomInfo {
  id: string;
  /** Legacy, still sent for okey tables (v1 clients read it). Non-okey tables send '101' as a harmless placeholder; v2 clients read `game`. */
  mode: GameMode;
  /** v2 server always sets it. Missing = old server: derive with gameOfMode(mode). */
  game?: GameId;
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

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  /** `isPublic`: list the table in the salon. `password` (6 digits): listed, locked with it. */
  'room:create': (
    p: { name: string; mode?: GameMode; game?: GameId; options?: unknown; isPublic?: boolean; password?: string },
    ack: Ack<{ roomId: string; seat: number }>,
  ) => void;
  /** `password`: needed for a locked table. */
  /** `game` (v2): what the client expects to find; a mismatch is an error, not a silent okey table. */
  'room:join': (p: { roomId: string; name: string; password?: string; game?: GameId }, ack: Ack<{ roomId: string; seat: number }>) => void;
  /** Creates a room, fills empty seats with bots and starts immediately. */
  'room:quickPlay': (p: { name: string; mode?: GameMode; game?: GameId; options?: unknown }, ack: Ack<{ roomId: string; seat: number }>) => void;
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
}

export interface KahveServerToClientEvents extends Omit<ServerToClientEvents, 'game:view'> {
  /** v1 socket: bare okey PlayerView. v2 socket: GameViewEnvelope for every game, okey included. */
  'game:view': (view: PlayerView | GameViewEnvelope) => void;
}
