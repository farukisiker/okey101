import { type OkeyInfo, type Tile, OPEN_THRESHOLD, PAIRS_TO_OPEN, analyzeMeld, analyzePair, findBestMelds, findPairs } from '@okey/shared';

export const RACK_COLS = 15;
export const RACK_ROWS = 2;
export const RACK_SLOTS = RACK_COLS * RACK_ROWS;

/** Slot index -> tile id (or null). The player's own arrangement; never sent to the server. */
export type RackSlots = (number | null)[];

/**
 * Keeps known tiles where they are and drops tiles that left the hand. New
 * tiles go to `preferSlot` when it is free (a tile dragged onto the rack),
 * otherwise to the last free slot so they don't join an arranged group.
 */
export function syncRack(slots: RackSlots, hand: Tile[], preferSlot: number | null = null): RackSlots {
  const ids = new Set(hand.map((t) => t.id));
  const next = slots.length === RACK_SLOTS ? slots.map((id) => (id !== null && ids.has(id) ? id : null)) : emptyRack();
  const placed = new Set(next.filter((id): id is number => id !== null));
  for (const t of hand) {
    if (placed.has(t.id)) continue;
    let slot = preferSlot !== null && next[preferSlot] === null ? preferSlot : next.lastIndexOf(null);
    preferSlot = null;
    if (slot < 0) break;
    next[slot] = t.id;
  }
  return next;
}

/** Pixel geometry of the rack on screen, used to map a finger position to a slot. */
export interface RackGeom {
  x: number;
  y: number;
  /** Offset of slot 0 inside the measured view. */
  padX: number;
  padY: number;
  tileW: number;
  /** Row pitch: tile height plus the gap to the next row. */
  rowH: number;
}

/**
 * Slot under a window point, or -1. Runs on the UI thread during drags.
 * Forgiving at the edges: anything below the rack (only the screen edge is
 * there) counts as the bottom row, and a little above it as the top row.
 */
export function slotAt(g: RackGeom | null, px: number, py: number): number {
  'worklet';
  if (!g) return -1;
  const col = Math.floor((px - g.x - g.padX) / g.tileW);
  const top = g.y + g.padY;
  if (py < top - g.rowH * 0.35 || col < -1 || col > RACK_COLS) return -1;
  const row = Math.min(RACK_ROWS - 1, Math.max(0, Math.floor((py - top) / g.rowH)));
  return row * RACK_COLS + Math.min(RACK_COLS - 1, Math.max(0, col));
}

export function emptyRack(): RackSlots {
  return Array(RACK_SLOTS).fill(null);
}

/** Moves a tile to an empty slot. Occupied slots are left alone: the player arranges by hand. */
export function placeTile(slots: RackSlots, tileId: number, to: number): RackSlots {
  const from = slots.indexOf(tileId);
  if (from < 0 || to < 0 || to >= RACK_SLOTS || from === to || slots[to] !== null) return slots;
  const next = slots.slice();
  next[from] = null;
  next[to] = tileId;
  return next;
}

/** Tiles touching each other in a row form a group, like on a real istaka. */
export function rackGroups(slots: RackSlots): number[][] {
  const groups: number[][] = [];
  for (let r = 0; r < RACK_ROWS; r++) {
    let cur: number[] = [];
    for (let c = 0; c < RACK_COLS; c++) {
      const id = slots[r * RACK_COLS + c];
      if (id === null) {
        if (cur.length) groups.push(cur);
        cur = [];
      } else cur.push(id);
    }
    if (cur.length) groups.push(cur);
  }
  return groups;
}

export interface ValidGroup {
  tileIds: number[];
  points: number;
}

export function validGroups(slots: RackSlots, hand: Tile[], okey: OkeyInfo): ValidGroup[] {
  const byId = new Map(hand.map((t) => [t.id, t]));
  const out: ValidGroup[] = [];
  for (const g of rackGroups(slots)) {
    if (g.length < 3) continue;
    const tiles = g.map((id) => byId.get(id)).filter((t): t is Tile => !!t);
    const m = analyzeMeld(tiles, okey);
    if (m) out.push({ tileIds: m.ordered, points: m.points });
  }
  return out;
}

/** 101 pairs: rack groups of exactly two identical tiles (the okey pairs with anything). */
export function validPairs(slots: RackSlots, hand: Tile[], okey: OkeyInfo): ValidGroup[] {
  const byId = new Map(hand.map((t) => [t.id, t]));
  const out: ValidGroup[] = [];
  for (const g of rackGroups(slots)) {
    if (g.length !== 2) continue;
    const tiles = g.map((id) => byId.get(id)).filter((t): t is Tile => !!t);
    const m = analyzePair(tiles, okey);
    if (m) out.push({ tileIds: m.ordered, points: 0 });
  }
  return out;
}

/**
 * Lays out the best melds first (one gap between them), leftovers after, sorted by colour/value.
 * With `pairs` (opened with pairs, or holding enough of them and no 101 in melds) it lays out pairs instead.
 */
export function autoArrange(hand: Tile[], okey: OkeyInfo, pairs = false): RackSlots {
  const melds = pairs ? findPairs(hand, okey) : findBestMelds(hand, okey).melds;
  const used = new Set(melds.flat().map((t) => t.id));
  const ordered: number[][] = melds.map((m) => (pairs ? null : analyzeMeld(m, okey)?.ordered) ?? m.map((t) => t.id));
  const rest = hand
    .filter((t) => !used.has(t.id))
    .sort((a, b) => sortKey(a) - sortKey(b))
    .map((t) => t.id);

  const slots = emptyRack();
  let pos = 0;
  const place = (ids: number[], gapAfter: boolean) => {
    // Don't split a group across rows.
    const col = pos % RACK_COLS;
    if (col + ids.length > RACK_COLS && ids.length <= RACK_COLS) pos += RACK_COLS - col;
    for (const id of ids) if (pos < RACK_SLOTS) slots[pos++] = id;
    if (gapAfter && pos % RACK_COLS !== 0) pos++;
  };
  for (const ids of ordered) place(ids, true);
  for (const id of rest) {
    if (pos >= RACK_SLOTS) break;
    slots[pos++] = id;
  }
  // Anything that didn't fit goes into remaining free slots.
  return syncRack(slots, hand);
}

/** Whether "Diz" should lay out pairs: opened with pairs, or not opened, five pairs and no 101 in melds. */
export function prefersPairs(hand: Tile[], okey: OkeyInfo, opened: boolean, openedWithPairs: boolean): boolean {
  if (opened) return openedWithPairs;
  return findPairs(hand, okey).length >= PAIRS_TO_OPEN && findBestMelds(hand, okey).points < OPEN_THRESHOLD;
}

function sortKey(t: Tile): number {
  if (t.kind === 'fake') return 999;
  return ['red', 'yellow', 'blue', 'black'].indexOf(t.color) * 20 + t.value;
}
