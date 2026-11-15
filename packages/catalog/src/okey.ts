// A2 (Claude Opus): okey 101 / düz okey behind the @kahve/core GameDefinition contract.
// Thin wrapper: every rule lives in @okey/shared; this file only maps names and shapes.
import type { BotLevel, GameDefinition, Rng, ViewContext } from '@kahve/core';
import {
  applyAction,
  botStep,
  createGame,
  DEFAULT_ISLEK,
  DEFAULT_RESHUFFLES,
  ISLEK_MODES,
  matchOver,
  quickMove,
  SEATS,
  TURN_MS,
  viewFor,
  type Action,
  type GameMode,
  type GameState,
  type IslekMode,
  type PlayerView,
} from '@okey/shared';

/**
 * 101 match end (user decision, 15.11.2026): never, after N hands, or once someone's total
 * reaches the limit. Düz okey ignores it (it ends when someone is out of points).
 */
export type MatchEnd = { kind: 'none' } | { kind: 'hands'; n: 5 | 7 | 11 } | { kind: 'points'; limit: 501 | 1001 };

export interface OkeyOptions {
  /** How many times the discards may be reshuffled into a new middle stack (0 = round ends at deck-out). */
  reshuffles: number;
  /** 101: who pays 101 for throwing a tile that fits a meld on the table. */
  islek: IslekMode;
  /** 101: when a match ends and the totals start over. */
  matchEnd: MatchEnd;
}

export const MAX_RESHUFFLES = 10;
export const MATCH_HANDS = [5, 7, 11] as const;
export const MATCH_POINTS = [501, 1001] as const;
/** Fable's proposal, to be confirmed with the user: five hands. */
export const DEFAULT_MATCH_END: MatchEnd = { kind: 'hands', n: 5 };

export const DEFAULT_OKEY_OPTIONS: OkeyOptions = {
  reshuffles: DEFAULT_RESHUFFLES,
  islek: DEFAULT_ISLEK,
  matchEnd: DEFAULT_MATCH_END,
};

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function normalizeMatchEnd(raw: unknown): MatchEnd {
  if (!isRecord(raw)) return DEFAULT_MATCH_END;
  if (raw.kind === 'none') return { kind: 'none' };
  if (raw.kind === 'hands' && (MATCH_HANDS as readonly unknown[]).includes(raw.n)) return { kind: 'hands', n: raw.n as 5 | 7 | 11 };
  if (raw.kind === 'points' && (MATCH_POINTS as readonly unknown[]).includes(raw.limit))
    return { kind: 'points', limit: raw.limit as 501 | 1001 };
  return DEFAULT_MATCH_END;
}

export function normalizeOkeyOptions(raw: unknown): OkeyOptions {
  // Each field is repaired on its own; a hostile getter/proxy falls back to that field's default.
  const field = <T>(read: (r: Record<string, unknown>) => T, fallback: T): T => {
    try {
      return isRecord(raw) ? read(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const reshuffles = field((r) => {
    const v = r.reshuffles;
    return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= MAX_RESHUFFLES ? v : DEFAULT_RESHUFFLES;
  }, DEFAULT_RESHUFFLES);
  const islek = field((r) => ((ISLEK_MODES as readonly unknown[]).includes(r.islek) ? (r.islek as IslekMode) : DEFAULT_ISLEK), DEFAULT_ISLEK);
  const matchEnd = field((r) => normalizeMatchEnd(r.matchEnd), DEFAULT_MATCH_END);
  return { reshuffles, islek, matchEnd };
}

/**
 * Match over? `rounds` = hands played in this match. Düz okey: someone is out of points (as before).
 * 101: per `matchEnd`.
 */
export function okeyMatchOver(mode: GameMode, totals: number[], rounds: number, opts: OkeyOptions): boolean {
  if (mode === 'duz') return matchOver(mode, totals);
  const end = opts?.matchEnd ?? DEFAULT_MATCH_END;
  if (end.kind === 'hands') return rounds >= end.n;
  if (end.kind === 'points') return totals.some((t) => t >= end.limit);
  return false;
}

const isInt = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x);
const isIntList = (x: unknown): x is number[] => Array.isArray(x) && x.length > 0 && x.every(isInt);

/** Shape check for an okey Action from the network. Never throws. */
export function isOkeyAction(raw: unknown): raw is Action {
  try {
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return false;
    const a = raw as Record<string, unknown>;
    switch (a.type) {
      case 'draw':
        return a.source === 'deck' || a.source === 'discard';
      case 'open':
        return Array.isArray(a.melds) && a.melds.length > 0 && a.melds.every(isIntList);
      case 'meld':
        return isIntList(a.tileIds);
      case 'addToMeld':
        return isInt(a.meldId) && isIntList(a.tileIds);
      case 'discard':
      case 'finish':
        return isInt(a.tileId);
      case 'showIndicator':
        return true;
      default:
        return false;
    }
  } catch {
    return false;
  }
}

const okeyBotLevel = (level: BotLevel) => (level === 'hard' ? 'hard' : 'medium');

export function makeOkeyDef(mode: GameMode): GameDefinition<GameState, Action, PlayerView, OkeyOptions> {
  return {
    id: mode === '101' ? 'okey101' : 'okeyDuz',
    group: 'okey',
    status: 'active',
    seatChoices: [SEATS],
    titleKey: mode === '101' ? 'game.okey101' : 'game.okeyDuz',
    defaultOptions: DEFAULT_OKEY_OPTIONS,
    normalizeOptions: normalizeOkeyOptions,
    seats: () => SEATS,
    // firstTurnFactor must match turnBudgetMs in @okey/shared/clock.ts (hard-coded x2 there).
    clock: { baseMs: TURN_MS, firstTurnFactor: 2 },

    create: (opts: OkeyOptions, names: string[], rng: Rng, round: number) =>
      createGame({ mode, names, startingSeat: round % SEATS, rng, reshuffles: opts.reshuffles, islek: opts.islek ?? DEFAULT_ISLEK }),
    isAction: isOkeyAction,
    apply: (state, seat, action) => applyAction(state, seat, action),
    viewFor: (state, seat, ctx?: ViewContext) => viewFor(state, seat, ctx?.clock ?? null, ctx?.now),

    turn: (state) =>
      state.phase === 'playing' ? { seat: state.turn, key: state.turnNumber, first: state.turnNumber === 0 } : null,
    refillsClock: (action) => action.type === 'open' || action.type === 'meld' || action.type === 'addToMeld',
    noticeOf: (state) => state.notice ?? null,
    renameSeat: (state, seat, name) => ({
      ...state,
      players: state.players.map((p) => (p.seat === seat ? { ...p, name } : p)),
    }),

    botMove: (state, seat, level, rng) => botStep(viewFor(state, seat), { rng, level: okeyBotLevel(level) }),
    quickMove: (state, seat) => quickMove(viewFor(state, seat)),

    roundOver: (state) => state.phase === 'finished',
    scoreRound: (state) => [...(state.result?.scores ?? [0, 0, 0, 0])],
    matchOver: (totals, rounds, opts) => okeyMatchOver(mode, totals, rounds, opts),
  };
}

export const okey101Def = makeOkeyDef('101');
export const okeyDuzDef = makeOkeyDef('duz');
