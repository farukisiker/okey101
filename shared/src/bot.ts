import { type Action, type PlayerView, OPEN_THRESHOLD, leftOf } from './game';
import { analyzeMeld } from './melds';
import { findBestMelds } from './solver';
import { type OkeyInfo, type Rng, type Tile, faceOf, isJoker } from './tiles';

export type BotLevel = 'medium' | 'hard';

export interface BotOptions {
  /** medium (default): patient about opening, shallower search, occasional slips. hard: plays its best. */
  level?: BotLevel;
  rng?: Rng;
}

const LEVELS = {
  // nodeLimit: meld search budget. eagerOpen: chance to open early once 101 is reached
  // (always opens once the deck is down to `openByDeck`). takeDiscard: chance to take a
  // useful discard. slip: chance to throw the second-worst tile instead of the worst.
  medium: { nodeLimit: 600, eagerOpen: 0.08, openByDeck: 9, takeDiscard: 0.35, slip: 0.2 },
  hard: { nodeLimit: 40000, eagerOpen: 1, openByDeck: 20, takeDiscard: 1, slip: 0 },
};

/**
 * Bot: keeps the tiles that form the most melds, opens once it has 101 (a
 * medium bot waits a while), lays/adds whatever it can afterwards and
 * discards the least useful leftover. Only sees its own PlayerView, like a human.
 */
export function botStep(view: PlayerView, opts: BotOptions = {}): Action {
  const cfg = LEVELS[opts.level ?? 'medium'];
  const rng = opts.rng ?? Math.random;
  const me = view.players[view.seat];
  const hand = view.hand;
  const { okey } = view;

  if (view.turnPhase === 'draw') {
    const top = view.players[leftOf(view.seat)].discards.at(-1);
    // Taking a discard forces playing it now, i.e. opening early; a patient bot avoids that.
    const patient = !me.opened && view.deckCount > cfg.openByDeck;
    if (top && view.deckCount > 0 && !patient && rng() < cfg.takeDiscard && wantsDiscard(view, top, cfg.nodeLimit)) {
      return { type: 'draw', source: 'discard' };
    }
    return { type: 'draw', source: view.deckCount > 0 ? 'deck' : 'discard' };
  }

  // Whatever is played must leave a legal discard: not nothing, not only the picked-up tile.
  const mustUse = view.mustUseTileId;
  const leavesDiscard = (used: Tile[]) => {
    const usedIds = new Set(used.map((t) => t.id));
    const rest = hand.filter((t) => !usedIds.has(t.id));
    return rest.length > 1 || (rest.length === 1 && rest[0].id !== mustUse);
  };
  const solve = (maxTiles: number) =>
    findBestMelds(hand, okey, { maxTiles, preferTileId: mustUse ?? undefined, nodeLimit: cfg.nodeLimit });
  let best = solve(hand.length - 1);
  if (!leavesDiscard(best.melds.flat())) best = solve(hand.length - 2);

  if (!me.opened) {
    // A picked-up discard must be played this turn, so open whenever that is possible.
    const ready = mustUse !== null || view.deckCount <= cfg.openByDeck || rng() < cfg.eagerOpen;
    if (best.points >= OPEN_THRESHOLD && ready && leavesDiscard(best.melds.flat())) {
      return { type: 'open', melds: best.melds.map(ids) };
    }
  } else {
    const meld = best.melds.find(leavesDiscard);
    if (meld) return { type: 'meld', tileIds: ids(meld) };
    if (hand.length > 1) {
      for (const tile of hand) {
        if (isJoker(tile, okey) || !leavesDiscard([tile])) continue;
        for (const m of view.table) {
          const a = analyzeMeld([...m.tiles, tile], okey);
          if (a && a.type === m.type) return { type: 'addToMeld', meldId: m.id, tileIds: [tile.id] };
        }
      }
    }
  }

  const slip = rng() < cfg.slip;
  return { type: 'discard', tileId: chooseDiscard(hand, okey, best.melds, view.mustUseTileId, slip) };
}

/** Minimal move for a player who ran out of time: draw from the deck or throw the worst tile. */
export function quickMove(view: PlayerView): Action {
  if (view.turnPhase === 'draw') return { type: 'draw', source: 'deck' };
  const best = findBestMelds(view.hand, view.okey, { maxTiles: view.hand.length - 1 });
  return { type: 'discard', tileId: chooseDiscard(view.hand, view.okey, best.melds, view.mustUseTileId) };
}

const ids = (tiles: Tile[]) => tiles.map((t) => t.id);

function wantsDiscard(view: PlayerView, top: Tile, nodeLimit: number): boolean {
  const me = view.players[view.seat];
  const hand = [...view.hand, top];
  const best = findBestMelds(hand, view.okey, { maxTiles: hand.length - 1, preferTileId: top.id, nodeLimit });
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

function chooseDiscard(
  hand: Tile[],
  okey: OkeyInfo,
  melds: Tile[][],
  mustUse: number | null,
  slip = false,
): number {
  const inMeld = new Set(melds.flat().map((t) => t.id));
  const legal = hand.filter((t) => t.id !== mustUse);
  let pool = legal.filter((t) => !inMeld.has(t.id));
  if (pool.length === 0) pool = legal;
  const value = (t: Tile) => faceOf(t, okey)?.value ?? 0;
  pool.sort((a, b) => usefulness(a, hand, okey) - usefulness(b, hand, okey) || value(b) - value(a));
  // A slip throws the runner-up instead, but never the okey.
  if (slip && pool.length > 1 && !isJoker(pool[1], okey)) return pool[1].id;
  return pool[0].id;
}
