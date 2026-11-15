import { describe, expect, it } from 'vitest';
import { apply, ERR, isAction } from '../src/rules';
import type { BatakAction, BatakState } from '../src/types';
import { fresh } from './helpers';

/** Applies actions in turn order; throws on the first rejection. */
function run(s: BatakState, ...actions: BatakAction[]): BatakState {
  for (const a of actions) {
    const r = apply(s, s.turn, a);
    if (!r.ok) throw new Error(r.error);
    s = r.state;
  }
  return s;
}
const bid = (amount: number): BatakAction => ({ type: 'bid', amount });
const pass: BatakAction = { type: 'pass' };

describe('bidding', () => {
  it('BAT-T02: bid under minBid is rejected', () => {
    const s = fresh();
    expect(apply(s, 0, bid(4))).toEqual({ ok: false, error: 'İhale en az 5 olmalı' });
    expect(apply(fresh(1, { minBid: 4 }), 0, bid(4)).ok).toBe(true);
  });
  it('BAT-T03: must raise the highest bid', () => {
    const s = run(fresh(), bid(6));
    expect(apply(s, 1, bid(6))).toEqual({ ok: false, error: 'Mevcut ihaleden yüksek söylemelisiniz' });
    expect(apply(s, 1, bid(14))).toEqual({ ok: false, error: ERR.maxBid });
    expect(apply(s, 1, bid(7)).ok).toBe(true);
  });
  it('BAT-T04: a passed player never bids again (turn skips them)', () => {
    let s = run(fresh(), pass, bid(5), bid(6), bid(7));
    expect(s.turn).toBe(1); // seat 0 skipped
    expect(apply(s, 0, bid(9)).ok).toBe(false);
    s = run(s, bid(8));
    expect(s.turn).toBe(2);
    expect(s.passed[0]).toBe(true);
  });
  it('BAT-T05: first three pass -> last seat (dealer) gets the forced 4', () => {
    const s = run(fresh(), pass, pass, pass);
    expect(s.phase).toBe('selectingTrump');
    expect(s.declarer).toBe(3);
    expect(s.dealer).toBe(3);
    expect(s.contract).toBe(4);
    expect(s.forcedBid).toBe(true);
    expect(s.turn).toBe(3);
    // round 1: dealer is seat 0
    const r1 = run(fresh(1, {}, 1), pass, pass, pass);
    expect(r1.declarer).toBe(0);
    expect(run(fresh(1, { forcedDealerBid: 5 }), pass, pass, pass).contract).toBe(5);
  });
  it('three passes after a bid give the contract to the high bidder', () => {
    const s = run(fresh(), bid(5), bid(6), pass, pass, pass);
    expect(s.phase).toBe('selectingTrump');
    expect(s.declarer).toBe(1);
    expect(s.contract).toBe(6);
    expect(s.forcedBid).toBe(false);
    expect(s.bids).toEqual([5, 6, null, null]);
  });
  it('the high bidder can be outbid and must raise or pass when it comes back', () => {
    const s = run(fresh(), bid(5), bid(6), pass, pass);
    expect(s.turn).toBe(0);
    const t = run(s, bid(7), pass);
    expect(t.declarer).toBe(0);
    expect(t.contract).toBe(7);
  });
  it('a bid of 13 ends bidding at once', () => {
    const s = run(fresh(), bid(13));
    expect(s.phase).toBe('selectingTrump');
    expect(s.declarer).toBe(0);
    expect(s.contract).toBe(13);
  });
  it('trump selection: only the declarer, then the declarer leads', () => {
    const s = run(fresh(), bid(5), pass, pass, pass);
    expect(apply(s, 1, { type: 'selectTrump', suit: 'H' }).ok).toBe(false);
    expect(apply(s, 0, { type: 'pass' })).toEqual({ ok: false, error: ERR.wrongPhase });
    const t = run(s, { type: 'selectTrump', suit: 'H' });
    expect(t.phase).toBe('playing');
    expect(t.trump).toBe('H');
    expect(t.turn).toBe(0);
    expect(apply(t, 0, bid(6))).toEqual({ ok: false, error: ERR.wrongPhase });
  });
  it('wrong phase / wrong turn / bad input', () => {
    const s = fresh();
    expect(apply(s, 1, pass)).toEqual({ ok: false, error: ERR.wrongTurn });
    expect(apply(s, 0, { type: 'play', cardId: s.players[0].hand[0].id })).toEqual({ ok: false, error: ERR.wrongPhase });
    expect(apply(s, 0, { type: 'selectTrump', suit: 'S' })).toEqual({ ok: false, error: ERR.wrongPhase });
    expect(apply(s, 7, pass).ok).toBe(false);
    expect(apply(s, 0, { type: 'bid', amount: 5.5 } as BatakAction).ok).toBe(false);
    expect(apply(s, 0, null as never).ok).toBe(false);
    expect(apply(null as never, 0, pass).ok).toBe(false);
  });
  it('turnNumber and lastAction advance on every accepted action', () => {
    const s = run(fresh(), bid(5));
    expect(s.turnNumber).toBe(1);
    expect(s.lastAction).toEqual({ turnNumber: 0, seat: 0, action: bid(5) });
  });
  it('isAction', () => {
    expect(isAction({ type: 'bid', amount: 5 })).toBe(true);
    expect(isAction({ type: 'pass' })).toBe(true);
    expect(isAction({ type: 'selectTrump', suit: 'D' })).toBe(true);
    expect(isAction({ type: 'play', cardId: 51 })).toBe(true);
    for (const bad of [null, 1, 'pass', [], {}, { type: 'bid' }, { type: 'bid', amount: '5' }, { type: 'selectTrump', suit: 'X' }, { type: 'play', cardId: 52 }, { type: 'play', cardId: -1 }, { type: 'declare', tricks: 3 }])
      expect(isAction(bad)).toBe(false);
  });
});
