import { describe, expect, it } from 'vitest';
import { apply, ERR, legalCards, legalCardsFor, trickWinner } from '../src/rules';
import { defaultOptions } from '../src/options';
import type { BatakState } from '../src/types';
import { c, cs, playing } from './helpers';

const ids = (s: BatakState, seat: number) => legalCardsFor(s, seat).map(x => x.id).sort((a, b) => a - b);
const idsOf = (...labels: string[]) => cs(...labels).map(x => x.id).sort((a, b) => a - b);
const play = (s: BatakState, seat: number, label: string) => apply(s, seat, { type: 'play', cardId: c(label).id });
const filler = ['C2'];

describe('legal cards', () => {
  it('BAT-T06: no trump lead before trump is broken', () => {
    const s = playing({ hands: [['S14', 'H5'], filler, filler, filler], trump: 'S', turn: 0 });
    expect(play(s, 0, 'S14')).toEqual({ ok: false, error: 'Koz kırılmadan koz çıkılamaz' });
    expect(ids(s, 0)).toEqual(idsOf('H5'));
    expect(play(s, 0, 'H5').ok).toBe(true);
  });
  it('trumpLeadNeedsBreak=false allows a trump lead', () => {
    const s = playing({ hands: [['S14', 'H5'], filler, filler, filler], trump: 'S', turn: 0, opts: { trumpLeadNeedsBreak: false } });
    expect(play(s, 0, 'S14').ok).toBe(true);
  });
  it('BAT-T07: only trumps left -> may lead trump, which breaks trump', () => {
    const s = playing({ hands: [['S2', 'S7', 'S9'], filler, filler, filler], trump: 'S', turn: 0 });
    const r = play(s, 0, 'S7');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.trumpBroken).toBe(true);
  });
  it('BAT-T08: must follow suit', () => {
    const s = playing({ hands: [[], ['H3', 'S14'], filler, filler], trump: 'S', turn: 1, trick: [[0, 'H7']] });
    expect(play(s, 1, 'S14')).toEqual({ ok: false, error: 'Yerdeki renge uymak zorundasınız' });
    expect(play(s, 1, 'H3').ok).toBe(true);
  });
  it('BAT-T09: must raise the led suit if able (mustRaise)', () => {
    const s = playing({ hands: [[], ['D4', 'D12'], filler, filler], trump: 'S', turn: 1, trick: [[0, 'D8']] });
    expect(play(s, 1, 'D4')).toEqual({ ok: false, error: 'Yerdeki kartı büyütmek zorundasınız' });
    expect(play(s, 1, 'D12').ok).toBe(true);
    const off = playing({ hands: [[], ['D4', 'D12'], filler, filler], trump: 'S', turn: 1, trick: [[0, 'D8']], opts: { mustRaise: false } });
    expect(play(off, 1, 'D4').ok).toBe(true);
  });
  it('raise compares against the highest led card on the table, and no raise needed if unable', () => {
    const s = playing({ hands: [[], [], ['D9', 'D13', 'D3'], filler], trump: 'S', turn: 2, trick: [[0, 'D8'], [1, 'D12']] });
    expect(ids(s, 2)).toEqual(idsOf('D13'));
    const t = playing({ hands: [[], [], ['D9', 'D3'], filler], trump: 'S', turn: 2, trick: [[0, 'D8'], [1, 'D12']] });
    expect(ids(t, 2)).toEqual(idsOf('D9', 'D3'));
  });
  it('BAT-T10: led suit already trumped -> no obligation to raise it', () => {
    const s = playing({ hands: [[], [], ['D4', 'D14'], filler], trump: 'S', turn: 2, trick: [[0, 'D8'], [1, 'S2']], trumpBroken: true });
    expect(play(s, 2, 'D4').ok).toBe(true);
    expect(ids(s, 2)).toEqual(idsOf('D4', 'D14'));
  });
  it('trump led: following with trump must still raise', () => {
    const s = playing({ hands: [[], ['S3', 'S12', 'H5'], filler, filler], trump: 'S', turn: 1, trick: [[0, 'S10']], trumpBroken: true });
    expect(ids(s, 1)).toEqual(idsOf('S12'));
  });
  it('BAT-T11: void in led suit -> must trump', () => {
    const s = playing({ hands: [[], ['S3', 'D2'], filler, filler], trump: 'S', turn: 1, trick: [[0, 'C10']] });
    expect(play(s, 1, 'D2')).toEqual({ ok: false, error: 'Elinizde dönen renk yoksa koz atmak zorundasınız' });
    const r = play(s, 1, 'S3');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.trumpBroken).toBe(true); // BAT-T22
  });
  it('BAT-T12: must overtrump if able', () => {
    const s = playing({ hands: [[], [], ['S3', 'S9'], filler], trump: 'S', turn: 2, trick: [[0, 'C10'], [1, 'S6']], trumpBroken: true });
    expect(play(s, 2, 'S3')).toEqual({ ok: false, error: 'Yerdeki kozu büyütmek zorundasınız' });
    expect(play(s, 2, 'S9').ok).toBe(true);
  });
  it('BAT-T13: must trump even when unable to overtrump (voidTrump always)', () => {
    const s = playing({ hands: [[], [], ['S4', 'D2'], filler], trump: 'S', turn: 2, trick: [[0, 'C10'], [1, 'S13']], trumpBroken: true });
    expect(play(s, 2, 'D2')).toEqual({ ok: false, error: ERR.mustTrump });
    expect(play(s, 2, 'S4').ok).toBe(true);
  });
  it('BAT-T14: neither led suit nor trump -> any card', () => {
    const s = playing({ hands: [[], ['H2', 'D9', 'H11'], filler, filler], trump: 'S', turn: 1, trick: [[0, 'C10']] });
    expect(ids(s, 1)).toEqual(idsOf('H2', 'D9', 'H11'));
  });
  it("voidTrump 'ifCanOvertrump'", () => {
    const opts = { voidTrump: 'ifCanOvertrump' as const };
    // cannot overtrump -> free
    const a = playing({ hands: [[], [], ['S4', 'D2'], filler], trump: 'S', turn: 2, trick: [[0, 'C10'], [1, 'S13']], trumpBroken: true, opts });
    expect(ids(a, 2)).toEqual(idsOf('S4', 'D2'));
    // can overtrump -> must
    const b = playing({ hands: [[], [], ['S4', 'S14', 'D2'], filler], trump: 'S', turn: 2, trick: [[0, 'C10'], [1, 'S13']], trumpBroken: true, opts });
    expect(ids(b, 2)).toEqual(idsOf('S14'));
    expect(play(b, 2, 'D2')).toEqual({ ok: false, error: ERR.overtrump });
    expect(play(b, 2, 'S4')).toEqual({ ok: false, error: ERR.overtrump });
    // no trump on the table yet -> any trump wins, so trumping is required
    const c0 = playing({ hands: [[], ['S4', 'D2'], filler, filler], trump: 'S', turn: 1, trick: [[0, 'C10']], opts });
    expect(ids(c0, 1)).toEqual(idsOf('S4'));
    expect(play(c0, 1, 'D2')).toEqual({ ok: false, error: ERR.mustTrump });
    // mustRaise off: any trump when able to overtrump
    const d = playing({ hands: [[], [], ['S4', 'S14', 'D2'], filler], trump: 'S', turn: 2, trick: [[0, 'C10'], [1, 'S13']], trumpBroken: true, opts: { ...opts, mustRaise: false } });
    expect(ids(d, 2)).toEqual(idsOf('S4', 'S14'));
  });
  it("voidTrump 'never': any card when void", () => {
    const s = playing({ hands: [[], ['S3', 'D2'], filler, filler], trump: 'S', turn: 1, trick: [[0, 'C10']], opts: { voidTrump: 'never' } });
    expect(ids(s, 1)).toEqual(idsOf('S3', 'D2'));
  });
  it("mustRaise off with voidTrump 'always': any trump", () => {
    const s = playing({ hands: [[], [], ['S3', 'S9', 'D2'], filler], trump: 'S', turn: 2, trick: [[0, 'C10'], [1, 'S6']], trumpBroken: true, opts: { mustRaise: false } });
    expect(ids(s, 2)).toEqual(idsOf('S3', 'S9'));
  });
  it('legalCards is pure', () => {
    const hand = cs('H2', 'H9');
    const trick = [{ seat: 0, card: c('H5') }];
    const before = JSON.stringify([hand, trick]);
    expect(legalCards(hand, trick, 'S', false, defaultOptions).map(x => x.id)).toEqual([c('H9').id]);
    expect(JSON.stringify([hand, trick])).toBe(before);
  });
  it('card not in hand / not my turn', () => {
    const s = playing({ hands: [['H5'], filler, filler, filler], trump: 'S', turn: 0 });
    expect(play(s, 0, 'H6')).toEqual({ ok: false, error: ERR.noCard });
    expect(play(s, 1, 'C2')).toEqual({ ok: false, error: ERR.wrongTurn });
  });
});

describe('tricks', () => {
  it('BAT-T21: lowest trump beats the led ace; winner leads next', () => {
    expect(trickWinner([{ seat: 0, card: c('H10') }, { seat: 1, card: c('H14') }, { seat: 2, card: c('S2') }, { seat: 3, card: c('H13') }], 'S')).toBe(2);
    let s = playing({ hands: [['H10', 'C3'], ['H14', 'C4'], ['S2', 'C5'], ['H13', 'C6']], trump: 'S', turn: 0 });
    for (const [seat, label] of [[0, 'H10'], [1, 'H14'], [2, 'S2'], [3, 'H13']] as const) {
      const r = play(s, seat, label);
      if (!r.ok) throw new Error(r.error);
      s = r.state;
    }
    expect(s.turn).toBe(2);
    expect(s.tricksWon).toEqual([0, 0, 1, 0]);
    expect(s.currentTrick).toEqual([]);
    expect(s.tricks[0]).toMatchObject({ leader: 0, winner: 2 });
    expect(s.trumpBroken).toBe(true);
    // BAT-T22: after trump is broken the winner may lead trump even holding other suits
    s.players[2].hand = cs('S9', 'C5');
    expect(ids(s, 2)).toEqual(idsOf('S9', 'C5'));
  });
  it('off-suit discards never win', () => {
    expect(trickWinner([{ seat: 1, card: c('D3') }, { seat: 2, card: c('C14') }, { seat: 3, card: c('H14') }, { seat: 0, card: c('D4') }], 'S')).toBe(0);
  });
});
