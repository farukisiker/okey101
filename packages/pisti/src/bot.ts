import type { Card } from '@kahve/cards';
import type { BotLevel, Rng } from '@kahve/core';
import { cardPoints } from './scoring';
import type { PistiAction, PistiView } from './types';
/** Counts distinct public identities; revealed cards can also occur in later history. */
function knownCards(v: PistiView): Card[] {
    const cards = [...v.hand, ...(v.openingCard ? [v.openingCard] : []), ...v.publicHistory.flatMap(e => [e.card, ...e.revealedCards]), ...(v.topCard ? [v.topCard] : [])];
    return [...new Map(cards.map(c => [c.id, c])).values()];
}
function rankRisk(v: PistiView, c: Card): number {
    const unseen = 4 - knownCards(v).filter(k => k.rank === c.rank).length;
    return Math.max(0, unseen) * (c.rank === 11 ? v.options.jackPistiPoints : v.options.pistiPoints);
}
function choose(v: PistiView, level: 'quick' | 'medium' | 'hard'): PistiAction {
    const cards = v.hand.filter(c => v.playableCardIds.includes(c.id));
    const known = knownCards(v), unknown = 52 - known.length;
    // Each capture removes the played card too. The current pile therefore contains
    // only the last centerCount plays, or the opening plus all plays before capture.
    const openPile = v.centerCount === 0 ? [] : v.publicHistory.slice(-v.centerCount).map(e => e.card);
    if (v.openingCard && v.centerCount > v.publicHistory.length)
        openPile.unshift(v.openingCard);
    if (v.topCard && !openPile.some(c => c.id === v.topCard!.id))
        openPile.push(v.topCard);
    const pileValue = openPile.reduce((sum, c) => sum + cardPoints(c, v.options), 0);
    const next = (v.seat + 1) % v.options.seats, nextCount = v.players[next]?.handCount ?? 0;
    const rivalCount = v.players.filter(p => p.team !== v.players[v.seat]?.team).reduce((sum, p) => sum + p.capturedCount, 0);
    const ownCount = v.players.filter(p => p.team === v.players[v.seat]?.team).reduce((sum, p) => sum + p.capturedCount, 0);
    const score = (c: Card): number => {
        const match = v.topCard?.rank === c.rank, takes = !!v.topCard && (match || c.rank === 11);
        if (match && v.centerCount === 1)
            return 100000 + (c.rank === 11 ? v.options.jackPistiPoints : v.options.pistiPoints);
        if (level === 'quick')
            return takes ? (match ? 10000 : 9000) : -rankRisk(v, c);
        const risk = rankRisk(v, c);
        const probability = unknown > 0 ? Math.min(1, (4 - known.filter(k => k.rank === c.rank).length) * nextCount / unknown) : 0;
        let value = takes ? 100 + v.centerCount * 2 + pileValue * 5 : -(v.centerCount === 0 ? risk : 0);
        if (c.rank === 11)
            value -= takes ? 120 : 100;
        if (level === 'hard') {
            value -= !takes && v.centerCount === 0 ? probability * (c.rank === 11 ? v.options.jackPistiPoints : v.options.pistiPoints) * 4 : 0;
            if (takes)
                value += pileValue * 4 + (ownCount <= rivalCount ? v.centerCount * 2 : 0);
            // In partners, preserve a cheap pile captured most recently by our teammate.
            if (takes && v.options.partnerMode && v.lastCapture !== null && v.lastCapture.seat !== v.seat && v.lastCapture.seat % 2 === v.seat % 2 && pileValue === 0)
                value -= 25;
        }
        return value;
    };
    cards.sort((a, b) => score(b) - score(a) || a.rank - b.rank || a.id - b.id);
    // Host calls only for the active seat, which always has at least one legal card.
    return { type: 'play', cardId: cards[0]?.id ?? -1 };
}
export function quickMove(v: PistiView): PistiAction { return choose(v, 'quick'); }
export function botMove(v: PistiView, level: BotLevel, rng: Rng): PistiAction {
    if (level === 'easy') {
        const cards = v.playableCardIds;
        return { type: 'play', cardId: cards[Math.floor(rng() * cards.length)] ?? -1 };
    }
    return choose(v, level);
}
