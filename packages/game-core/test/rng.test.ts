import { afterEach, describe, expect, it, vi } from 'vitest';
import { seededRng as referenceRng, shuffle as referenceShuffle } from '../../../shared/src/tiles';
import { newSeed, pick, randomInt, seededRng, shuffle } from '../src/rng';

afterEach(() => vi.restoreAllMocks());

describe('seededRng', () => {
  it.each([0, 1, 42, -1, 0xffffffff, 0x100000000])('matches 10,000 reference values for seed %s', seed => {
    const rng = seededRng(seed);
    const reference = referenceRng(seed);
    const actual = Array.from({ length: 10_000 }, () => rng());
    expect(actual).toEqual(Array.from({ length: 10_000 }, () => reference()));
    expect(actual.every(value => value >= 0 && value < 1)).toBe(true);
  });
  it('normalizes seeds to unsigned 32 bits', () => {
    expect(seededRng(-1)()).toBe(seededRng(0xffffffff)());
    expect(seededRng(0x100000000)()).toBe(seededRng(0)());
  });
});

describe('shuffle', () => {
  it.each([0, 1, 42, -1])('matches reference ordering and RNG consumption for seed %s', seed => {
    const items = Object.freeze(Array.from({ length: 106 }, (_, i) => i));
    const rng = seededRng(seed);
    const reference = referenceRng(seed);
    const result = shuffle(items, rng);
    expect(result).toEqual(referenceShuffle([...items], reference));
    expect(rng()).toBe(reference());
    expect(result).not.toBe(items);
    expect([...result].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual(Array.from({ length: 106 }, (_, i) => i));
  });
  it.each([{ items: [] }, { items: [1] }])('copies $items without calling RNG', ({ items }) => {
    const rng = vi.fn(() => 0);
    expect(shuffle(items, rng)).toEqual(items);
    expect(shuffle(items, rng)).not.toBe(items);
    expect(rng).not.toHaveBeenCalled();
  });
  it('consumes exactly length - 1 values and preserves duplicates', () => {
    const rng = vi.fn(() => 0);
    expect(shuffle(['a', 'a', 'b'], rng).sort()).toEqual(['a', 'a', 'b']);
    expect(rng).toHaveBeenCalledTimes(2);
  });
});

describe('random helpers', () => {
  it.each([[0, 7, 0], [0.9999999999999999, 7, 6], [0.5, 7, 3], [0.9, 1, 0]])('maps %s into [0, %s)', (value, n, expected) => {
    const rng = vi.fn(() => value);
    expect(randomInt(rng, n)).toBe(expected);
    expect(rng).toHaveBeenCalledTimes(1);
  });
  it('picks the first and last elements without changing input', () => {
    const items = Object.freeze(['a', 'b', 'c']);
    const rng = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0.9999999999999999);
    expect(pick(rng, items)).toBe('a');
    expect(pick(rng, items)).toBe('c');
    expect(rng).toHaveBeenCalledTimes(2);
    expect(items).toEqual(['a', 'b', 'c']);
  });
  it('handles empty and singleton picks', () => {
    const rng = vi.fn(() => 0.5);
    expect(pick(rng, [])).toBeUndefined();
    expect(rng).not.toHaveBeenCalled();
    expect(pick(rng, [42])).toBe(42);
    expect(rng).toHaveBeenCalledTimes(1);
  });
  it.each([[0, 0], [0.5, 2147483648], [0.9999999999999999, 4294967295]])('generates a 32-bit seed from %s', (value, expected) => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(value);
    expect(newSeed()).toBe(expected);
    expect(random).toHaveBeenCalledTimes(1);
  });
});
