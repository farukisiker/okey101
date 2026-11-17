/** What every game hands to GameShell at the end of a hand. Plain data, no UI. */
export interface RoundSummaryRow {
  seat: number;
  name: string;
  /** Points of this hand. */
  points: number;
  /** Running total. */
  total: number;
  /** Team rows only: every seat of the team ("Sen & Cem"), so GameShell keeps the full name and marks it as mine. */
  seats?: number[];
}

export interface RoundSummary {
  rows: RoundSummaryRow[];
  matchOver: boolean;
  /** Seats that won the hand (or, when matchOver, the match). Empty: nobody won. */
  winnerSeats: number[];
  /** True for card games (pişti, batak): nobody "finishes" a hand there, so the headline words differ. */
  cardGame?: boolean;
  /** One extra line under the headline (Batak: the contract and whether it was made). */
  note?: string;
  /** 'tavla': a "hand" is a game there ("Oyunu X kazandı", "Bu oyun", "Sonraki oyun"). */
  wording?: 'tavla';
}

export type SummaryHeadline =
  | { kind: 'youWin' }
  | { kind: 'winner'; names: string[] }
  | { kind: 'none' };

/** Who the big headline names: me, the other winner(s) (several on a tie), or nobody. */
export function summaryHeadline(summary: RoundSummary, mySeat: number): SummaryHeadline {
  if (summary.winnerSeats.includes(mySeat)) return { kind: 'youWin' };
  const names = summary.winnerSeats
    .map((seat) => summary.rows.find((r) => r.seat === seat)?.name)
    .filter((n): n is string => !!n);
  return names.length ? { kind: 'winner', names } : { kind: 'none' };
}

export interface HeadlineText {
  key: 'youFinished' | 'youWon' | 'actFinished' | 'winnerIs' | 'tilesRanOut'
    | 'cardYouWonHand' | 'cardYouWonMatch' | 'cardHandWinner' | 'cardMatchWinner' | 'cardDraw'
    | 'tavlaYouWonGame' | 'tavlaGameWinner';
  vars?: { name: string };
}

/** The headline's i18n key (+ variables). Okey keeps its wording; card games say who won, not who "finished". */
export function summaryHeadlineText(summary: RoundSummary, mySeat: number): HeadlineText {
  const head = summaryHeadline(summary, mySeat);
  const card = summary.cardGame === true;
  const over = summary.matchOver;
  if (summary.wording === 'tavla' && !over) {
    if (head.kind === 'youWin') return { key: 'tavlaYouWonGame' };
    if (head.kind === 'winner') return { key: 'tavlaGameWinner', vars: { name: head.names.join(', ') } };
  }
  if (head.kind === 'youWin') {
    if (card) return { key: over ? 'cardYouWonMatch' : 'cardYouWonHand' };
    return { key: over ? 'youWon' : 'youFinished' };
  }
  if (head.kind === 'winner') {
    const vars = { name: head.names.join(', ') };
    if (card) return { key: over ? 'cardMatchWinner' : 'cardHandWinner', vars };
    return { key: over ? 'winnerIs' : 'actFinished', vars };
  }
  return { key: card ? 'cardDraw' : 'tilesRanOut' };
}

export interface SummaryLabels {
  thisHand: 'thisHand' | 'tavlaThisGame';
  next: 'nextHand' | 'newMatch' | 'tavlaNextGame';
}

/** The table's points column and the main button: Tavla says "Bu oyun" / "Sonraki oyun". */
export function summaryLabels(summary: RoundSummary): SummaryLabels {
  const tavla = summary.wording === 'tavla';
  return {
    thisHand: tavla ? 'tavlaThisGame' : 'thisHand',
    next: summary.matchOver ? 'newMatch' : tavla ? 'tavlaNextGame' : 'nextHand',
  };
}
