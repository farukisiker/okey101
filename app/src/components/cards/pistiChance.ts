/**
 * "Pişti fırsatı!" is true only when the middle holds exactly one card and the player holds a card of the same
 * rank: that is the only way to score a pişti (a Jack on a non-Jack single card is a normal capture).
 */
export function hasPistiChance(
  topCard: { rank: number } | null,
  centerCount: number,
  hand: readonly { rank: number }[],
): boolean {
  return centerCount === 1 && topCard != null && hand.some((c) => c.rank === topCard.rank);
}
