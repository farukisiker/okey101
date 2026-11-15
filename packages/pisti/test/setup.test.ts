import { expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { shuffleDeck } from '@kahve/cards';
import { create, defaultOptions, normalizeOptions } from '../src';
it.each([2, 4] as const)('PIS-T01/02 deterministic setup %i', seats => {
    for (let round = 0; round < 4; round++) {
        const s = create(normalizeOptions({ seats }), [], seededRng(7), round);
        expect(s).toEqual(create(normalizeOptions({ seats }), [], seededRng(7), round));
        expect(s.dealer).toBe(round % seats);
        expect(s.turn).toBe((round + 1) % seats);
        expect(s.deck.length).toBe(seats === 2 ? 40 : 32);
        expect(s.players.every(p => p.hand.length === 4)).toBe(true);
        expect(new Set([...s.deck, ...s.centerPile, ...s.players.flatMap(p => p.hand)].map(c => c.id)).size).toBe(52);
        expect(s.centerPile[3].rank).not.toBe(11);
    }
});
it('options validation', () => {
    expect(normalizeOptions(null)).toEqual(defaultOptions);
    expect(normalizeOptions({ seats: 4 }).partnerMode).toBe(false);
    expect(normalizeOptions({ partnerMode: true }).partnerMode).toBe(false);
    expect(normalizeOptions({ seats: 4, partnerMode: true, targetScore: 51, pistiPoints: 0 })).toMatchObject({ partnerMode: true, targetScore: 51, pistiPoints: 0 });
    for (const n of [-1, 1.5, Infinity, NaN, Number.MAX_SAFE_INTEGER + 1, '10'])
        expect(normalizeOptions({ pistiPoints: n, extra: 1 })).toEqual(defaultOptions);
    expect(normalizeOptions({ seats: 3, targetScore: 201, hiddenCards: false, openingJack: 0 })).toEqual(defaultOptions);
});
it('consecutive opening jacks redraw without additional RNG', () => {
    let seed = 0;
    while (true) {
        const d = shuffleDeck(seededRng(seed));
        if (d[3].rank === 11 && d[4].rank === 11)
            break;
        seed++;
    }
    let calls = 0;
    const rng = seededRng(seed);
    const s = create(defaultOptions, [], () => { calls++; return rng(); });
    expect(calls).toBe(51);
    expect(s.centerPile[3].rank).not.toBe(11);
    const a = create(normalizeOptions({ openingJack: 'allow' }), [], seededRng(seed));
    expect(a.centerPile[3].rank).toBe(11);
    expect(s.centerPile.slice(0, 3)).toEqual(a.centerPile.slice(0, 3));
});
