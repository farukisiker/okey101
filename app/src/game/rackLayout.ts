import { type OkeyInfo, type Tile, analyzeMeld, findBestMelds } from '@okey/shared';

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

/** Slot under a window point, or -1. Runs on the UI thread during drags. */
export function slotAt(g: RackGeom | null, px: number, py: number): number {
  'worklet';
  if (!g) return -1;
  const col = Math.floor((px - g.x - g.padX) / g.tileW);
  const row = Math.floor((py - g.y - g.padY) / g.rowH);
  if (row < 0 || row >= RACK_ROWS || col < -1 || col > RACK_COLS) return -1;
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
