/**
 * Minimal structural JPEG validator + metadata stripper (no decoding).
 * - must start with SOI (FFD8) and contain SOF (width/height), SOS and EOI
 * - APP1..APP15 (EXIF, XMP, ICC, Photoshop, ...) and COM segments are removed; APP0 (JFIF) is kept
 * - anything after EOI is dropped
 * Throws BadJpegError on malformed input.
 */
export class BadJpegError extends Error {}

export interface CleanJpeg {
  jpeg: Buffer;
  width: number;
  height: number;
}

const SOF_MARKERS = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

function isStandalone(m: number): boolean {
  return m === 0x01 || (m >= 0xd0 && m <= 0xd7);
}

function isStripped(m: number): boolean {
  return (m >= 0xe1 && m <= 0xef) || m === 0xfe;
}

export function cleanJpeg(input: Buffer): CleanJpeg {
  const buf = input;
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new BadJpegError('no SOI');
  const out: Buffer[] = [buf.subarray(0, 2)];
  let off = 2;
  let width = 0;
  let height = 0;
  let sawSos = false;

  while (true) {
    if (off >= buf.length) throw new BadJpegError('truncated');
    if (buf[off] !== 0xff) throw new BadJpegError('expected marker');
    // skip fill bytes
    while (off < buf.length && buf[off] === 0xff) off++;
    if (off >= buf.length) throw new BadJpegError('truncated');
    const m = buf[off];
    off++;
    if (m === 0x00) throw new BadJpegError('stray 0x00 marker');
    if (m === 0xd8) throw new BadJpegError('second SOI');
    if (m === 0xd9) {
      if (!sawSos || !width || !height) throw new BadJpegError('EOI before image data');
      out.push(Buffer.from([0xff, 0xd9]));
      break;
    }
    if (isStandalone(m)) {
      out.push(Buffer.from([0xff, m]));
      continue;
    }
    if (off + 2 > buf.length) throw new BadJpegError('truncated length');
    const len = buf.readUInt16BE(off);
    if (len < 2) throw new BadJpegError('bad segment length');
    const segEnd = off + len;
    if (segEnd > buf.length) throw new BadJpegError('segment past end');

    if (SOF_MARKERS.has(m)) {
      if (len < 8) throw new BadJpegError('short SOF');
      height = buf.readUInt16BE(off + 3);
      width = buf.readUInt16BE(off + 5);
      if (!width || !height) throw new BadJpegError('zero dimension');
    }
    if (!isStripped(m)) out.push(Buffer.from([0xff, m]), buf.subarray(off, segEnd));
    off = segEnd;

    if (m === 0xda) {
      if (!width || !height) throw new BadJpegError('SOS before SOF');
      sawSos = true;
      // entropy-coded data runs until a marker that is not FF00 / RSTn / fill
      const dataStart = off;
      while (true) {
        if (off + 1 >= buf.length) throw new BadJpegError('unterminated scan');
        if (buf[off] === 0xff) {
          const n = buf[off + 1];
          if (n === 0x00 || (n >= 0xd0 && n <= 0xd7)) {
            off += 2;
            continue;
          }
          if (n === 0xff) {
            off += 1; // fill byte, next loop iteration sees FF again
            continue;
          }
          break;
        }
        off++;
      }
      out.push(buf.subarray(dataStart, off));
    }
  }
  return { jpeg: Buffer.concat(out), width, height };
}
