import { describe, expect, it } from 'vitest';
import { BadJpegError, cleanJpeg } from '../src/jpeg';
import { COM_SECRET, EXIF_SECRET, makeJpeg } from './helpers';

function markers(buf: Buffer): number[] {
  // walk header segments up to SOS
  const out: number[] = [];
  let off = 2;
  while (off < buf.length) {
    const m = buf[off + 1];
    out.push(m);
    if (m === 0xda) break;
    off += 2 + buf.readUInt16BE(off + 2);
  }
  return out;
}

describe('cleanJpeg', () => {
  it('reads width/height from SOF and strips APP1 (EXIF/GPS) and COM', () => {
    const src = makeJpeg({ width: 300, height: 200 });
    expect(src.includes(EXIF_SECRET)).toBe(true);
    const { jpeg, width, height } = cleanJpeg(src);
    expect([width, height]).toEqual([300, 200]);
    expect(jpeg.includes(EXIF_SECRET)).toBe(false);
    expect(jpeg.includes(COM_SECRET)).toBe(false);
    expect(jpeg.includes(Buffer.from('JFIF'))).toBe(true); // APP0 kept
    expect(markers(jpeg)).toEqual([0xe0, 0xdb, 0xc0, 0xc4, 0xda]);
    expect(jpeg.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(jpeg.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });

  it('keeps scan data including stuffed FF00 and RST markers', () => {
    const { jpeg } = cleanJpeg(makeJpeg({ exif: false, com: false }));
    expect(jpeg).toEqual(makeJpeg({ exif: false, com: false }));
  });

  it('strips APPn/COM between scans and drops bytes after EOI', () => {
    const src = makeJpeg({ twoScans: true, trailing: true });
    const { jpeg } = cleanJpeg(src);
    expect(jpeg.includes(EXIF_SECRET)).toBe(false);
    expect(jpeg.includes(COM_SECRET)).toBe(false);
    expect(jpeg.includes(Buffer.from('TRAILING'))).toBe(false);
    expect(jpeg.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });

  it('is idempotent', () => {
    const once = cleanJpeg(makeJpeg()).jpeg;
    expect(cleanJpeg(once).jpeg).toEqual(once);
  });

  it.each([
    ['empty', Buffer.alloc(0)],
    ['png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])],
    ['text', Buffer.from('hello world, not a jpeg')],
    ['truncated', makeJpeg().subarray(0, 60)],
    ['no EOI', makeJpeg().subarray(0, -2)],
    ['SOI only', Buffer.from([0xff, 0xd8, 0xff, 0xd9])],
  ])('rejects %s', (_n, buf) => {
    expect(() => cleanJpeg(buf)).toThrow(BadJpegError);
  });

  it('rejects SOS before SOF and zero dimensions', () => {
    const noSof = Buffer.from([0xff, 0xd8, 0xff, 0xda, 0x00, 0x08, 1, 1, 0, 0, 0x3f, 0, 0x11, 0xff, 0xd9]);
    expect(() => cleanJpeg(noSof)).toThrow(BadJpegError);
    expect(() => cleanJpeg(makeJpeg({ width: 0 }))).toThrow(BadJpegError);
  });

  it('rejects a segment length running past the end', () => {
    const b = Buffer.from(makeJpeg());
    b.writeUInt16BE(0xfff0, 4); // APP0 length
    expect(() => cleanJpeg(b)).toThrow(BadJpegError);
  });
});
