// B12: pure seat order of the opponent panels (no react-native import).

/**
 * Opponent seats left to right as they sit around the trick cross: west (the previous seat, seat-1, who plays just
 * before me), then north (seat+2 with 4 players), then east (the next seat, seat+1). Turn order runs counter-clockwise.
 * 2 players: just the other seat.
 */
export function opponentOrder(mySeat: number, playerCount: number): number[] {
  const out: number[] = [];
  for (let k = 1; k < playerCount; k++) out.push((((mySeat - k) % playerCount) + playerCount) % playerCount);
  return out;
}
