import { expect, it } from 'vitest';
import { nextSeat, partnerOf, prevSeat, seatOrder } from '../src/seats';

it.each([
  { n: 2, seat: 0, next: 1, prev: 1, order: [0, 1], partner: -1 },
  { n: 2, seat: 1, next: 0, prev: 0, order: [1, 0], partner: -1 },
  { n: 4, seat: 0, next: 1, prev: 3, order: [0, 1, 2, 3], partner: 2 },
  { n: 4, seat: 1, next: 2, prev: 0, order: [1, 2, 3, 0], partner: 3 },
  { n: 4, seat: 2, next: 3, prev: 1, order: [2, 3, 0, 1], partner: 0 },
  { n: 4, seat: 3, next: 0, prev: 2, order: [3, 0, 1, 2], partner: 1 },
])('orders seat $seat among $n players', ({ n, seat, next, prev, order, partner }) => {
  expect(nextSeat(seat, n)).toBe(next);
  expect(prevSeat(seat, n)).toBe(prev);
  expect(seatOrder(seat, n)).toEqual(order);
  expect(partnerOf(seat, n)).toBe(partner);
});

it('supports a singleton table and other player counts', () => {
  expect(nextSeat(0, 1)).toBe(0);
  expect(prevSeat(0, 1)).toBe(0);
  expect(seatOrder(0, 1)).toEqual([0]);
  expect(partnerOf(0, 1)).toBe(-1);
  expect(partnerOf(1, 3)).toBe(-1);
});
