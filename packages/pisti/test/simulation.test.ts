import { expect, it } from 'vitest';
import { seededRng, type BotLevel } from '@kahve/core';
import { pistiDef as d, type PistiState } from '../src';
import { clone } from '../src/clone';
function conservation(s: PistiState) { const cards = [...s.deck, ...s.centerPile, ...s.captured.flat(), ...s.players.flatMap(p => p.hand)]; expect(cards).toHaveLength(52); expect(new Set(cards.map(c => c.id)).size).toBe(52); }
it('200 seeds: all modes and levels finish, conserve 52 cards, zero illegal moves, JSON continuation', () => {
    let completed = 0, invalid = 0;
    const modes = [{ seats: 2 }, { seats: 4 }, { seats: 4, partnerMode: true }];
    const levels: BotLevel[] = ['easy', 'medium', 'hard'];
    const distribution = Array.from({ length: 3 }, () => [0, 0, 0]);
    for (let seed = 0; seed < 200; seed++) {
        const mode = seed % 3, levelIndex = Math.floor(seed / 3) % 3, level = levels[levelIndex];
        distribution[mode][levelIndex]++;
        let s = d.create(d.normalizeOptions({ ...modes[mode], hiddenCards: seed % 2 ? 'secret' : 'reveal', openingJack: seed % 2 ? 'allow' : 'redraw' }), [], seededRng(seed), seed % 4);
        let copy: PistiState = JSON.parse(JSON.stringify(s));
        const rng = seededRng(seed + 1000), copyRng = seededRng(seed + 1000);
        const original = clone(s);
        while (!d.roundOver(s)) {
            conservation(s);
            expect(s.turnNumber).toBeLessThan(49);
            const a = d.botMove(s, s.turn, level, rng), b = d.botMove(copy, copy.turn, level, copyRng);
            expect(a).toEqual(b);
            expect(d.isAction(a)).toBe(true);
            expect(d.viewFor(s, s.turn).playableCardIds).toContain(a.cardId);
            expect(d.apply(s, s.turn, d.quickMove(s, s.turn)).ok).toBe(true);
            const before = clone(s), r = d.apply(s, s.turn, a), r2 = d.apply(copy, copy.turn, b);
            expect(s).toEqual(before);
            if (!r.ok || !r2.ok) {
                invalid++;
                throw Error('illegal bot move');
            }
            s = r.state;
            copy = JSON.parse(JSON.stringify(r2.state));
            expect(s).toEqual(copy);
        }
        conservation(s);
        expect(s.turnNumber).toBe(48);
        expect(d.turn(s)).toBeNull();
        expect(d.scoreRound(s)).toEqual(d.scoreRound(copy));
        expect(s.captured.flat().length + s.centerPile.length).toBe(52);
        expect(s.deck).toEqual([]);
        expect(s.players.every(p => p.hand.length === 0)).toBe(true);
        if (s.options.partnerMode) {
            const p = d.scoreRound(s);
            expect(p[0]).toBe(p[2]);
            expect(p[1]).toBe(p[3]);
        }
        expect(original.turnNumber).toBe(0);
        completed++;
    }
    expect(completed).toBe(200);
    expect(invalid).toBe(0);
    expect(distribution.flat().every(n => n >= 22)).toBe(true);
    console.log('200 seed: 200 tamamlandı; 0 geçersiz hamle; her adımda 52 benzersiz kart; 3 mod x 3 seviye: ' + JSON.stringify(distribution));
}, 60000);
