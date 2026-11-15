import type { GameMode, RoomInfo, TableSummary } from '@okey/shared';
import type { Session } from './useOkey';

export type Result = { ok: true } | { ok: false; error: string };

/**
 * What the salon list and the waiting room need from a connection. The okey client (useOkey) and the
 * card-game client (useKahveGame) both fit it, so Salon and WaitingRoom serve every game.
 */
export interface TableClient {
  connected: boolean;
  session: Session | null;
  room: RoomInfo | null;
  salon: TableSummary[];
  watchSalon(on: boolean): void;
  /** `mode` is okey's legacy mode; card clients ignore it and use their own game. */
  createRoom(name: string, mode: GameMode, isPublic?: boolean, password?: string, options?: unknown): Promise<Result>;
  joinRoom(name: string, roomId: string, password?: string): Promise<Result>;
  start(): Promise<Result>;
  leave(): void;
}
