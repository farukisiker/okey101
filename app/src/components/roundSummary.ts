/** What every game hands to GameShell at the end of a hand. Plain data, no UI. */
export interface RoundSummaryRow {
  seat: number;
  name: string;
  /** Points of this hand. */
  points: number;
  /** Running total. */
  total: number;
}

export interface RoundSummary {
  rows: RoundSummaryRow[];
  matchOver: boolean;
  /** Seats that won the hand (or, when matchOver, the match). Empty: nobody won. */
  winnerSeats: number[];
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
