import type { Action, GameMode, PlayerView } from './game';

export interface SeatInfo {
  seat: number;
  name: string;
  isBot: boolean;
  connected: boolean;
}

export interface RoomInfo {
  id: string;
  mode: GameMode;
  seats: (SeatInfo | null)[];
  hostSeat: number;
  started: boolean;
  round: number;
  /** Cumulative scores across rounds (düz okey: points lost this game). */
  totals: number[];
  /** Listed in the salon for anyone to sit at; otherwise joined by code only. */
  isPublic?: boolean;
}

/** One table in the salon list. */
export interface TableSummary {
  id: string;
  mode: GameMode;
  /** Names of the people at the table, by seat; null = free seat. */
  seats: (string | null)[];
  /** Free seats: empty before the start, bot-played once the game is on. */
  free: number;
  started: boolean;
}

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  /** `isPublic`: list the table in the salon. */
  'room:create': (p: { name: string; mode?: GameMode; isPublic?: boolean }, ack: Ack<{ roomId: string; seat: number }>) => void;
  'room:join': (p: { roomId: string; name: string }, ack: Ack<{ roomId: string; seat: number }>) => void;
  /** Creates a room, fills empty seats with bots and starts immediately. */
  'room:quickPlay': (p: { name: string; mode?: GameMode }, ack: Ack<{ roomId: string; seat: number }>) => void;
  /** Host only: fill empty seats with bots and start. */
  'room:start': (ack: Ack) => void;
  'room:nextRound': (ack: Ack) => void;
  /** Leaving on purpose: mid-game a bot takes the seat for good, freeing it for someone else. */
  'room:leave': () => void;
  /** Receive the salon list now and whenever it changes, until unwatched or seated. */
  'salon:watch': (on: boolean) => void;
  'game:action': (action: Action, ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (room: RoomInfo) => void;
  'game:view': (view: PlayerView) => void;
  'salon:list': (tables: TableSummary[]) => void;
}
