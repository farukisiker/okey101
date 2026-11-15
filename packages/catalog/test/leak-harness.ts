/**
 * B8: the shared half of the `viewFor` leak tests.
 *
 * The game-specific half is a `LeakProbe`: everything the generic checks need to know about one
 * game. ADIM 2 (pisti/batak) adds a probe, not a game switch in here. The checks are:
 *  1. no hidden tile id (other hands, the stack) ever reaches a view, and every id a view shows is
 *     genuinely public,
 *  2. other seats are a count, never a hand,
 *  3. the stack is a number, never an array (so an order cannot leak through it),
 *  4. no `seed`/`rng`/`deck`/`state` key anywhere in the view tree, and the seed value never shows up,
 *  5. `revealedHands` is null while playing and the four real hands once the round is over,
 *  6. a mutated clone with the same open table but different hidden information produces byte-equal
 *     views (plus the positive control that the seat's own hand changes its own view), and
 *  7. the public data in a view matches the state exactly, so the suite cannot pass vacuously,
 *  8. `viewFor` is deterministic: called twice with the same state it returns the same bytes,
 *  9. `Object.keys(view)` equals the game's published key list.
 */
import { describe, expect, it } from 'vitest';

/** Sentinel written into a mutated clone; it must not reach any view. */
export const BIG_SEED = 987654321;
/** Steps replayed before the mutation checks (deep enough for melds/discards to exist). */
export const MID_HAND_STEPS = 12;

/** One game's leak-test adapter. `S` is the full state, `V` what one seat sees. */
export interface LeakProbe<S, V> {
  /** For the test name and failure messages, e.g. "okey101". */
  name: string;
  seats: number;
  /** The exact top-level keys of `viewFor` (gate 9). A new leaking field fails loudly. */
  viewKeys: readonly string[];
  /** Key names that must not appear anywhere in the view tree (gate 4). */
  forbiddenKeys: readonly string[];

  rng(seed: number): () => number;
  /** Deal a fresh round; the starting seat rotates with the seed. */
  deal(seed: number): S;
  /** Play exactly one deterministic bot move and return the new state. */
  step(state: S, step: number, rng: () => number): S;
  playing(state: S): boolean;
  turnSeat(state: S): number;
  view(state: S, seat: number): V;

  clone(state: S): S;
  /** Tile ids `seat` must not see: the hidden stack plus the other seats' hands. */
  hiddenIds(state: S, seat: number): number[];
  /** Tile ids `seat` may see: its own hand, the piles, the table, the indicator, the last action. */
  publicIds(state: S, seat: number): number[];
  handCount(state: S, seat: number): number;
  deckCount(state: S): number;
  /** Change only hidden information (from `target`'s point of view) and write `BIG_SEED` into the state. */
  hideMore(state: S, target: number): void;
  /** Reverse `seat`'s own hand; false when it holds fewer than two tiles. */
  scrambleOwnHand(state: S, seat: number): boolean;

  /** Game-specific public-field checks while the round is playing (gate 7). */
  checkView(state: S, seat: number, view: V): void;
  /** The round-over exception: all hands are public then (gate 5). */
  checkRevealed(state: S): void;
}

/** Every `key` (leaf name) in a plain-object tree. */
export function collectKeys(value: unknown): string[] {
  const keys: string[] = [];
  const walk = (node: unknown, seen: Set<unknown>) => {
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, seen);
      return;
    }
    for (const [key, nested] of Object.entries(node as Record<string, unknown>)) {
      keys.push(key);
      walk(nested, seen);
    }
  };
  walk(value, new Set());
  return keys;
}

/**
 * Every id a view shows: the `id` of any tile-shaped object (`kind: 'normal' | 'fake'`) plus the
 * explicit id fields of the @kahve/core contract (`mustUseTileId`, `tileId`, `tileIds`). Meld ids,
 * notice ids and seat numbers are deliberately not collected: they are small counters that would
 * collide with tile ids and make the test brittle.
 */
export function collectViewIds(value: unknown): number[] {
  const ids: number[] = [];
  const walk = (node: unknown, seen: Set<unknown>) => {
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, seen);
      return;
    }
    const record = node as Record<string, unknown>;
    if (record.kind === 'normal' || record.kind === 'fake') {
      if (typeof record.id === 'number') ids.push(record.id);
    }
    for (const key of ['mustUseTileId', 'tileId']) {
      const field = record[key];
      if (typeof field === 'number') ids.push(field);
    }
    const tileIds = record.tileIds;
    if (Array.isArray(tileIds)) for (const id of tileIds) if (typeof id === 'number') ids.push(id);
    for (const nested of Object.values(record)) walk(nested, seen);
  };
  walk(value, new Set());
  return ids;
}

/** The gates every sampled view has to pass. */
function checkView<S, V>(probe: LeakProbe<S, V>, state: S, seat: number): void {
  const view = probe.view(state, seat);
  const label = `${probe.name} seat=${seat}`;

  // 9) the published key list is exact: a new field has to be added here on purpose
  expect(Object.keys(view as object).sort(), `${label}: view keys`).toEqual([...probe.viewKeys].sort());

  // 4a) no seed/rng/deck/state key anywhere in the tree
  const keys = collectKeys(view);
  for (const forbidden of probe.forbiddenKeys) {
    expect(keys, `${label}: forbidden key "${forbidden}" in the view`).not.toContain(forbidden);
  }

  // 8) determinism: a second call with the same state is byte-equal (no Date.now()/rng inside)
  expect(JSON.stringify(probe.view(state, seat)), `${label}: viewFor is not deterministic`).toBe(JSON.stringify(view));

  // 1) no hidden tile id, and every id shown is genuinely public
  const shown = collectViewIds(view);
  const hidden = new Set(probe.hiddenIds(state, seat));
  const open = new Set(probe.publicIds(state, seat));
  expect([...new Set(shown.filter((id) => hidden.has(id)))], `${label}: hidden tile ids leaked into the view`).toEqual([]);
  expect([...new Set(shown.filter((id) => !open.has(id)))], `${label}: tile ids in the view that are not public`).toEqual([]);

  // 2) another seat is a count, never a hand
  const players = (view as { players?: { seat: number; handCount: number; hand?: unknown }[] }).players ?? [];
  expect(players.length, `${label}: players length`).toBe(probe.seats);
  for (const player of players) {
    expect('hand' in player, `${label}: players[${player.seat}] carries a hand`).toBe(false);
    expect(player.handCount, `${label}: players[${player.seat}].handCount`).toBe(probe.handCount(state, player.seat));
  }

  // 3) the stack is a number; the `deck` key itself is already forbidden (gate 4a)
  expect((view as { deckCount?: unknown }).deckCount, `${label}: deckCount`).toBe(probe.deckCount(state));

  // 7) game-specific public data
  probe.checkView(state, seat, view);
}

/** The mutation test: same open table, different hidden information, byte-equal views. */
function checkMutation<S, V>(probe: LeakProbe<S, V>, seed: number): boolean {
  const rng = probe.rng(seed ^ 0x9e3779b9);
  let state = probe.deal(seed);
  for (let step = 0; step < MID_HAND_STEPS && probe.playing(state); step++) state = probe.step(state, step, rng);
  if (!probe.playing(state)) return false; // a round that ended inside 12 steps has nothing left to hide

  const before = Array.from({ length: probe.seats }, (_, seat) => JSON.stringify(probe.view(state, seat)));
  for (let seat = 0; seat < probe.seats; seat++) {
    const label = `${probe.name} seed=${seed} seat=${seat}`;

    const mutated = probe.clone(state);
    probe.hideMore(mutated, seat);
    const after = JSON.stringify(probe.view(mutated, seat));
    expect(after, `${label}: the view changed with hidden information only`).toBe(before[seat]);
    expect(after, `${label}: the state seed leaked into the view`).not.toContain(String(BIG_SEED));

    // positive control: the seat's own hand is not hidden from itself
    const own = probe.clone(state);
    if (probe.scrambleOwnHand(own, seat)) {
      expect(JSON.stringify(probe.view(own, seat)), `${label}: a change of its own hand is invisible`).not.toBe(before[seat]);
    }
  }
  return true;
}

export interface LeakSuiteOptions {
  /** Seeds per game; `KAHVE_LEAK_SEEDS` overrides it (default 25). */
  seeds?: number;
  /** Sample every n-th step of a round (default 5). */
  sampleEvery?: number;
  stepCap?: number;
}

/** Registers one vitest suite for a game: bot rounds plus every gate on every sampled view. */
export function registerLeakSuite<S, V>(probe: LeakProbe<S, V>, options: LeakSuiteOptions = {}): void {
  // tsconfig has no node types, so reach process through globalThis.
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;
  const seeds = Number(env?.KAHVE_LEAK_SEEDS) || options.seeds || 25;
  const sampleEvery = options.sampleEvery ?? 5;
  const stepCap = options.stepCap ?? 3000;

  describe(`viewFor leaks: ${probe.name}`, () => {
    it(`${seeds} seeded bot rounds, every seat, every ${sampleEvery} steps`, () => {
      let samples = 0;
      let mutations = 0;
      for (let seed = 1; seed <= seeds; seed++) {
        const rng = probe.rng(seed ^ 0x9e3779b9);
        let state = probe.deal(seed);
        let step = 0;
        while (probe.playing(state)) {
          if (step > stepCap) throw new Error(`${probe.name} seed ${seed}: no finish within ${stepCap} steps`);
          if (step % sampleEvery === 0) {
            // Seat rotation: a different seat is checked first on every seed (the deal rotates too).
            for (let i = 0; i < probe.seats; i++) {
              checkView(probe, state, (seed + i) % probe.seats);
              samples++;
            }
          }
          state = probe.step(state, step, rng);
          step++;
        }
        probe.checkRevealed(state);
        if (checkMutation(probe, seed)) mutations++;
      }
      // Not vacuous: many sampled views, and the mid-hand mutation path really ran.
      expect(samples).toBeGreaterThan(seeds * 4);
      expect(mutations).toBeGreaterThan(seeds / 2);
    }, 600_000);
  });
}


