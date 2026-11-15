import { deal, shuffleDeck, sortHand } from '@kahve/cards';
import type { Rng } from '@kahve/core';
import { normalizeOptions } from './options';
import type { PistiOptions, PistiState } from './types';
/** Mutates only a fresh state owned by create/apply. Four-card blocks after dealer. */
export function distribute(s: PistiState): void {
    const { hands, remaining } = deal(s.deck, Array(s.options.seats).fill(4));
    hands.forEach((hand, i) => { s.players[(s.dealer + 1 + i) % s.options.seats].hand = sortHand(hand, 'asc'); });
    s.deck = remaining;
}
export function create(options: PistiOptions, names: string[], rng: Rng, round = 0): PistiState {
    const opts = normalizeOptions(options), deck = shuffleDeck(rng), centerPile = deck.splice(0, 4);
    if (opts.openingJack === 'redraw')
        while (centerPile[3].rank === 11) {
            deck.splice(Math.floor(deck.length / 2), 0, centerPile.pop()!);
            centerPile.push(deck.shift()!);
        }
    const dealer = round % opts.seats;
    const s: PistiState = { options: opts, round, dealer, turn: (dealer + 1) % opts.seats, turnNumber: 0, phase: 'playing', players: Array.from({ length: opts.seats }, (_, seat) => ({ seat, name: names[seat] ?? `Oyuncu ${seat + 1}`, hand: [] })), deck, centerPile, hiddenOpeningCardIds: centerPile.slice(0, 3).map(c => c.id), captured: Array.from({ length: opts.seats }, () => []), pistis: Array.from({ length: opts.seats }, () => []), lastCapturer: null, openingCard: { ...centerPile[3] }, publicHistory: [], lastAction: null, lastCapture: null, result: null };
    distribute(s);
    return s;
}
