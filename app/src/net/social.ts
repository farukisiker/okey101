// E2 (Claude Sonnet): table chat logic with no React or native imports, so vitest can load it.
// The sayings, emoji and message shapes come from the shared protocol (E2 contract).
import { QUICK_EMOJI, QUICK_SAYINGS, type QuickEmoji, type QuickSaying, type TableSaid } from '@okey/shared';
import type { Key } from '../i18n/tr';

export { QUICK_EMOJI, QUICK_SAYINGS };
export type { QuickEmoji, QuickSaying };

/** `table:said` from the server: exactly one of saying / emoji. */
export type SaidMsg = TableSaid;

/** What the client sends with `table:say`: exactly one of the two. */
export type SayMsg = { saying: QuickSaying; emoji?: undefined } | { emoji: QuickEmoji; saying?: undefined };

/** i18n key of every ready saying (all start with "say"). */
export const SAYING_KEYS: Record<QuickSaying, Key> = {
  hayirliOlsun: 'sayHayirliOlsun',
  cayBenden: 'sayCayBenden',
  eline: 'sayEline',
  gecmisOlsun: 'sayGecmisOlsun',
  kolayGelsin: 'sayKolayGelsin',
  sansinBol: 'saySansinBol',
  tebrikler: 'sayTebrikler',
  biraBekle: 'sayBiraBekle',
  tesekkurler: 'sayTesekkurler',
  hadiBakalim: 'sayHadiBakalim',
};

/** The server allows one message per 2 s; the panel greys out for the same time so nobody taps into an error. */
export const SAY_COOLDOWN_MS = 2000;
/** A bubble stays next to its player this long. */
export const BUBBLE_MS = 4000;

export const REPORT_REASONS = ['insult', 'harass', 'askGift', 'spam', 'other'] as const;
export const REPORT_KEYS: Record<(typeof REPORT_REASONS)[number], Key> = {
  insult: 'reportInsult',
  harass: 'reportHarass',
  askGift: 'reportAskGift',
  spam: 'reportSpam',
  other: 'reportOther',
};

const SAYINGS = new Set<string>(QUICK_SAYINGS);
const EMOJIS = new Set<string>(QUICK_EMOJI);

/** A `table:said` payload we can show: a seat number and exactly one known saying or emoji (unknown ones from a newer server are dropped). */
export function parseSaid(m: unknown): SaidMsg | null {
  if (typeof m !== 'object' || m === null) return null;
  const r = m as Record<string, unknown>;
  if (typeof r.seat !== 'number' || !Number.isInteger(r.seat) || r.seat < 0) return null;
  const hasSaying = r.saying !== undefined;
  const hasEmoji = r.emoji !== undefined;
  if (hasSaying === hasEmoji) return null;
  const at = typeof r.at === 'number' ? r.at : 0;
  if (hasSaying) return typeof r.saying === 'string' && SAYINGS.has(r.saying) ? { seat: r.seat, saying: r.saying as QuickSaying, at } : null;
  return typeof r.emoji === 'string' && EMOJIS.has(r.emoji) ? { seat: r.seat, emoji: r.emoji as QuickEmoji, at } : null;
}

/** Milliseconds until the next message may be sent (0 = now). */
export function cooldownLeft(lastSentAt: number | null, now: number): number {
  if (lastSentAt === null) return 0;
  return Math.max(0, SAY_COOLDOWN_MS - (now - lastSentAt));
}

export interface Bubble {
  /** Rising number, so a React list can key on it and a new message from the same seat restarts the timer. */
  id: number;
  seat: number;
  saying?: QuickSaying;
  emoji?: QuickEmoji;
  /** Epoch ms (local clock) when the bubble disappears. */
  until: number;
}

/** Bubbles still alive at `now`. */
export const liveBubbles = (list: readonly Bubble[], now: number): Bubble[] => list.filter((b) => b.until > now);

/**
 * Adds a message's bubble. Messages from hidden seats (blocked players) never show; one bubble per seat
 * (a new one replaces the old); expired ones are dropped. Uses the local clock, not the server's `at`.
 */
export function addBubble(list: readonly Bubble[], msg: SaidMsg, now: number, hiddenSeats: ReadonlySet<number>, id: number): Bubble[] {
  const kept = liveBubbles(list, now).filter((b) => b.seat !== msg.seat);
  if (hiddenSeats.has(msg.seat)) return kept;
  const b: Bubble = { id, seat: msg.seat, until: now + BUBBLE_MS };
  if (msg.saying) b.saying = msg.saying;
  if (msg.emoji) b.emoji = msg.emoji;
  return [...kept, b];
}

/** Drop bubbles of seats that just became hidden (blocked mid-table). */
export const withoutSeats = (list: readonly Bubble[], hidden: ReadonlySet<number>): Bubble[] => list.filter((b) => !hidden.has(b.seat));

// ---- who is at the table ----

/** A seat as the table lists it: RoomInfo's seat plus the unverified `accountId` the client sent when it sat down (E2). */
export interface TableSeat {
  seat: number;
  name: string;
  isBot: boolean;
  connected?: boolean;
  accountId?: string;
}

/** Seats of RoomInfo as TableSeat rows (the room may carry `accountId` per seat; old servers don't). */
export function tableSeats(room: { seats: ({ name: string; isBot: boolean; connected?: boolean; accountId?: string } | null)[] } | null | undefined): TableSeat[] {
  const out: TableSeat[] = [];
  room?.seats.forEach((s, seat) => {
    if (s) out.push({ seat, name: s.name, isBot: s.isBot, connected: s.connected, ...(typeof s.accountId === 'string' && s.accountId ? { accountId: s.accountId } : {}) });
  });
  return out;
}

/** The other people at the table (no bots, not me). */
export const otherPeople = (seats: readonly TableSeat[], mySeat: number): TableSeat[] => seats.filter((s) => !s.isBot && s.seat !== mySeat);

/** Seats whose person I blocked. */
export function blockedSeats(seats: readonly TableSeat[], blocked: ReadonlySet<string>): Set<number> {
  const out = new Set<number>();
  for (const s of seats) if (s.accountId && blocked.has(s.accountId)) out.add(s.seat);
  return out;
}

/** What identifies the person in a seat for a mute: their account when known, otherwise their name. */
export const occupantKey = (s: TableSeat): string => (s.accountId ? `a:${s.accountId}` : `n:${s.name}`);

/** Seats muted by hand or blocked. A mute belongs to the person, not the chair: when someone else sits down it ends. */
export function silencedSeats(seats: readonly TableSeat[], mutedKeys: ReadonlySet<string>, blocked: ReadonlySet<string>): Set<number> {
  const out = blockedSeats(seats, blocked);
  for (const s of seats) if (mutedKeys.has(occupantKey(s))) out.add(s.seat);
  return out;
}

/** Voice identity is `s<seat>-<random>` (server token contract). */
export function seatOfIdentity(identity: string): number | null {
  const m = /^s(\d{1,2})-/.exec(identity);
  return m ? Number(m[1]) : null;
}

/** The voice switch of a new table: the person's choice if they touched it, otherwise on for a locked (friends) table, off for an open one. */
export const voiceDefault = (hasPassword: boolean, choice: boolean | null): boolean => (choice === null ? hasPassword : choice);
