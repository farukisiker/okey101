/** Adds scores without mutating either input. Requires arrays of equal length. */
export function sumTotals(totals: number[], round: number[]): number[] {
  return totals.map((total, seat) => total + round[seat]);
}
