// C2: pure Tavla layout maths (no react-native import). All numbers are dp.
import { shellHeaderBudget } from '../shellBudget';
import { pointCell } from './boardMath';

/** Frame around the board, inside the outer size. */
export const FRAME = 4;
const PAD = 8;
/** A point is this many checker diameters tall: 5 stacked checkers (overlapped) + room for the point number. */
const POINT_D = 5.3;
/** Ratios to the checker diameter: column, bar, bear-off tray. 12 columns + bar + tray = 15.84 diameters. */
const COL = 1.12;
const BAR = 1.1;
const TRAY = 1.3;
const BOARD_D = 12 * COL + BAR + TRAY;
export const MAX_D = 64;

export interface Insets {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface TavlaGeom {
  /** Window is short (< 500 dp high): phones in landscape. */
  compact: boolean;
  /** 'side': controls right of the board. 'stack': controls under it (narrow windows). */
  mode: 'side' | 'stack';
  /** Room for everything below the GameShell header. */
  areaW: number;
  areaH: number;
  /** Checker diameter and the vertical step between stacked checkers. */
  d: number;
  step: number;
  colW: number;
  barW: number;
  trayW: number;
  pointH: number;
  rowGap: number;
  /** Inner board size (without frame). */
  boardW: number;
  boardH: number;
  /** Space the controls (dice, hint, buttons) get. */
  panelW: number;
  panelH: number;
  /** Space around the whole thing. */
  insets: Insets;
  /** Height of one bear-off checker in the tray. */
  trayItemH: number;
}

export function computeTavlaGeom(width: number, height: number, insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 }): TavlaGeom {
  const head = shellHeaderBudget(height);
  const compact = head.compact;
  const areaW = Math.max(200, width - insets.left - insets.right - 2 * PAD);
  const areaH = Math.max(120, height - head.total - insets.bottom - 2 * PAD);
  const rowGap = compact ? 6 : 12;
  const mode: 'side' | 'stack' = areaW >= 700 || (compact && areaW >= 520) ? 'side' : 'stack';
  const gap = 12;
  const panelWide = Math.min(400, Math.max(250, Math.round(areaW * 0.3)));
  const availBoardW = (mode === 'side' ? areaW - panelWide - gap : areaW) - 2 * FRAME;
  const ctrlMin = mode === 'stack' ? 150 : 0;
  const dH = (areaH - 2 * FRAME - rowGap - ctrlMin) / 2 / POINT_D;
  const dW = availBoardW / BOARD_D;
  const d = Math.max(14, Math.floor(Math.min(dH, dW, MAX_D)));
  const step = Math.round(d * 0.84);
  const colW = Math.round(d * COL);
  const barW = Math.round(d * BAR);
  const trayW = Math.round(d * TRAY);
  const pointH = Math.round(d * POINT_D);
  const boardW = 12 * colW + barW + trayW;
  const boardH = 2 * pointH + rowGap;
  const outerW = boardW + 2 * FRAME;
  const outerH = boardH + 2 * FRAME;
  const panelW = mode === 'side' ? Math.max(200, areaW - outerW - gap) : areaW;
  const panelH = mode === 'side' ? areaH : Math.max(120, areaH - outerH - gap);
  return {
    compact, mode, areaW, areaH, d, step, colW, barW, trayW, pointH, rowGap, boardW, boardH,
    panelW, panelH, insets, trayItemH: Math.max(4, Math.floor((pointH - 26) / 15)),
  };
}

export const colX = (g: TavlaGeom, col: number): number => (col < 6 ? col * g.colW : 6 * g.colW + g.barW + (col - 6) * g.colW);
export const barX = (g: TavlaGeom): number => 6 * g.colW;
export const trayX = (g: TavlaGeom): number => 12 * g.colW + g.barW;
export const rowY = (g: TavlaGeom, row: 'top' | 'bottom'): number => (row === 'top' ? 0 : g.pointH + g.rowGap);

export type Loc = { k: 'point'; n: number } | { k: 'bar'; seat: number } | { k: 'off'; seat: number };

/** Where the `index`-th checker (0 = the first one down) of a stack sits: its centre inside the inner board. */
export function slotCenter(g: TavlaGeom, viewer: number, loc: Loc, index: number): { x: number; y: number } {
  if (loc.k === 'point') {
    const { row, col } = pointCell(loc.n, viewer);
    const i = Math.min(index, 4);
    const x = colX(g, col) + g.colW / 2;
    const y = row === 'bottom' ? g.boardH - g.d / 2 - i * g.step : g.d / 2 + i * g.step;
    return { x, y };
  }
  if (loc.k === 'bar') {
    const i = Math.min(index, 4);
    const x = barX(g) + g.barW / 2;
    const off = g.d / 2 + 6 + i * g.step;
    return { x, y: loc.seat === viewer ? g.boardH / 2 + off : g.boardH / 2 - off };
  }
  const i = Math.min(index, 14);
  const x = trayX(g) + g.trayW / 2;
  const off = 4 + g.trayItemH * i + g.trayItemH / 2;
  return { x, y: loc.seat === viewer ? g.boardH - off : off };
}
