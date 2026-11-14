import { describe, expect, it } from 'vitest';
import { TURN_MS, createGame, nextClock, seededRng, viewFor } from '../src';

describe('turn clock', () => {
  it('first turn of a hand gets 60 s, later turns 30 s', () => {
    const g = createGame({ rng: seededRng(1) });
    const c = nextClock(null, g, null, 1000)!;
    expect(c.deadline).toBe(1000 + 2 * TURN_MS);
    const later = { ...g, turnNumber: 5 };
    expect(nextClock(c, later, { type: 'discard', tileId: 1 }, 5000)!.deadline).toBe(5000 + TURN_MS);
  });

  it('the first open/meld/add of a turn refills the clock, later ones do not', () => {
    const g = { ...createGame({ rng: seededRng(1) }), turnNumber: 4 };
    let c = nextClock(null, g, null, 0)!;
    c = nextClock(c, g, { type: 'draw', source: 'deck' }, 10_000)!;
    expect(c.deadline).toBe(TURN_MS); // drawing does not refill
    c = nextClock(c, g, { type: 'open', melds: [] }, 20_000)!;
    expect(c.deadline).toBe(20_000 + TURN_MS);
    for (const at of [25_000, 26_000, 27_000, 28_000]) c = nextClock(c, g, { type: 'addToMeld', meldId: 1, tileIds: [] }, at)!;
    expect(c.deadline).toBe(20_000 + TURN_MS);
  });

  it('views carry the time left; no clock when the round is over', () => {
    const g = createGame({ rng: seededRng(1) });
    const c = nextClock(null, g, null, 0)!;
    expect(viewFor(g, 0, c, 15_000).turnMsLeft).toBe(2 * TURN_MS - 15_000);
    expect(viewFor(g, 0).turnMsLeft).toBeNull();
    expect(nextClock(c, { ...g, phase: 'finished' }, null, 0)).toBeNull();
  });
});
