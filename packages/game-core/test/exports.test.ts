import { expect, it } from 'vitest';
import * as core from '../src/index';
import type { GameDefinition, Rng } from '../src/index';
import * as rng from '../src/rng';
import * as seats from '../src/seats';
import { sumTotals } from '../src/scores';

it('exports all A1 helpers from the package entry', () => {
  for (const [name, helper] of Object.entries({ ...rng, ...seats, sumTotals })) {
    expect(core[name as keyof typeof core]).toBe(helper);
  }
  const random: Rng = core.seededRng(42);
  expect(core.pick(random, core.seatOrder(0, 4))).toBeTypeOf('number');
});

it('preserves frozen contract exports', () => {
  expect(core.GAME_IDS).toHaveLength(8);
  expect(core.isGameId('okey101')).toBe(true);
  expect(core.isGameId('unknown')).toBe(false);
  const definition: Pick<GameDefinition<unknown, unknown, unknown>, 'id'> = { id: 'pisti' };
  expect(core.isGameId(definition.id)).toBe(true);
});
