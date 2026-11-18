import { SAY_MIN_GAP_MS, SAY_PER_MINUTE } from '@okey/shared';

/**
 * E2 'table:say' limit, per key (socket id): at most one saying per `minGapMs` and `perMinute` in any
 * sliding minute. Refused attempts don't count, so a spamming client is simply ignored until it slows down.
 */
export class SayLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly minGapMs = SAY_MIN_GAP_MS,
    private readonly perMinute = SAY_PER_MINUTE,
    private readonly now: () => number = Date.now,
  ) {}

  allow(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((x) => x > t - 60_000);
    const last = recent[recent.length - 1];
    if ((last !== undefined && t - last < this.minGapMs) || recent.length >= this.perMinute) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    return true;
  }

  forget(key: string): void {
    this.hits.delete(key);
  }
}
