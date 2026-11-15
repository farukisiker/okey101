import { afterEach, expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { pistiDef as d } from '../src';
import { clone } from '../src/clone';
const g = globalThis as { structuredClone?: unknown };
const native = g.structuredClone;
afterEach(() => { g.structuredClone = native; });
it('clone is a deep, detached JSON copy', () => {
    const src = { a: [{ id: 1 }], b: null as null, c: undefined as number | undefined };
    const out = clone(src);
    expect(out).toEqual({ a: [{ id: 1 }], b: null });
    out.a[0].id = 2;
    expect(src.a[0].id).toBe(1);
});
it('full round works without a global structuredClone (Hermes)', () => {
    delete g.structuredClone;
    expect(typeof g.structuredClone).toBe('undefined');
    for (const opts of [{ seats: 2 }, { seats: 4, partnerMode: true, hiddenCards: 'secret' }]) {
        let s = d.create(d.normalizeOptions(opts), [], seededRng(5), 0);
        const rng = seededRng(6);
        while (!d.roundOver(s)) {
            const v = d.viewFor(s, s.turn);
            expect(v.openingCard).toEqual(s.openingCard);
            const r = d.apply(s, s.turn, d.botMove(s, s.turn, 'hard', rng));
            if (!r.ok) throw Error(r.error);
            s = r.state;
        }
        expect(s.turnNumber).toBe(48);
        expect(d.scoreRound(s)).toHaveLength(s.options.seats);
    }
});
