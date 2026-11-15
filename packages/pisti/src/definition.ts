import type { GameDefinition } from '@kahve/core';
import type { PistiAction, PistiOptions, PistiState, PistiView } from './types';
import { defaultOptions, normalizeOptions } from './options';
import { create } from './setup';
import { apply, isAction } from './rules';
import { viewFor } from './view';
import { botMove, quickMove } from './bot';
import { matchOver, scoreRound } from './scoring';
export const pistiDef: GameDefinition<PistiState, PistiAction, PistiView, PistiOptions> = {
    id: 'pisti', group: 'kagit', status: 'active', seatChoices: [2, 4], titleKey: 'game.pisti', defaultOptions, normalizeOptions, seats: o => o.seats,
    clock: { baseMs: 30000, firstTurnFactor: 2 }, create, isAction, apply, viewFor,
    turn: s => s.phase === 'finished' ? null : { seat: s.turn, key: s.turnNumber, first: s.turnNumber === 0 }, refillsClock: () => false,
    renameSeat: (s, seat, name) => ({ ...s, players: s.players.map(p => p.seat === seat ? { ...p, name } : p) }),
    botMove: (s, seat, level, rng) => botMove(viewFor(s, seat), level, rng), quickMove: (s, seat) => quickMove(viewFor(s, seat)),
    roundOver: s => s.phase === 'finished', scoreRound, matchOver,
};
