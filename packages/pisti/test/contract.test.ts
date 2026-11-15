import { expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { pistiDef as d, type PistiState } from '../src';
import { clone } from '../src/clone';
function step(s: PistiState, id: number) { const r = d.apply(s, s.turn, { type: 'play', cardId: id }); if (!r.ok)
    throw Error(r.error); return r.state; }
it.each(['reveal', 'secret'] as const)('hidden opening permutation never leaks through views/events/history %s', hiddenCards => {
    let a = d.create(d.normalizeOptions({ hiddenCards }), [], seededRng(6), 0), b = clone(a);
    // Swap hidden identities with the deck, retaining public top and all hands.
    [b.centerPile[0], b.deck[0]] = [b.deck[0], b.centerPile[0]];
    b.hiddenOpeningCardIds = b.centerPile.slice(0, 3).map(c => c.id);
    const active = a.turn;
    expect(d.viewFor(a, active)).toEqual(d.viewFor(b, active));
    // Give both positions the same legal capturing jack via a public-preserving swap.
    const jack = a.players[active].hand.find(c => c.rank === 11);
    if (!jack) {
        const index = a.deck.findIndex(c => c.rank === 11);
        [a.players[active].hand[0], a.deck[index]] = [a.deck[index], a.players[active].hand[0]];
        [b.players[active].hand[0], b.deck[index]] = [b.deck[index], b.players[active].hand[0]];
    }
    const id = a.players[active].hand.find(c => c.rank === 11)!.id;
    a = step(a, id);
    b = step(b, id);
    expect(a.lastCapture).toEqual(b.lastCapture);
    expect(a.lastCapture?.points).toBe(0);
    if (hiddenCards === 'secret')
        for (const seat of [0, 1]) {
            expect(d.viewFor(a, seat)).toEqual(d.viewFor(b, seat));
            for (const level of ['easy', 'medium', 'hard'] as const)
                expect(d.botMove(a, a.turn, level, seededRng(1))).toEqual(d.botMove(b, b.turn, level, seededRng(1)));
        }
    else
        expect(a.lastAction?.revealedCards).not.toEqual(b.lastAction?.revealedCards);
});
it('secret identities absent even after round; only final scores disclose their value', () => {
    let s = d.create(d.normalizeOptions({ hiddenCards: 'secret' }), [], seededRng(10), 0);
    const hidden = s.hiddenOpeningCardIds.slice();
    while (!d.roundOver(s))
        s = step(s, d.quickMove(s, s.turn).cardId);
    for (const seat of [0, 1]) {
        const v = d.viewFor(s, seat);
        expect(v.publicHistory.every(e => e.revealedCards.length === 0)).toBe(true);
        expect(v.lastAction?.revealedCards).toEqual([]);
        expect(v.publicHistory.some(e => hidden.includes(e.card.id))).toBe(false);
        expect(v.topCard).toBeNull();
        expect(v.hand).toEqual([]);
        expect(v.result).toEqual(s.result);
    }
});
it('custom card and pisti values, team majority and public seat counters', () => {
    const s = d.create(d.normalizeOptions({ seats: 4, partnerMode: true, pistiPoints: 7, jackPistiPoints: 9, acePoints: 2, jackPoints: 3, clubTwoPoints: 4, diamondTenPoints: 5, mostCardsPoints: 6 }), [], seededRng(8), 0);
    // Keep actual cards conserved while installing a near-final, deterministic round.
    const all = [...s.deck, ...s.centerPile, ...s.players.flatMap(p => p.hand)];
    const c = all.find(c => c.rank === 6)!;
    s.players.forEach(p => p.hand = []);
    s.players[s.turn].hand = [c];
    s.deck = [];
    s.centerPile = [];
    s.hiddenOpeningCardIds = [];
    s.captured[0] = all.filter(x => x.id !== c.id);
    s.lastCapturer = 0;
    s.pistis[2] = [{ cardId: 1, isJack: false }, { cardId: 9, isJack: true }];
    const n = step(s, c.id);
    expect(n.result?.scores).toEqual([51, 0, 51, 0]);
    const v = d.viewFor(n, 0);
    expect(v.players.map(p => p.team)).toEqual([0, 1, 0, 1]);
    expect(v.players[0].capturedCount).toBe(52);
    expect(v.players[2].pistiCount).toBe(2);
});
