/**
 * A7 adapter: the ONLY place that touches the A7-OPUS data fields by hand.
 * At merge, replace each shim with the real types:
 *   - noticeOf(view) / noticeFrozenMs(view) -> view.notice / view.noticeMsLeft (PlayerView)
 *   - matchOverOf(client)                   -> client.matchOver (OkeyClient)
 *   - quickPlayWith / createRoomWith        -> client.quickPlay(name, mode, options) / client.createRoom(..., options)
 */
import type { GameMode, PlayerView } from '@okey/shared';
import type { OkeyClient } from '../net/useOkey';

export type NoticeReason = 'islek' | 'okeyDiscard' | 'sideTileUnused' | 'okeyTaken';

export interface Notice {
  id: number;
  seat: number;
  reason: NoticeReason;
  amount: number;
}

export type MatchEnd =
  | { kind: 'none' }
  | { kind: 'hands'; n: 5 | 7 | 11 }
  | { kind: 'points'; limit: 501 | 1001 };

export const DEFAULT_MATCH_END: MatchEnd = { kind: 'hands', n: 5 };

type Result = { ok: true } | { ok: false; error: string };

/** The latest table notice and the ms left on its panel, or null when the host sends none. */
export function noticeOf(view: PlayerView): { notice: Notice; msLeft: number | null } | null {
  const v = view as unknown as { notice?: Notice | null; noticeMsLeft?: number };
  if (!v.notice) return null;
  return { notice: v.notice, msLeft: typeof v.noticeMsLeft === 'number' ? v.noticeMsLeft : null };
}

/** ms the turn clock is still frozen for (0 when not frozen or the host sends nothing). */
export function noticeFrozenMs(view: PlayerView): number {
  const ms = (view as unknown as { noticeMsLeft?: number }).noticeMsLeft;
  return typeof ms === 'number' && ms > 0 ? ms : 0;
}

/** True when the last finished round ended the 101 match (host decides; absent -> false). */
export function matchOverOf(client: OkeyClient): boolean {
  return (client as unknown as { matchOver?: boolean }).matchOver === true;
}

export function quickPlayWith(client: OkeyClient, name: string, mode: GameMode, matchEnd: MatchEnd): Promise<Result> {
  const f = client.quickPlay as unknown as (...a: unknown[]) => Promise<Result>;
  return mode === '101' ? f(name, mode, { matchEnd }) : f(name, mode);
}

export function createRoomWith(
  client: OkeyClient,
  name: string,
  mode: GameMode,
  isPublic: boolean,
  password: string | undefined,
  matchEnd: MatchEnd,
): Promise<Result> {
  const f = client.createRoom as unknown as (...a: unknown[]) => Promise<Result>;
  return mode === '101' ? f(name, mode, isPublic, password, { matchEnd }) : f(name, mode, isPublic, password);
}
