import { type Action, type PlayerView, OPEN_THRESHOLD, leftOf } from './game';
import { analyzeMeld } from './melds';
import { findBestMelds } from './solver';
import { type OkeyInfo, type Tile, faceOf, isJoker } from './tiles';

/**
 * Simple bot: keeps the tiles that form the most melds, opens as soon as it
 * reaches 101, lays/adds whatever it can afterwards and discards the least
 * useful leftover. Only sees its own PlayerView, like a human.
 */
export function botStep(view: PlayerView): Action {
  const me = view.players[view.seat];
  const hand = view.hand;
  const { okey } = view;

  if (view.turnPhase === 'draw') {
    const top = view.players[leftOf(view.seat)].discards.at(-1);
    if (top && view.deckCount > 0 && wantsDiscard(view, top)) return { type: 'draw', source: 'discard' };
    return { type: 'draw', source: view.deckCount > 0 ? 'deck' : 'discard' };
  }

  const maxTiles = hand.length - 1;
  const best = findBestMelds(hand, okey, { maxTiles, preferTileId: view.mustUseTileId ?? undefined });

  if (!me.opened) {
    if (best.points >= OPEN_THRESHOLD) return { type: 'open', melds: best.melds.map(ids) };
  } else {
    if (best.melds.length > 0) return { type: 'meld', tileIds: ids(best.melds[0]) };
    if (hand.length > 1) {
      for (const tile of hand) {
        if (isJoker(tile, okey)) continue;
        for (const m of view.table) {
          const a = analyzeMeld([...m.tiles, tile], okey);
          if (a && a.type === m.type) return { type: 'addToMeld', meldId: m.id, tileIds: [tile.id] };
        }
      }
    }
  }

  return { type: 'discard', tileId: chooseDiscard(hand, okey, best.melds, view.mustUseTileId) };
}

/** Minimal move for a player who ran out of time: draw from the deck or throw the worst tile. */
export function quickMove(view: PlayerView): Action {
  if (view.turnPhase === 'draw') return { type: 'draw', source: 'deck' };
  const best = findBestMelds(view.hand, view.okey, { maxTiles: view.hand.length - 1 });
  return { type: 'discard', tileId: chooseDiscard(view.hand, view.okey, best.melds, view.mustUseTileId) };
}

const ids = (tiles: Tile[]) => tiles.map((t) => t.id);

function wantsDiscard(view: PlayerView, top: Tile): boolean {
  const me = view.players[view.seat];
  const hand = [...view.hand, top];
  const best = findBestMelds(hand, view.okey, { maxTiles: hand.length - 1, preferTileId: top.id });
  const usesTop = best.melds.some((m) => m.some((t) => t.id === top.id));
  if (!me.opened) return usesTop && best.points >= OPEN_THRESHOLD;
  if (usesTop) return true;
  return view.table.some((m) => {
    const a = analyzeMeld([...m.tiles, top], view.okey);
    return a !== null && a.type === m.type;
  });
}

/** How many other tiles could combine with this one. */
function usefulness(tile: Tile, hand: Tile[], okey: OkeyInfo): number {
  if (isJoker(tile, okey)) return 1000;
  const f = faceOf(tile, okey)!;
  let score = 0;
  for (const other of hand) {
    if (other.id === tile.id) continue;
    const o = faceOf(other, okey);
    if (!o) continue;
    if (o.value === f.value && o.color !== f.color) score += 2;
    else if (o.color === f.color && Math.abs(o.value - f.value) <= 2 && o.value !== f.value) {
      score += Math.abs(o.value - f.value) === 1 ? 2 : 1;
    }
  }
  return score;
}

function chooseDiscard(hand: Tile[], okey: OkeyInfo, melds: Tile[][], mustUse: number | null): number {
  const inMeld = new Set(melds.flat().map((t) => t.id));
  const legal = hand.filter((t) => t.id !== mustUse);
  let pool = legal.filter((t) => !inMeld.has(t.id));
  if (pool.length === 0) pool = legal;
  const value = (t: Tile) => faceOf(t, okey)?.value ?? 0;
  pool.sort((a, b) => usefulness(a, hand, okey) - usefulness(b, hand, okey) || value(b) - value(a));
  return pool[0].id;
}
