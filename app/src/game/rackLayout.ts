import { type OkeyInfo, type Tile, analyzeMeld, findBestMelds } from '@okey/shared';

export const RACK_COLS = 13;
export const RACK_ROWS = 2;
export const RACK_SLOTS = RACK_COLS * RACK_ROWS;

/** Slot index -> tile id (or null). The player's own arrangement; never sent to the server. */
export type RackSlots = (number | null)[];

/** Keeps known tiles where they are, drops tiles that left the hand, puts new ones in free slots. */
export function syncRack(slots: RackSlots, hand: Tile[]): RackSlots {
  const ids = new Set(hand.map((t) => t.id));
  const next = slots.length === RACK_SLOTS ? slots.map((id) => (id !== null && ids.has(id) ? id : null)) : emptyRack();
  const placed = new Set(next.filter((id): id is number => id !== null));
  for (const t of hand) {
    if (placed.has(t.id)) continue;
    const free = next.indexOf(null);
    if (free < 0) break;
    next[free] = t.id;
  }
  return next;
}

export function emptyRack(): RackSlots {
  return Array(RACK_SLOTS).fill(null);
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
