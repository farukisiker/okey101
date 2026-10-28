import type { Action, PlayerView } from './game';

export interface SeatInfo {
  seat: number;
  name: string;
  isBot: boolean;
  connected: boolean;
}

export interface RoomInfo {
  id: string;
  seats: (SeatInfo | null)[];
  hostSeat: number;
  started: boolean;
  round: number;
  /** Cumulative scores across rounds. */
  totals: number[];
}

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export interface ClientToServerEvents {
  'room:create': (p: { name: string }, ack: Ack<{ roomId: string; seat: number }>) => void;
  'room:join': (p: { roomId: string; name: string }, ack: Ack<{ roomId: string; seat: number }>) => void;
  /** Creates a room, fills empty seats with bots and starts immediately. */
  'room:quickPlay': (p: { name: string }, ack: Ack<{ roomId: string; seat: number }>) => void;
  /** Host only: fill empty seats with bots and start. */
  'room:start': (ack: Ack) => void;
  'room:nextRound': (ack: Ack) => void;
  'room:leave': () => void;
  'game:action': (action: Action, ack: Ack) => void;
}

export interface ServerToClientEvents {
  'room:state': (room: RoomInfo) => void;
  'game:view': (view: PlayerView) => void;
}
