import type { PistiOptions } from './types';
export const defaultOptions: PistiOptions = { seats: 2, partnerMode: false, targetScore: 151, hiddenCards: 'reveal', openingJack: 'redraw', pistiPoints: 10, jackPistiPoints: 20, acePoints: 1, jackPoints: 1, clubTwoPoints: 2, diamondTenPoints: 3, mostCardsPoints: 3 };
export function normalizeOptions(raw: unknown): PistiOptions {
    const v = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
    const o = { ...defaultOptions };
    if (v.seats === 2 || v.seats === 4)
        o.seats = v.seats;
    if (o.seats === 4 && typeof v.partnerMode === 'boolean')
        o.partnerMode = v.partnerMode;
    if (v.targetScore === 51 || v.targetScore === 101 || v.targetScore === 151)
        o.targetScore = v.targetScore;
    if (v.hiddenCards === 'reveal' || v.hiddenCards === 'secret')
        o.hiddenCards = v.hiddenCards;
    if (v.openingJack === 'redraw' || v.openingJack === 'allow')
        o.openingJack = v.openingJack;
    for (const k of ['pistiPoints', 'jackPistiPoints', 'acePoints', 'jackPoints', 'clubTwoPoints', 'diamondTenPoints', 'mostCardsPoints'] as const) {
        const n = v[k];
        if (typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)
            o[k] = n;
    }
    return o;
}
