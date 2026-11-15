import type { ViewContext } from '@kahve/core';
import type { PistiState, PistiView } from './types';
import { clone } from './clone';
export function viewFor(s: PistiState, seat: number, ctx?: ViewContext): PistiView {
    const valid = Number.isInteger(seat) && seat >= 0 && seat < s.options.seats;
    const hand = valid ? s.players[seat].hand : [];
    // Explicit whitelist: never copy the authoritative state into a public view.
    return clone({ options: s.options, round: s.round, dealer: s.dealer, seat, turn: s.phase === 'playing' ? s.turn : null, turnNumber: s.turnNumber, phase: s.phase, hand, topCard: s.centerPile.at(-1) ?? null, centerCount: s.centerPile.length, deckCount: s.deck.length, playableCardIds: valid && s.phase === 'playing' && s.turn === seat ? hand.map(c => c.id) : [], players: s.players.map(p => ({ seat: p.seat, name: p.name, team: s.options.partnerMode ? p.seat % 2 : p.seat, handCount: p.hand.length, capturedCount: s.captured[p.seat].length, pistiCount: s.pistis[p.seat].length })), openingCard: s.openingCard, publicHistory: s.publicHistory, lastAction: s.lastAction, lastCapture: s.lastCapture, result: s.result, clock: ctx?.clock ?? null });
}
