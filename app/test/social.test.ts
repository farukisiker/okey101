import { describe, expect, it } from 'vitest';
import { tr } from '../src/i18n/tr';
import {
  BUBBLE_MS,
  QUICK_EMOJI,
  QUICK_SAYINGS,
  REPORT_KEYS,
  REPORT_REASONS,
  SAYING_KEYS,
  SAY_COOLDOWN_MS,
  type TableSeat,
  addBubble,
  blockedSeats,
  cooldownLeft,
  liveBubbles,
  occupantKey,
  otherPeople,
  parseSaid,
  seatOfIdentity,
  silencedSeats,
  tableSeats,
  voiceDefault,
  withoutSeats,
} from '../src/net/social';

describe('ready sayings', () => {
  it('every saying has a "say..." i18n key with text, and every report reason has a key', () => {
    for (const k of QUICK_SAYINGS) {
      expect(SAYING_KEYS[k].startsWith('say')).toBe(true);
      expect(tr[SAYING_KEYS[k]].length).toBeGreaterThan(0);
    }
    for (const r of REPORT_REASONS) expect(tr[REPORT_KEYS[r]].length).toBeGreaterThan(0);
  });

  it('parses exactly one known saying or emoji and drops anything else', () => {
    expect(parseSaid({ seat: 2, saying: 'cayBenden', at: 5 })).toEqual({ seat: 2, saying: 'cayBenden', at: 5 });
    expect(parseSaid({ seat: 1, emoji: QUICK_EMOJI[3], at: 9 })).toEqual({ seat: 1, emoji: '☕', at: 9 });
    expect(parseSaid({ seat: 1, saying: 'cayBenden', emoji: '👍' })).toBeNull();
    expect(parseSaid({ seat: 1 })).toBeNull();
    expect(parseSaid({ seat: 1, saying: 'serbestYazi' })).toBeNull(); // a newer server's saying we do not know
    expect(parseSaid({ seat: 1, emoji: '💩' })).toBeNull();
    expect(parseSaid({ seat: -1, emoji: '👍' })).toBeNull();
    expect(parseSaid({ seat: 1.5, emoji: '👍' })).toBeNull();
    expect(parseSaid(null)).toBeNull();
    expect(parseSaid('x')).toBeNull();
  });

  it('cooldown counts down from the last send', () => {
    expect(cooldownLeft(null, 100)).toBe(0);
    expect(cooldownLeft(1000, 1500)).toBe(SAY_COOLDOWN_MS - 500);
    expect(cooldownLeft(1000, 3000)).toBe(0);
    expect(cooldownLeft(1000, 9000)).toBe(0);
  });
});

describe('bubbles', () => {
  const none = new Set<number>();

  it('shows a bubble for 4 s and keeps one per seat', () => {
    let list = addBubble([], { seat: 1, saying: 'tebrikler', at: 0 }, 1000, none, 1);
    expect(list).toEqual([{ id: 1, seat: 1, saying: 'tebrikler', until: 1000 + BUBBLE_MS }]);
    list = addBubble(list, { seat: 2, emoji: '👏', at: 0 }, 1500, none, 2);
    expect(list.map((b) => b.seat)).toEqual([1, 2]);
    // a new message from seat 1 replaces its old bubble and restarts the timer
    list = addBubble(list, { seat: 1, saying: 'hadiBakalim', at: 0 }, 2000, none, 3);
    expect(list.filter((b) => b.seat === 1)).toEqual([{ id: 3, seat: 1, saying: 'hadiBakalim', until: 2000 + BUBBLE_MS }]);
  });

  it('drops expired bubbles', () => {
    const list = addBubble([], { seat: 1, emoji: '👍', at: 0 }, 0, none, 1);
    expect(liveBubbles(list, BUBBLE_MS - 1)).toHaveLength(1);
    expect(liveBubbles(list, BUBBLE_MS)).toHaveLength(0);
    expect(addBubble(list, { seat: 2, emoji: '👍', at: 0 }, BUBBLE_MS + 1, none, 2).map((b) => b.seat)).toEqual([2]);
  });

  it('never shows a bubble of a blocked seat, and removes the ones it had', () => {
    expect(addBubble([], { seat: 3, saying: 'eline', at: 0 }, 0, new Set([3]), 1)).toEqual([]);
    const list = [...addBubble([], { seat: 1, emoji: '👍', at: 0 }, 0, none, 1), ...addBubble([], { seat: 3, emoji: '👍', at: 0 }, 0, none, 2)];
    expect(withoutSeats(list, new Set([3])).map((b) => b.seat)).toEqual([1]);
  });
});

describe('who is at the table', () => {
  const room = {
    seats: [
      { name: 'Ben', isBot: false, connected: true, accountId: 'acc-me' },
      { name: 'Ali', isBot: false, connected: true, accountId: 'acc-ali' },
      { name: 'Bot Zeynep', isBot: true, connected: true },
      null,
      { name: 'Veli', isBot: false, connected: false },
    ],
  };

  it('lists seats with their account ids and leaves empty chairs out', () => {
    const seats = tableSeats(room);
    expect(seats.map((s) => s.seat)).toEqual([0, 1, 2, 4]);
    expect(seats[1].accountId).toBe('acc-ali');
    expect(seats[3]).not.toHaveProperty('accountId'); // an old client sent none
    expect(tableSeats(null)).toEqual([]);
  });

  it('others = people other than me, no bots', () => {
    expect(otherPeople(tableSeats(room), 0).map((s: TableSeat) => s.name)).toEqual(['Ali', 'Veli']);
  });

  it('blocked seats come from the account ids only', () => {
    const seats = tableSeats(room);
    expect([...blockedSeats(seats, new Set(['acc-ali', 'acc-zzz']))]).toEqual([1]);
    expect(blockedSeats(seats, new Set()).size).toBe(0);
  });

  it('a hand mute belongs to the person: it ends when someone else takes the chair', () => {
    const seats = tableSeats(room);
    const muted = new Set([occupantKey(seats[1])]);
    expect([...silencedSeats(seats, muted, new Set())]).toEqual([1]);
    const newcomer = tableSeats({ seats: [room.seats[0], { name: 'Cemil', isBot: false, accountId: 'acc-cemil' }] });
    expect(silencedSeats(newcomer, muted, new Set()).size).toBe(0);
    // a guest without an account id is muted by name
    expect([...silencedSeats(seats, new Set([occupantKey(seats[3])]), new Set())]).toEqual([4]);
  });

  it('blocked people are silenced as well', () => {
    expect([...silencedSeats(tableSeats(room), new Set(), new Set(['acc-ali']))]).toEqual([1]);
  });

  it('reads the seat from a voice identity', () => {
    expect(seatOfIdentity('s2-8f3a')).toBe(2);
    expect(seatOfIdentity('s11-x')).toBe(11);
    expect(seatOfIdentity('guest')).toBeNull();
    expect(seatOfIdentity('s2')).toBeNull();
  });

  it('voice default: locked table on, open table off, the host choice wins', () => {
    expect(voiceDefault(true, null)).toBe(true);
    expect(voiceDefault(false, null)).toBe(false);
    expect(voiceDefault(true, false)).toBe(false);
    expect(voiceDefault(false, true)).toBe(true);
  });
});
