import { expect, it } from 'vitest';
import { fullDeck, type Card } from '@kahve/cards';
import { seededRng } from '@kahve/core';
import { apply, calculateScores, create, defaultOptions, isAction, matchOver, normalizeOptions, type PistiState } from '../src';
import { clone } from '../src/clone';
export const card = (rank: number, suit = 'S'): Card => fullDeck().find(c => c.rank === rank && c.suit === suit)!;
export function fixture(center: Card[], hand: Card[]): PistiState {
    const s = create(defaultOptions, [], seededRng(1));
    s.turn = 1;
    s.centerPile = center;
    s.hiddenOpeningCardIds = [];
    s.players[1].hand = hand;
    s.players[0].hand = [card(3, 'C')];
    return s;
}
export function play(s: PistiState, id: number): PistiState { const r = apply(s, s.turn, { type: 'play', cardId: id }); expect(r.ok).toBe(true); if (!r.ok)
    throw Error(r.error); return r.state; }
it.each([
    ['PIS-T03', [card(2), card(3), card(4), card(7)], card(7, 'H'), 0],
    ['PIS-T04', [card(2), card(3), card(4), card(11)], card(11, 'H'), 0],
    ['PIS-T05', [card(8, 'D')], card(8, 'C'), 10],
    ['PIS-T06', [card(10, 'D')], card(11), 0],
    ['PIS-T07', [card(11, 'D')], card(11, 'C'), 20],
    ['PIS-T09', [card(10)], card(10, 'D'), 10],
    ['PIS-T10', [card(2, 'H')], card(2, 'C'), 10],
    ['PIS-T11', [card(14)], card(14, 'D'), 10],
] as const)('%s capture and separate bonus', (_id, center, c, bonus) => {
    const s = fixture([...center], [c]), before = clone(s), n = play(s, c.id);
    expect(s).toEqual(before);
    expect(n.centerPile).toEqual([]);
    expect(n.captured[1]).toHaveLength(center.length + 1);
    expect(n.lastCapture?.points).toBe(bonus);
    expect(n.pistis[1]).toHaveLength(bonus ? 1 : 0);
    const score = calculateScores(n)[1] - defaultOptions.mostCardsPoints;
    const expected = bonus + [...center, c].reduce((v, c) => v + (c.rank === 14 || c.rank === 11 ? 1 : c.suit === 'D' && c.rank === 10 ? 3 : c.suit === 'C' && c.rank === 2 ? 2 : 0), 0);
    expect(score).toBe(expected);
});
it('PIS-T08 empty center jack stays', () => { const n = play(fixture([], [card(11)]), card(11).id); expect(n.centerPile).toEqual([card(11)]); expect(n.lastCapture).toBeNull(); });
it('PIS-T12 refill preserves center and starts after dealer', () => {
    const s = fixture([card(6)], [card(7)]);
    s.players[0].hand = [];
    const deck = s.deck.slice();
    const n = play(s, card(7).id);
    expect(n.deck.length).toBe(s.deck.length - 8);
    expect(n.centerPile).toEqual([card(6), card(7)]);
    expect(n.players[1].hand.map(c => c.id).sort()).toEqual(deck.slice(0, 4).map(c => c.id).sort());
    expect(n.turn).toBe(0);
});
it.each([{ center: [] }, { center: [card(6), card(8)] }])('PIS-T13/14 leftovers do not create a capture event or pisti', ({ center }) => {
    const s = fixture(center, [card(7)]);
    s.deck = [];
    s.players[0].hand = [];
    s.lastCapturer = 0;
    const n = play(s, card(7).id);
    expect(n.phase).toBe('finished');
    expect(n.centerPile).toEqual([]);
    expect(n.captured[0]).toHaveLength(center.length + 1);
    expect(n.lastCapture).toBeNull();
    expect(n.pistis.flat()).toEqual([]);
});
it('no capturer leaves center with zero scores', () => { const s = fixture([], [card(7)]); s.deck = []; s.players[0].hand = []; const n = play(s, card(7).id); expect(n.result?.scores).toEqual([0, 0]); expect(n.centerPile).toEqual([card(7)]); });
it.each([[27, 25], [26, 26], [20, 6, 20, 6], [14, 11, 16, 11]])('PIS-T15/16/17/18 majority %j', (...counts) => {
    const s = create(normalizeOptions({ seats: counts.length, partnerMode: counts[0] === 14 }), [], seededRng(1));
    let offset = 0;
    const d = fullDeck();
    s.captured = counts.map(n => { const cards = d.slice(offset, offset + n); offset += n; return cards; });
    if (s.options.partnerMode)
        s.pistis[0] = [{ cardId: 1, isJack: false }];
    const scores = calculateScores(s);
    expect(scores.reduce((a, b) => a + b, 0)).toBe(s.options.partnerMode ? 52 : counts[0] === 27 ? 16 : 13);
    if (s.options.partnerMode) {
        expect(scores[0]).toBe(scores[2]);
        expect(scores[1]).toBe(scores[3]);
    }
});
it('PIS-T19/20 malformed and unauthorized actions return errors without mutation', () => {
    const s = create(defaultOptions, [], seededRng(3)), before = clone(s);
    for (const a of [null, {}, [], { type: 'play', cardId: 52 }, { type: 'play', cardId: 1.5 }, { type: 'play', cardId: '2' }]) {
        expect(isAction(a)).toBe(false);
        expect(apply(s, s.turn, a as never).ok).toBe(false);
    }
    for (const seat of [-1, 4, NaN, 0.5, 0])
        expect(apply(s, seat, { type: 'play', cardId: s.players[1].hand[0].id }).ok).toBe(false);
    expect(apply(s, 1, { type: 'play', cardId: s.deck[0].id })).toEqual({ ok: false, error: 'Kart elinizde değil' });
    expect(s).toEqual(before);
});
it('PIS-T21/22 targets, unique leader, partner representatives', () => {
    expect(matchOver([154, 158], 1, defaultOptions)).toBe(true);
    expect(matchOver([152, 152], 999, defaultOptions)).toBe(false);
    for (const targetScore of [51, 101, 151]) {
        const o = normalizeOptions({ seats: 4, partnerMode: true, targetScore });
        expect(matchOver([targetScore, 0, targetScore, 0], 1, o)).toBe(true);
        expect(matchOver([targetScore - 1, 0, 999, 999], 1, o)).toBe(false);
    }
});
