import { expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { fullDeck } from '@kahve/cards';
import { apply, botMove, create, defaultOptions, quickMove, viewFor } from '../src';
const c = (rank: number, suit = 'S') => fullDeck().find(c => c.rank === rank && c.suit === suit)!;
function view(center: ReturnType<typeof c>[], hand: ReturnType<typeof c>[]) { const s = create(defaultOptions, [], seededRng(1)); s.centerPile = center; s.players[s.turn].hand = hand; return viewFor(s, s.turn); }
it('PIS-T24/25 hard takes jack pisti and saves jack on empty center', () => {
    const v = view([c(11)], [c(11, 'H'), c(4, 'C')]);
    expect(botMove(v, 'hard', seededRng(1)).cardId).toBe(c(11, 'H').id);
    expect(botMove(view([], [c(11), c(5, 'D')]), 'hard', seededRng(1)).cardId).toBe(c(5, 'D').id);
});
it('quick deterministic pisti / matching / jack priority', () => {
    for (const [center, hand, wanted] of [[[c(7)], [c(7, 'H'), c(11)], c(7, 'H')], [[c(3), c(7)], [c(7, 'H'), c(11)], c(7, 'H')], [[c(7)], [c(5), c(11)], c(11)]] as const) {
        const v = view([...center], [...hand]);
        expect(quickMove(v).cardId).toBe(wanted.id);
        expect(quickMove(v)).toEqual(quickMove(v));
    }
});
it('medium/hard count public cards to choose an exhausted rank and save cheap jack', () => {
    const v = view([], [c(8), c(5), c(11)]);
    v.publicHistory = ['H', 'D', 'C'].map((s, i) => ({ turnNumber: i, seat: 0, card: c(8, s), revealedCards: [] }));
    for (const level of ['medium', 'hard'] as const) {
        expect(botMove(v, level, seededRng(1)).cardId).toBe(c(8).id);
        expect(botMove(view([c(2), c(4)], [c(5), c(11)]), level, seededRng(1)).cardId).toBe(c(5).id);
    }
});
it('easy uses supplied RNG', () => { const v = view([], [c(4), c(5)]); expect(botMove(v, 'easy', () => 0).cardId).toBe(c(4).id); expect(botMove(v, 'easy', () => 0.99).cardId).toBe(c(5).id); });

// Real capture boundaries: the opening-taking jack must never remain in the pile.
function afterOpeningCapture(lastRank = 4, jackPoints = 1) {
    let s = create({ ...defaultOptions, jackPoints }, [], seededRng(1));
    s.centerPile = [c(6, 'C'), c(7, 'C'), c(8, 'C'), c(9, 'C')];
    s.openingCard = s.centerPile[3];
    s.hiddenOpeningCardIds = s.centerPile.slice(0, 3).map(c => c.id);
    s.players[1].hand = [c(11), c(3), c(11, 'H'), c(5, 'D')];
    s.players[0].hand = [c(2), c(lastRank), c(6), c(7)];
    const used = new Set([...s.centerPile, ...s.players.flatMap(p => p.hand)].map(c => c.id));
    s.deck = fullDeck().filter(c => !used.has(c.id));
    for (const card of [c(11), c(2), c(3), c(lastRank)]) {
        const r = apply(s, s.turn, { type: 'play', cardId: card.id });
        if (!r.ok) throw Error(r.error);
        s = r.state;
    }
    return s;
}
it.each(['medium', 'hard'] as const)('%s excludes the opening-taking jack from current pile value', level => {
    const s = afterOpeningCapture(4, level === 'medium' ? 3 : 1);
    s.captured[(s.turn + 1) % 2].push(...s.deck.splice(0, 6));
    expect(s.centerPile).toEqual([c(2), c(3), c(4)]);
    expect(s.publicHistory.map(e => e.card)).toEqual([c(11), c(2), c(3), c(4)]);
    // Counting the captured jack would make spending the remaining jack attractive.
    expect(botMove(viewFor(s, s.turn), level, seededRng(1)).cardId).toBe(c(5, 'D').id);
});
it('medium saves a jack while hard takes an ace pile to contest card majority', () => {
    const s = afterOpeningCapture(14);
    s.captured[(s.turn + 1) % 2].push(...s.deck.splice(0, 6));
    const v = viewFor(s, s.turn);
    // Three cards plus an ace: medium conserves the jack; hard also values
    // catching up from five captures against the rival's six captured cards.
    expect(v.players[s.turn].capturedCount).toBe(5);
    expect(v.players[(s.turn + 1) % 2].capturedCount).toBe(6);
    expect(botMove(v, 'medium', seededRng(1)).cardId).toBe(c(5, 'D').id);
    expect(botMove(v, 'hard', seededRng(1)).cardId).toBe(c(11, 'H').id);
});

it.each(['medium', 'hard'] as const)('%s remembers the covered opening rank as public knowledge', level => {
    const v = view([], [c(8), c(5)]);
    v.openingCard = c(8, 'C');
    v.publicHistory = [c(8, 'H'), c(5, 'H')].map((card, turnNumber) => ({ turnNumber, seat: 0, card, revealedCards: [] }));
    expect(botMove(v, level, seededRng(1)).cardId).toBe(c(8).id);
    // Old consumers may omit the additive field; their views still work.
    delete v.openingCard;
    expect(botMove(v, level, seededRng(1)).cardId).toBe(c(5).id);
});
