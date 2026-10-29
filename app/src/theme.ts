import type { Color } from '@okey/shared';

export const colors = {
  felt: '#0b3d2e',
  feltLight: '#145a43',
  wood: '#6d4c2f',
  woodDark: '#4a321e',
  tile: '#fbf6e9',
  tileBorder: '#c9bfa6',
  text: '#f4f1e8',
  muted: '#a9c2b6',
  accent: '#f2b632',
  danger: '#e45858',
  ok: '#5fd07d',
  /** Panels on the felt: opponents, draw/discard zones, okey box. */
  panel: '#07301f',
  /** Opponent whose turn it is. */
  activePanel: '#3a3415',
  tileBack: '#e8dcc0',
};

export const tileColors: Record<Color, string> = {
  red: '#d0312d',
  yellow: '#b57400', // darker than classic okey yellow: readable on the ivory tile
  blue: '#1f5fbf',
  black: '#1d1d1d',
};

export const colorNames: Record<Color, string> = {
  red: 'Kırmızı',
  yellow: 'Sarı',
  blue: 'Mavi',
  black: 'Siyah',
};

/** A distinct mark per colour so colour-blind players can tell tiles apart. */
export const colorMarks: Record<Color, string> = {
  red: '●',
  yellow: '▲',
  blue: '■',
  black: '◆',
};

/** Type scale for older players: nothing smaller than 15pt. */
export const font = {
  small: 15,
  body: 18,
  status: 22,
  title: 28,
};
