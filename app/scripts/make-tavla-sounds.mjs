// C2: synthesizes the Tavla sounds (dice rolling, checker tap, checker hit) as small 22.05 kHz mono 16-bit wavs.
// Run from app/: node scripts/make-tavla-sounds.mjs
import { writeFileSync } from 'node:fs';

const RATE = 22050;
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;

function render(seconds, hits) {
  const out = new Float32Array(Math.floor(seconds * RATE));
  for (const h of hits) {
    const start = Math.floor(h.at * RATE);
    const len = Math.floor(h.len * RATE);
    let lp = 0;
    for (let i = 0; i < len && start + i < out.length; i++) {
      const t = i / RATE;
      const env = Math.exp(-t / h.decay) * Math.min(1, i / 20);
      lp += 0.35 * (rnd() - lp); // dull noise: a wooden knock
      const tone = Math.sin(2 * Math.PI * h.freq * t) + 0.4 * Math.sin(2 * Math.PI * h.freq * 2.3 * t);
      out[start + i] += h.amp * env * (h.noise * lp * 2 + (1 - h.noise) * tone * 0.7);
    }
  }
  return out;
}

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24);
  buf.writeUInt32LE(RATE * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const k = peak > 0 ? 0.8 / peak : 1;
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * k)) * 32767), 44 + i * 2));
  return buf;
}

// Dice: a dozen clacks that get softer and sparser, like two dice rattling on a table.
const clacks = [];
let at = 0;
for (let i = 0; i < 13; i++) {
  clacks.push({ at, len: 0.07, decay: 0.012, freq: 1400 + rnd() * 700, amp: 1 - i * 0.065, noise: 0.55 });
  at += 0.018 + i * 0.012 + Math.abs(rnd()) * 0.02;
}
writeFileSync('assets/sounds/dice-roll.wav', wav(render(0.62, clacks)));
// One checker set down: a short dull knock.
writeFileSync('assets/sounds/checker-move.wav', wav(render(0.16, [{ at: 0, len: 0.15, decay: 0.03, freq: 520, amp: 1, noise: 0.5 }])));
// A hit: heavier knock followed by a second, higher clack.
writeFileSync('assets/sounds/checker-hit.wav', wav(render(0.3, [
  { at: 0, len: 0.2, decay: 0.05, freq: 330, amp: 1, noise: 0.45 },
  { at: 0.09, len: 0.15, decay: 0.03, freq: 760, amp: 0.7, noise: 0.5 },
])));
