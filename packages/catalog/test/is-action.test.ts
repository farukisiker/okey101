import { describe, expect, it } from 'vitest';
import { okey101Def } from '../src/okey';

const valid = [
  { type: 'draw', source: 'deck' },
  { type: 'draw', source: 'discard' },
  { type: 'open', melds: [[1, 2, 3], [4, 5, 6]] },
  { type: 'meld', tileIds: [7, 8, 9] },
  { type: 'addToMeld', meldId: 0, tileIds: [10] },
  { type: 'discard', tileId: 0 },
  { type: 'finish', tileId: 105 },
  { type: 'showIndicator' },
];

const invalid: unknown[] = [
  null,
  undefined,
  0,
  'draw',
  [],
  {},
  { type: 'nope' },
  { type: 'draw' },
  { type: 'draw', source: 'hand' },
  { type: 'open' },
  { type: 'open', melds: [] },
  { type: 'open', melds: [[]] },
  { type: 'open', melds: [1, 2, 3] },
  { type: 'open', melds: [['1', '2', '3']] },
  { type: 'meld', tileIds: [] },
  { type: 'meld', tileIds: ['7', '8', '9'] },
  { type: 'meld', tileIds: '7,8,9' },
  { type: 'addToMeld', tileIds: [1] },
  { type: 'addToMeld', meldId: '0', tileIds: [1] },
  { type: 'addToMeld', meldId: 0 },
  { type: 'discard' },
  { type: 'discard', tileId: '3' },
  { type: 'discard', tileId: 1.5 },
  { type: 'discard', tileId: Number.NaN },
  { type: 'finish', tileId: null },
];

describe('okey isAction', () => {
  it.each(valid)('accepts %j', (a) => expect(okey101Def.isAction(a)).toBe(true));
  it.each(invalid.map((x) => [x]))('rejects %j', (x) => expect(okey101Def.isAction(x)).toBe(false));

  it('never throws on hostile input', () => {
    const trap = new Proxy(
      {},
      {
        get: () => {
          throw new Error('boom');
        },
      },
    );
    const getter = Object.defineProperty({ type: 'discard' }, 'tileId', {
      get: () => {
        throw new Error('boom');
      },
    });
    expect(okey101Def.isAction(trap)).toBe(false);
    expect(okey101Def.isAction(getter)).toBe(false);
  });
});
