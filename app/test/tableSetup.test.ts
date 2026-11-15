import { describe, expect, it } from 'vitest';
import { normalizeSetup, setupKey, setupOptions } from '../src/net/tableSetup';

describe('card lobby setup', () => {
  it('defaults to the first seat choice, solo', () => {
    expect(normalizeSetup(null, [2, 4])).toEqual({ seats: 2, partners: false });
    expect(normalizeSetup({ seats: 4 }, [2, 4])).toEqual({ seats: 4, partners: false });
  });

  it('keeps a valid choice, drops partners below four seats and unknown seat counts', () => {
    expect(normalizeSetup({ seats: 4, partners: true }, [2, 4])).toEqual({ seats: 4, partners: true });
    expect(normalizeSetup({ seats: 2, partners: true }, [2, 4])).toEqual({ seats: 2, partners: false });
    expect(normalizeSetup({ seats: 3, partners: true }, [2, 4])).toEqual({ seats: 2, partners: false });
    expect(normalizeSetup({ seats: 4, partners: 'yes' }, [4])).toEqual({ seats: 4, partners: false });
  });

  it('maps to game options and a per-game storage key', () => {
    expect(setupOptions({ seats: 4, partners: true })).toEqual({ seats: 4, partnerMode: true });
    expect(setupKey('pisti')).toBe('kahve.setup.pisti');
  });
});
