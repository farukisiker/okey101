/** Requires positive integer n and integer seat in [0, n). */
export function nextSeat(seat: number, n: number): number {
  return (seat + 1) % n;
}

/** Previous seat (okey's leftOf). Requires positive integer n and seat in [0, n). */
export function prevSeat(seat: number, n: number): number {
  return (seat + n - 1) % n;
}

/** Visits each seat once, starting at start. Requires positive integer n and start in [0, n). */
export function seatOrder(start: number, n: number): number[] {
  return Array.from({ length: n }, (_, offset) => (start + offset) % n);
}

/** Opposite seat for four players, otherwise -1. Requires a valid seat index. */
export function partnerOf(seat: number, n: number): number {
  return n === 4 ? (seat + 2) % 4 : -1;
}
