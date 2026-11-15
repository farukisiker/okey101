import { describe, expect, it } from 'vitest';
import { seededRng, shuffle } from '@kahve/core';
import { apply, legalCardsFor } from '../src/rules';
import { viewFor } from '../src/view';
import { clone } from '../src/clone';
import type { BatakState } from '../src/types';
import { fresh } from './helpers';

/** Plays a round with random legal moves (and a few bids), returning every state on the way. */
function trace(seed: number): BatakState[] {
  const rng = seededRng(seed);
  let s = fresh(seed, {}, seed % 4);
  const out = [s];
  while (s.phase !== 'finished') {
    let action;
    if (s.phase === 'bidding') action = rng() < 0.3 && s.highestBid < 13 ? { type: 'bid' as const, amount: Math.max(5, s.highestBid + 1) } : { type: 'pass' as const };
    else if (s.phase === 'selectingTrump') action = { type: 'selectTrump' as const, suit: (['S', 'H', 'D', 'C'] as const)[Math.floor(rng() * 4)] };
    else {
      const legal = legalCardsFor(s, s.turn);
      action = { type: 'play' as const, cardId: legal[Math.floor(rng() * legal.length)].id };
    }
    const r = apply(s, s.turn, action);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
    out.push(s);
  }
  return out;
}

const states = [1, 2, 3, 4, 5].flatMap(trace);

describe('viewFor', () => {
  it('shows fakeTypes-compatible fields', () => {
    const v = viewFor(fresh(3), 0);
    for (const k of ['phase', 'variant', 'seat', 'turn', 'hand', 'legalCardIds', 'players', 'minBid', 'highestBid', 'highestBidder', 'canPass', 'trump', 'trumpBroken', 'currentTrick', 'lastTrickWinner', 'round', 'targetRounds', 'result'])
      expect(v).toHaveProperty(k);
    expect(v.players[0]).toEqual({ seat: 0, name: 'Ali', handCount: 13, tricksWon: 0, bid: null, passed: false, isDeclarer: false });
    expect(v.hand).toHaveLength(13);
    expect(v.canPass).toBe(true);
    expect(v.legalCardIds).toEqual([]);
  });
  it('bid field: null = silent, 0 = passed without bidding, n = last bid', () => {
    let s = fresh();
    s = (apply(s, 0, { type: 'pass' }) as { state: BatakState }).state;
    s = (apply(s, 1, { type: 'bid', amount: 6 }) as { state: BatakState }).state;
    const v = viewFor(s, 2);
    expect(v.players.map(p => p.bid)).toEqual([0, 6, null, null]);
    expect(v.highestBidder).toBe(1);
  });
  it('BAT-T24: legalCardIds == exactly the cards apply accepts (all 52 ids, every state)', () => {
    for (const s of states) {
      if (s.phase !== 'playing') continue;
      const v = viewFor(s, s.turn);
      for (let id = 0; id < 52; id++) expect(apply(s, s.turn, { type: 'play', cardId: id }).ok).toBe(v.legalCardIds.includes(id));
      for (const other of [0, 1, 2, 3].filter(x => x !== s.turn)) expect(viewFor(s, other).legalCardIds).toEqual([]);
    }
  });
  it('BAT-T25 leak: no other hand card id appears in the view', () => {
    for (const s of states) {
      for (let seat = 0; seat < 4; seat++) {
        const v = viewFor(s, seat);
        const hidden = new Set(s.players.filter(p => p.seat !== seat).flatMap(p => p.hand.map(c => c.id)));
        const seen: number[] = [];
        const walk = (x: unknown): void => {
          if (Array.isArray(x)) x.forEach(walk);
          else if (x && typeof x === 'object') {
            const o = x as Record<string, unknown>;
            if (typeof o.id === 'number' && typeof o.suit === 'string') seen.push(o.id);
            Object.values(o).forEach(walk);
          }
        };
        walk(v);
        walk(v.legalCardIds.map(id => ({ id, suit: '?' })));
        for (const id of seen) expect(hidden.has(id)).toBe(false);
        expect(JSON.stringify(v)).not.toMatch(/seed|deck|rng/i);
      }
    }
  });
  it('permutation: reshuffling the other three hands leaves the view identical', () => {
    const rng = seededRng(99);
    for (const s of states.filter((_, i) => i % 7 === 0)) {
      for (let seat = 0; seat < 4; seat++) {
        const others = s.players.filter(p => p.seat !== seat);
        const pool = shuffle(others.flatMap(p => p.hand), rng);
        const t = clone(s);
        let k = 0;
        for (const p of t.players) if (p.seat !== seat) p.hand = pool.slice(k, (k += p.hand.length));
        expect(viewFor(t, seat)).toEqual(viewFor(s, seat));
      }
    }
  });
  it('JSON round-trip and no mutation', () => {
    for (const s of states.filter((_, i) => i % 11 === 0)) {
      const before = JSON.stringify(s);
      const v = viewFor(s, 1);
      expect(JSON.parse(JSON.stringify(v))).toEqual(v);
      expect(JSON.stringify(s)).toBe(before);
    }
  });
  it('finished round: turn null, last trick and result visible', () => {
    const end = trace(8).at(-1) as BatakState;
    const v = viewFor(end, 0);
    expect(v.turn).toBeNull();
    expect(v.canPass).toBe(false);
    expect(v.tricks).toHaveLength(13);
    expect(v.lastTrickWinner).toBe(end.tricks[12].winner);
    expect(v.result?.scores).toHaveLength(4);
  });
});
