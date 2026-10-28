import { type OkeyInfo, type Tile, analyzeMeld, findBestMelds } from '@okey/shared';

export const RACK_COLS = 13;
export const RACK_ROWS = 2;
export const RACK_SLOTS = RACK_COLS * RACK_ROWS;

/** Slot index -> tile id (or null). The player's own arrangement; never sent to the server. */
export type RackSlots = (number | null)[];

/**
 * Keeps known tiles where they are, drops tiles that left the hand, puts new
 * ones in free slots. A single new tile goes to `preferSlot` when given
 * (a tile dragged from a pile onto the rack).
 */
export function syncRack(slots: RackSlots, hand: Tile[], preferSlot: number | null = null): RackSlots {
  const ids = new Set(hand.map((t) => t.id));
  let next = slots.length === RACK_SLOTS ? slots.map((id) => (id !== null && ids.has(id) ? id : null)) : emptyRack();
  const placed = new Set(next.filter((id): id is number => id !== null));
  const fresh = hand.filter((t) => !placed.has(t.id));
  if (fresh.length === 1 && preferSlot !== null) {
    const free = next.indexOf(null);
    if (free >= 0) {
      next[free] = fresh[0].id;
      return insertTile(next, fresh[0].id, preferSlot);
    }
  }
  for (const t of fresh) {
    const free = next.indexOf(null);
    if (free < 0) break;
    next[free] = t.id;
  }
  return next;
}

/** Pixel geometry of the rack on screen, used to map a finger position to a slot. */
export interface RackGeom {
  x: number;
  y: number;
  pad: number;
  tileW: number;
  rowH: number;
}

/** Slot under a window point, or -1. Runs on the UI thread during drags. */
export function slotAt(g: RackGeom | null, px: number, py: number): number {
  'worklet';
  if (!g) return -1;
  const col = Math.floor((px - g.x - g.pad) / g.tileW);
  const row = Math.floor((py - g.y - g.pad) / g.rowH);
  if (row < 0 || row >= RACK_ROWS || col < -1 || col > RACK_COLS) return -1;
  return row * RACK_COLS + Math.min(RACK_COLS - 1, Math.max(0, col));
}

export function emptyRack(): RackSlots {
  return Array(RACK_SLOTS).fill(null);
}

/**
 * Puts a tile at a slot like on a real istaka: an occupied target pushes its
 * neighbours aside within the row (towards the nearest gap); swaps only when
 * the row has no gap.
 */
export function insertTile(slots: RackSlots, tileId: number, to: number): RackSlots {
  const from = slots.indexOf(tileId);
  if (from < 0 || to < 0 || to >= RACK_SLOTS || from === to) return slots;
  const next = slots.slice();
  next[from] = null;
  if (next[to] === null) {
    next[to] = tileId;
    return next;
  }
  const rowStart = to - (to % RACK_COLS);
  const rowEnd = rowStart + RACK_COLS - 1;
  let right = -1;
  for (let i = to + 1; i <= rowEnd; i++) if (next[i] === null) { right = i; break; }
  let left = -1;
  for (let i = to - 1; i >= rowStart; i--) if (next[i] === null) { left = i; break; }
  if (right >= 0 && (left < 0 || right - to <= to - left)) {
    for (let i = right; i > to; i--) next[i] = next[i - 1];
    next[to] = tileId;
    return next;
  }
  if (left >= 0) {
    for (let i = left; i < to; i++) next[i] = next[i + 1];
    next[to] = tileId;
    return next;
  }
  return moveTile(slots, tileId, to);
}

/** Moves a tile to a slot; an occupied target swaps with the source. */
export function moveTile(slots: RackSlots, tileId: number, to: number): RackSlots {
  const from = slots.indexOf(tileId);
  if (from < 0 || to < 0 || to >= RACK_SLOTS || from === to) return slots;
  const next = slots.slice();
  next[from] = next[to];
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

/** Lays out the best melds first (one gap between them), leftovers after, sorted by colour/value. */
export function autoArrange(hand: Tile[], okey: OkeyInfo): RackSlots {
  const { melds } = findBestMelds(hand, okey);
  const used = new Set(melds.flat().map((t) => t.id));
  const ordered: number[][] = melds.map((m) => analyzeMeld(m, okey)?.ordered ?? m.map((t) => t.id));
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

function sortKey(t: Tile): number {
  if (t.kind === 'fake') return 999;
  return ['red', 'yellow', 'blue', 'black'].indexOf(t.color) * 20 + t.value;
}
