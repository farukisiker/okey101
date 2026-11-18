import { mkdtempSync, rmSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Express } from 'express';
import { MemoryStore } from '../src/memoryStore';
import { SqliteStore } from '../src/sqliteStore';
import type { AccountStore } from '../src/store';
import type { ModerationLayer, ModerationResult } from '../src/moderation';

function seg(marker: number, payload: Buffer): Buffer {
  const len = Buffer.alloc(2);
  len.writeUInt16BE(payload.length + 2);
  return Buffer.concat([Buffer.from([0xff, marker]), len, payload]);
}

export const EXIF_SECRET = 'GPS-SECRET-41.0082N-28.9784E';
export const COM_SECRET = 'SECRET-COMMENT-FROM-CAMERA';

export interface JpegOpts {
  width?: number;
  height?: number;
  exif?: boolean;
  com?: boolean;
  /** Bytes mixed into the scan data so two images differ. */
  salt?: string;
  trailing?: boolean;
  /** Adds a second scan with an APP13 + COM between the scans (progressive-like). */
  twoScans?: boolean;
}

/** Builds a structurally valid JPEG (not decodable pixels: the server only parses structure). */
export function makeJpeg(o: JpegOpts = {}): Buffer {
  const width = o.width ?? 256;
  const height = o.height ?? 256;
  const parts: Buffer[] = [Buffer.from([0xff, 0xd8])];
  parts.push(seg(0xe0, Buffer.from([0x4a, 0x46, 0x49, 0x46, 0x00, 1, 1, 0, 0, 1, 0, 1, 0, 0])));
  if (o.exif ?? true) parts.push(seg(0xe1, Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), Buffer.from(EXIF_SECRET)])));
  if (o.com ?? true) parts.push(seg(0xfe, Buffer.from(COM_SECRET)));
  parts.push(seg(0xdb, Buffer.concat([Buffer.from([0]), Buffer.alloc(64, 1)])));
  const sof = Buffer.alloc(9);
  sof[0] = 8;
  sof.writeUInt16BE(height, 1);
  sof.writeUInt16BE(width, 3);
  sof[5] = 1;
  sof[6] = 1;
  sof[7] = 0x11;
  sof[8] = 0;
  parts.push(seg(0xc0, sof));
  parts.push(seg(0xc4, Buffer.from([0x00, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x05])));
  const sos = seg(0xda, Buffer.from([1, 1, 0, 0, 0x3f, 0]));
  const scan = Buffer.concat([
    Buffer.from([0x12, 0x34, 0xff, 0x00, 0x56, 0xff, 0xd0, 0x78]),
    Buffer.from(o.salt ?? 'scan-data'),
    Buffer.from([0x9a, 0xff, 0x00]),
  ]);
  parts.push(sos, scan);
  if (o.twoScans) {
    parts.push(seg(0xed, Buffer.from('Photoshop 3.0 ' + EXIF_SECRET)), seg(0xfe, Buffer.from(COM_SECRET)));
    parts.push(sos, Buffer.from([0xab, 0xcd]));
  }
  parts.push(Buffer.from([0xff, 0xd9]));
  if (o.trailing) parts.push(Buffer.from('TRAILING-' + EXIF_SECRET));
  return Buffer.concat(parts);
}

export interface StoreFactory {
  name: string;
  make(): { store: AccountStore; cleanup(): void };
}

export const storeFactories: StoreFactory[] = [
  { name: 'MemoryStore', make: () => ({ store: new MemoryStore(), cleanup: () => {} }) },
  {
    name: 'SqliteStore(:memory:)',
    make: () => {
      const store = new SqliteStore(':memory:');
      return { store, cleanup: () => store.close() };
    },
  },
  {
    name: 'SqliteStore(file)',
    make: () => {
      const dir = mkdtempSync(join(tmpdir(), 'kahve-accounts-'));
      const store = new SqliteStore(join(dir, 'accounts.db'));
      return {
        store,
        cleanup: () => {
          store.close();
          rmSync(dir, { recursive: true, force: true });
        },
      };
    },
  },
];

export async function listen(app: Express): Promise<{ url: string; close(): Promise<void> }> {
  const server = app.listen(0);
  await new Promise<void>((r) => server.once('listening', () => r()));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}

/** A moderation layer whose answer the test controls; counts calls. */
export class FakeLayer implements ModerationLayer {
  calls = 0;
  gate: Promise<void> | null = null;
  constructor(
    public name = 'fake',
    public next: ModerationResult | (() => Promise<ModerationResult>) = { verdict: 'ok', reasons: [] },
  ) {}
  async check(): Promise<ModerationResult> {
    this.calls++;
    if (this.gate) await this.gate;
    return typeof this.next === 'function' ? this.next() : this.next;
  }
}
