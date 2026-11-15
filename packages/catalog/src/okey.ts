// A2 (Claude Opus): okey 101 / düz okey behind the @kahve/core GameDefinition contract.
// Thin wrapper: every rule lives in @okey/shared; this file only maps names and shapes.
import type { BotLevel, GameDefinition, Rng, ViewContext } from '@kahve/core';
import {
  applyAction,
  botStep,
  createGame,
  DEFAULT_RESHUFFLES,
  matchOver,
  quickMove,
  SEATS,
  TURN_MS,
  viewFor,
  type Action,
  type GameMode,
  type GameState,
  type PlayerView,
} from '@okey/shared';

export interface OkeyOptions {
  /** How many times the discards may be reshuffled into a new middle stack (0 = round ends at deck-out). */
  reshuffles: number;
}

export const MAX_RESHUFFLES = 10;

export const DEFAULT_OKEY_OPTIONS: OkeyOptions = { reshuffles: DEFAULT_RESHUFFLES };

export function normalizeOkeyOptions(raw: unknown): OkeyOptions {
  let reshuffles = DEFAULT_RESHUFFLES;
  try {
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
      const r = (raw as Record<string, unknown>).reshuffles;
      if (typeof r === 'number' && Number.isInteger(r) && r >= 0 && r <= MAX_RESHUFFLES) reshuffles = r;
    }
  } catch {
    // hostile getters/proxies fall back to defaults
  }
  return { reshuffles };
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
      createGame({ mode, names, startingSeat: round % SEATS, rng, reshuffles: opts.reshuffles }),
    isAction: isOkeyAction,
    apply: (state, seat, action) => applyAction(state, seat, action),
    viewFor: (state, seat, ctx?: ViewContext) => viewFor(state, seat, ctx?.clock ?? null, ctx?.now),

    turn: (state) =>
      state.phase === 'playing' ? { seat: state.turn, key: state.turnNumber, first: state.turnNumber === 0 } : null,
    refillsClock: (action) => action.type === 'open' || action.type === 'meld' || action.type === 'addToMeld',

    botMove: (state, seat, level, rng) => botStep(viewFor(state, seat), { rng, level: okeyBotLevel(level) }),
    quickMove: (state, seat) => quickMove(viewFor(state, seat)),

    roundOver: (state) => state.phase === 'finished',
    scoreRound: (state) => [...(state.result?.scores ?? [0, 0, 0, 0])],
    matchOver: (totals) => matchOver(mode, totals),
  };
}

export const okey101Def = makeOkeyDef('101');
export const okeyDuzDef = makeOkeyDef('duz');
