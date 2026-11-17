import type { GameDefinition } from '@kahve/core';
import { botMove, quickMove } from './bot';
import { defaultOptions, normalizeOptions } from './options';
import { apply, create, isAction, SEATS } from './rules';
import { matchOver, scoreRound } from './scoring';
import type { TavlaAction, TavlaOptions, TavlaState, TavlaView } from './types';
import { viewFor } from './view';

export const tavlaDef: GameDefinition<TavlaState, TavlaAction, TavlaView, TavlaOptions> = {
  id: 'tavla',
  group: 'tavla',
  status: 'active',
  seatChoices: [2],
  titleKey: 'game.tavla',
  defaultOptions,
  normalizeOptions,
  seats: () => SEATS,
  // 60 s a turn (doubles are 4 moves, 8 taps; the players are often 60+); the opening turn gets no extra.
  clock: { baseMs: 60000, firstTurnFactor: 1 },
  create,
  isAction,
  apply,
  viewFor,
  turn: s => (s.phase === 'finished' ? null : { seat: s.turn, key: s.turnNumber, first: s.turnNumber === 0 }),
  refillsClock: () => false,
  renameSeat: (s, seat, name) => ({ ...s, players: s.players.map(p => (p.seat === seat ? { ...p, name } : p)) }),
  botMove,
  quickMove,
  roundOver: s => s.phase === 'finished',
  scoreRound,
  matchOver,
};
