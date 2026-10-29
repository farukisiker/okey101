import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RACK_COLS } from './rackLayout';

/**
 * Game screen geometry (docs/tasarim/TASARIM.md §3): three fixed bands — header,
 * zones (draw · table · discard), actions — over a full-width rack. Sizes are
 * in pt relative to the safe area; `s` scales everything up on tablets.
 */
export interface GameLayout {
  s: number;
  usable: number;
  insL: number;
  insR: number;
  insB: number;
  tileW: number;
  tileH: number;
  rackH: number;
  gap: number;
  headH: number;
  zoneH: number;
  actH: number;
  cikW: number;
  sesW: number;
  okW: number;
  oppW: number;
  drawW: number;
  discW: number;
  pileW: number;
  pileH: number;
  sideH: number;
  meldCap: number;
  dizW: number;
  atW: number;
  acW: number;
  ag: number;
}

export function computeLayout(W: number, H: number, ins: { l: number; r: number; b: number }): GameLayout {
  const s = Math.min(1.6, Math.max(1, W / 852));
  const r = (v: number) => Math.round(v * s);
  const usable = W - ins.l - ins.r;
  const tileW = Math.max(40, Math.min(72, Math.floor((usable - 4) / RACK_COLS)));
  const tileH = Math.round(tileW * 1.38);
  const rackH = 2 * tileH + 12;
  const gap = 4;
  const headH = r(48);
  const actH = r(54);
  // Top to bottom: gap · header · gap · zones · gap · actions · 2 · rack · bottom inset.
  const zoneH = H - ins.b - rackH - 2 - actH - gap - (gap + headH + gap);
  const cikW = r(64);
  const sesW = r(48);
  const okW = r(124); // fits the longest okey name, "Kırmızı 13" / "Siyah 13"
  const oppW = Math.floor((usable - cikW - sesW - okW - r(42)) / 3);
  const drawW = r(160);
  const discW = r(110);
  // Zone box: border 3 + pulse frame 3 around the tile, plus the 18pt label line.
  const pileW = Math.max(30, Math.min(r(56), Math.floor((zoneH - 32) / 1.38)));
  const pileH = Math.round(pileW * 1.38);
  return {
    s,
    usable,
    insL: ins.l,
    insR: ins.r,
    insB: ins.b,
    tileW,
    tileH,
    rackH,
    gap,
    headH,
    zoneH,
    actH,
    cikW,
    sesW,
    okW,
    oppW,
    drawW,
    discW,
    pileW,
    pileH,
    // On tablets the side zones hug their tiles instead of stretching down.
    sideH: Math.min(zoneH, pileH + 32),
    meldCap: Math.max(30, Math.min(r(40), Math.floor((zoneH - 32) / 1.38))),
    dizW: r(110),
    atW: r(100),
    acW: r(164),
    ag: r(8),
  };
}

export function useGameLayout(): GameLayout {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return computeLayout(width, height - insets.top, { l: insets.left, r: insets.right, b: insets.bottom });
}
