import { describe, expect, it } from 'vitest';
import { BLOCKS_KEY, BlockList, MAX_BLOCKS, type BlockRemote, type BlockStorage } from '../src/net/blocks';

const memory = (init: Record<string, string> = {}): BlockStorage & { data: Record<string, string> } => {
  const data = { ...init };
  return { data, getItem: async (k) => data[k] ?? null, setItem: async (k, v) => void (data[k] = v) };
};
const remote = (server: Set<string>, fail = false): BlockRemote => ({
  list: async () => {
    if (fail) throw new Error('offline');
    return [...server];
  },
  add: async (id) => {
    if (fail) throw new Error('offline');
    server.add(id);
  },
  remove: async (id) => {
    if (fail) throw new Error('offline');
    server.delete(id);
  },
});

describe('BlockList', () => {
  it('loads the device copy, then merges the server list', async () => {
    const storage = memory({ [BLOCKS_KEY]: JSON.stringify(['a']) });
    const list = new BlockList(storage, remote(new Set(['b'])));
    await list.load();
    expect([...list.snapshot].sort()).toEqual(['a', 'b']);
    expect(JSON.parse(storage.data[BLOCKS_KEY]).sort()).toEqual(['a', 'b']);
  });

  it('keeps the device copy when the server cannot be reached', async () => {
    const list = new BlockList(memory({ [BLOCKS_KEY]: JSON.stringify(['a']) }), remote(new Set(), true));
    await list.load();
    expect(list.has('a')).toBe(true);
  });

  it('survives a broken saved copy and a missing server', async () => {
    const list = new BlockList(memory({ [BLOCKS_KEY]: '{not json' }), null);
    await list.load();
    expect(list.snapshot.size).toBe(0);
  });

  it('blocks and unblocks on the device and on the server, and tells listeners with a new set each time', async () => {
    const server = new Set<string>();
    const storage = memory();
    const list = new BlockList(storage, remote(server));
    await list.load();
    const seen: number[] = [];
    list.subscribe((s) => seen.push(s.size));
    const before = list.snapshot;
    expect(await list.block('x')).toBe('ok');
    expect(list.snapshot).not.toBe(before);
    expect(list.has('x')).toBe(true);
    expect(server.has('x')).toBe(true);
    expect(JSON.parse(storage.data[BLOCKS_KEY])).toEqual(['x']);
    await list.unblock('x');
    expect(list.has('x')).toBe(false);
    expect(server.has('x')).toBe(false);
    expect(seen).toEqual([1, 0]);
  });

  it('a failing server does not undo a block', async () => {
    const list = new BlockList(memory(), remote(new Set(), true));
    await list.block('x');
    expect(list.has('x')).toBe(true);
  });

  it('stops at the limit of 500', async () => {
    const list = new BlockList(memory(), null);
    for (let i = 0; i < MAX_BLOCKS; i++) await list.block(`id${i}`);
    expect(await list.block('one-too-many')).toBe('full');
    expect(list.has('one-too-many')).toBe(false);
    expect(await list.block('id0')).toBe('ok'); // already blocked is fine
  });

  it('has() is false for missing ids', () => {
    const list = new BlockList(memory(), null);
    expect(list.has(undefined)).toBe(false);
    expect(list.has('')).toBe(false);
  });
});
