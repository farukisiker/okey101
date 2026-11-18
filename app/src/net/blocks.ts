// E2 (Claude Sonnet): my block list. Plain TypeScript with injected storage and server calls (vitest runs it in Node).
// The device keeps a copy so blocking works offline and before the first sync; the server list (GET /v1/blocks) is merged in.

export const BLOCKS_KEY = 'kahve.blocks';
export const MAX_BLOCKS = 500;

export interface BlockStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface BlockRemote {
  list(): Promise<string[]>;
  add(accountId: string): Promise<void>;
  remove(accountId: string): Promise<void>;
}

export type BlockOutcome = 'ok' | 'full';

export class BlockList {
  private ids = new Set<string>();
  private snap: ReadonlySet<string> = new Set();
  private listeners = new Set<(ids: ReadonlySet<string>) => void>();
  private loaded: Promise<void> | null = null;

  constructor(
    private storage: BlockStorage,
    private remote: BlockRemote | null,
  ) {}

  get snapshot(): ReadonlySet<string> {
    return this.snap;
  }

  has(accountId: string | undefined | null): boolean {
    return !!accountId && this.ids.has(accountId);
  }

  subscribe(fn: (ids: ReadonlySet<string>) => void): () => void {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  }

  /** Device copy first, then the server list merged in (a failing server leaves the device copy). Safe to call many times. */
  load(): Promise<void> {
    if (!this.loaded) {
      this.loaded = (async () => {
        try {
          const raw = await this.storage.getItem(BLOCKS_KEY);
          const arr: unknown = raw ? JSON.parse(raw) : [];
          if (Array.isArray(arr)) for (const x of arr) if (typeof x === 'string') this.ids.add(x);
        } catch {
          // unreadable copy: start empty
        }
        this.emit();
        if (this.remote) {
          try {
            for (const id of await this.remote.list()) this.ids.add(id);
            this.emit();
            await this.persist();
          } catch {
            // offline or accounts off: the device copy is enough
          }
        }
      })();
    }
    return this.loaded;
  }

  /** Blocks at once on the device, then tells the server (a failure there keeps the local block). */
  async block(accountId: string): Promise<BlockOutcome> {
    if (this.ids.has(accountId)) return 'ok';
    if (this.ids.size >= MAX_BLOCKS) return 'full';
    this.ids.add(accountId);
    this.emit();
    await this.persist();
    await this.remote?.add(accountId).catch(() => {});
    return 'ok';
  }

  async unblock(accountId: string): Promise<void> {
    if (!this.ids.delete(accountId)) return;
    this.emit();
    await this.persist();
    await this.remote?.remove(accountId).catch(() => {});
  }

  private emit() {
    this.snap = new Set(this.ids);
    for (const fn of this.listeners) fn(this.snap);
  }

  private async persist() {
    await this.storage.setItem(BLOCKS_KEY, JSON.stringify([...this.ids])).catch(() => {});
  }
}
