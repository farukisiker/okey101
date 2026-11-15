import { expect, it } from 'vitest';
import { seededRng } from '@kahve/core';
import { apply, botMove, create, defaultOptions, normalizeOptions, viewFor } from '../src';
import { clone } from '../src/clone';
it('PIS-T23 view whitelist, valid/invalid seats, copied context and data', () => {
    const s = create(defaultOptions, [], seededRng(1));
    const before = clone(s);
    for (const seat of [-1, 0, 1, 2, 0.5]) {
        const v = viewFor(s, seat);
        expect(Object.keys(v).sort()).toEqual(['options', 'round', 'dealer', 'seat', 'turn', 'turnNumber', 'phase', 'hand', 'topCard', 'centerCount', 'deckCount', 'playableCardIds', 'players', 'openingCard', 'publicHistory', 'lastAction', 'lastCapture', 'result', 'clock'].sort());
        expect(v.centerCount).toBe(4);
        expect(v.topCard).toEqual(s.centerPile[3]);
        expect(v.clock).toBeNull();
        expect(v.hand).toEqual(seat === 0 || seat === 1 ? s.players[seat].hand : []);
        expect(v.playableCardIds).toEqual(seat === s.turn ? s.players[seat].hand.map(c => c.id) : []);
    }
    const ctx = { clock: { turnNumber: 0, deadline: 123, refilled: false }, now: 5 };
    const v = viewFor(s, 1, ctx);
    v.hand[0].rank = 2;
    v.options.pistiPoints = 99;
    v.players[0].name = 'changed';
    v.topCard!.rank = 2;
    v.clock!.deadline = 1;
    expect(s).toEqual(before);
    expect(ctx.clock.deadline).toBe(123);
});
it.each(['reveal', 'secret'] as const)('opening capture privacy %s, persistent history, bonus only events', hiddenCards => {
    let s = create(normalizeOptions({ hiddenCards }), [], seededRng(2));
    // Swap a jack from the deck into active hand, preserving all card identities.
    const jackIndex = s.deck.findIndex(c => c.rank === 11);
    [s.players[s.turn].hand[0], s.deck[jackIndex]] = [s.deck[jackIndex], s.players[s.turn].hand[0]];
    const hidden = s.centerPile.slice(0, 3), r = apply(s, s.turn, { type: 'play', cardId: s.players[s.turn].hand[0].id });
    expect(r.ok).toBe(true);
    if (!r.ok)
        return;
    s = r.state;
    for (const seat of [0, 1]) {
        const v = viewFor(s, seat);
        expect(v.lastAction?.revealedCards).toEqual(hiddenCards === 'reveal' ? hidden : []);
        expect(v.publicHistory[0].revealedCards).toEqual(v.lastAction?.revealedCards);
        expect(v.lastCapture?.points).toBe(0);
    }
    const old = s.lastCapture;
    const r2 = apply(s, s.turn, { type: 'play', cardId: s.players[s.turn].hand[0].id });
    if (!r2.ok)
        throw Error(r2.error);
    expect(r2.state.lastCapture).toEqual(old);
    expect(r2.state.lastAction?.turnNumber).toBe(1);
});
it('hidden permutation leaves views and every bot level identical with same RNG', () => {
    const s = create(normalizeOptions({ seats: 4, partnerMode: true, hiddenCards: 'secret' }), [], seededRng(9)), t = clone(s), seat = s.turn;
    const hidden = [...t.deck, ...t.players.filter(p => p.seat !== seat).flatMap(p => p.hand), ...t.centerPile.slice(0, 3)].reverse();
    let offset = 0;
    t.deck = hidden.slice(offset, offset += t.deck.length);
    t.players.filter(p => p.seat !== seat).forEach(p => { p.hand = hidden.slice(offset, offset += p.hand.length); });
    t.centerPile.splice(0, 3, ...hidden.slice(offset));
    t.hiddenOpeningCardIds = t.centerPile.slice(0, 3).map(c => c.id);
    expect(viewFor(t, seat)).toEqual(viewFor(s, seat));
    for (const level of ['easy', 'medium', 'hard'] as const)
        expect(botMove(viewFor(s, seat), level, seededRng(77))).toEqual(botMove(viewFor(t, seat), level, seededRng(77)));
});

it.each(['reveal', 'secret'] as const)('face-up opening survives covering and capture (%s)', hiddenCards => {
    let s = create(normalizeOptions({ hiddenCards }), [], seededRng(2));
    const opening = clone(s.centerPile[3]);
    const hidden = s.centerPile.slice(0, 3);
    const cover = s.players[s.turn].hand.find(c => c.rank !== 11 && c.rank !== opening.rank)!;
    for (const cardId of [cover.id, -1]) {
        let id = cardId;
        if (id === -1) {
            const jackIndex = s.deck.findIndex(c => c.rank === 11);
            [s.players[s.turn].hand[0], s.deck[jackIndex]] = [s.deck[jackIndex], s.players[s.turn].hand[0]];
            id = s.players[s.turn].hand[0].id;
        }
        const r = apply(s, s.turn, { type: 'play', cardId: id });
        if (!r.ok) throw Error(r.error);
        s = r.state;
        for (const seat of [-1, 0, 1]) {
            const v = viewFor(s, seat);
            expect(v.openingCard).toEqual(opening);
            expect(v.topCard).not.toEqual(opening);
            if (hiddenCards === 'secret') {
                const serialized = JSON.stringify(v);
                for (const card of hidden)
                    expect(serialized).not.toContain(JSON.stringify(card));
            }
            v.openingCard!.rank = 2;
            expect(s.openingCard).toEqual(opening);
        }
    }
});
