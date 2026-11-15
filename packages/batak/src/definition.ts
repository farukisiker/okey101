import type { GameDefinition } from '@kahve/core';
import { botMove, quickMove } from './bot';
import { defaultOptions, normalizeOptions } from './options';
import { apply, isAction } from './rules';
import { matchOver, scoreRound } from './scoring';
import { create, SEATS } from './setup';
import type { BatakAction, BatakOptions, BatakState, BatakView } from './types';
import { viewFor } from './view';

export const batakDef: GameDefinition<BatakState, BatakAction, BatakView, BatakOptions> = {
  id: 'batak',
  group: 'kagit',
  status: 'active',
  seatChoices: [4],
  titleKey: 'game.batak',
  defaultOptions,
  normalizeOptions,
  seats: () => SEATS,
  clock: { baseMs: 30000, firstTurnFactor: 2 },
  create,
  isAction,
  apply,
  viewFor: (s, seat) => viewFor(s, seat),
  turn: s => (s.phase === 'finished' ? null : { seat: s.turn, key: s.turnNumber, first: s.turnNumber === 0 }),
  refillsClock: () => false,
  renameSeat: (s, seat, name) => ({ ...s, players: s.players.map(p => (p.seat === seat ? { ...p, name } : p)) }),
  // Bots and the timeout move see exactly what the seat sees.
  botMove: (s, seat, level, rng) => botMove(viewFor(s, seat), level, rng),
  quickMove: (s, seat) => quickMove(viewFor(s, seat)),
  roundOver: s => s.phase === 'finished',
  scoreRound,
  matchOver,
};
