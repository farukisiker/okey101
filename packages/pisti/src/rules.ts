import { sameRank } from '@kahve/cards';
import type { ApplyResult } from '@kahve/core';
import { clone } from './clone';
import { distribute } from './setup';
import { calculateScores } from './scoring';
import type { PistiAction, PistiState, PublicAction } from './types';
export function isAction(raw: unknown): raw is PistiAction {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
        return false;
    const a = raw as Record<string, unknown>;
    return a.type === 'play' && typeof a.cardId === 'number' && Number.isInteger(a.cardId) && a.cardId >= 0 && a.cardId < 52;
}
export function apply(state: PistiState, seat: number, action: PistiAction): ApplyResult<PistiState> {
    if (!Number.isInteger(seat) || seat < 0 || seat >= state.options.seats)
        return { ok: false, error: 'Geçersiz koltuk' };
    if (state.phase !== 'playing')
        return { ok: false, error: 'El bitti' };
    if (seat !== state.turn)
        return { ok: false, error: 'Sıra sizde değil' };
    if (!isAction(action))
        return { ok: false, error: 'Geçersiz hamle' };
    const index = state.players[seat].hand.findIndex(c => c.id === action.cardId);
    if (index < 0)
        return { ok: false, error: 'Kart elinizde değil' };
    const s: PistiState = clone(state);
    const card = s.players[seat].hand.splice(index, 1)[0], top = s.centerPile.at(-1);
    const takes = !!top && (card.rank === 11 || sameRank(card, top));
    const event: PublicAction = { turnNumber: s.turnNumber, seat, card: { ...card }, revealedCards: [] };
    if (takes) {
        const isPisti = s.centerPile.length === 1 && sameRank(card, top!);
        const isJackPisti = isPisti && card.rank === 11;
        if (s.options.hiddenCards === 'reveal')
            event.revealedCards = s.centerPile.filter(c => s.hiddenOpeningCardIds.includes(c.id)).map(c => ({ ...c }));
        s.hiddenOpeningCardIds = [];
        s.captured[seat].push(...s.centerPile, card);
        s.centerPile = [];
        s.lastCapturer = seat;
        if (isPisti)
            s.pistis[seat].push({ cardId: card.id, isJack: isJackPisti });
        s.lastCapture = { seat, cardId: card.id, isPisti, isJackPisti, points: isPisti ? (isJackPisti ? s.options.jackPistiPoints : s.options.pistiPoints) : 0 };
    }
    else
        s.centerPile.push(card);
    s.lastAction = event;
    s.publicHistory.push(event);
    s.turnNumber++;
    s.turn = (seat + 1) % s.options.seats;
    if (s.players.every(p => p.hand.length === 0)) {
        if (s.deck.length)
            distribute(s);
        else {
            if (s.lastCapturer !== null) {
                s.captured[s.lastCapturer].push(...s.centerPile);
                s.centerPile = [];
                s.hiddenOpeningCardIds = [];
            }
            s.phase = 'finished';
            s.result = { scores: calculateScores(s) };
        }
    }
    return { ok: true, state: s };
}
