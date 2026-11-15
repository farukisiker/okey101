import type { Card } from '@kahve/cards';
import type { PistiOptions, PistiState } from './types';
export function cardPoints(c: Card, o: PistiOptions): number {
    return c.rank === 14 ? o.acePoints : c.rank === 11 ? o.jackPoints : c.suit === 'C' && c.rank === 2 ? o.clubTwoPoints : c.suit === 'D' && c.rank === 10 ? o.diamondTenPoints : 0;
}
export function calculateScores(s: PistiState): number[] {
    const team = (seat: number) => s.options.partnerMode ? seat % 2 : seat;
    const count = Array(s.options.partnerMode ? 2 : s.options.seats).fill(0) as number[];
    const scores = count.slice();
    s.captured.forEach((cards, seat) => { count[team(seat)] += cards.length; scores[team(seat)] += cards.reduce((n, c) => n + cardPoints(c, s.options), 0); });
    s.pistis.forEach((ps, seat) => { scores[team(seat)] += ps.reduce((n, p) => n + (p.isJack ? s.options.jackPistiPoints : s.options.pistiPoints), 0); });
    const max = Math.max(...count);
    if (count.filter(n => n === max).length === 1)
        scores[count.indexOf(max)] += s.options.mostCardsPoints;
    return s.players.map(p => scores[team(p.seat)]);
}
export function scoreRound(s: PistiState): number[] { return s.result ? s.result.scores.slice() : Array(s.options.seats).fill(0); }
export function matchOver(totals: number[], _rounds: number, opts: PistiOptions): boolean {
    const scores = totals.slice(0, opts.partnerMode ? 2 : opts.seats), max = Math.max(...scores);
    return max >= opts.targetScore && scores.filter(n => n === max).length === 1;
}
