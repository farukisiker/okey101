// B12 (Claude Sonnet): pure height budget of the GameShell header (no react-native import, so vitest can load it).

/** Window heights below this get the compact shell (6-inch phones in landscape: 375..430 dp). Tablets are 600+. */
export const COMPACT_MAX_HEIGHT = 500;
/** Compact top bar: 56 dp touch targets + 2 dp padding above and below; the status line lives inside it. */
export const COMPACT_BAR_HEIGHT = 60;
/** Compact opponents: one row, name + key stats at 15 pt (not interactive). */
export const COMPACT_OPPONENTS_HEIGHT = 36;
/** Tablet header estimate: top bar ~68 + opponents ~52 + status line ~36, trimmed to what the screens measured. */
export const FULL_HEADER_HEIGHT = 144;

export const isCompactShell = (windowHeight: number): boolean => windowHeight < COMPACT_MAX_HEIGHT;

export interface ShellHeaderBudget {
  compact: boolean;
  /** Top bar, including the status line when compact. */
  bar: number;
  opponents: number;
  /** Separate status line under the opponents (0 when compact: it moved into the bar). */
  status: number;
  total: number;
}

/**
 * Height GameShell's header takes. Compact: bar (with the status line merged in) + one opponent row = 96 dp.
 * Otherwise the old tablet estimate (144 dp, scaled by the tablet factor up to 1.2), unchanged.
 */
export function shellHeaderBudget(windowHeight: number, s = 1, hasOpponents = true): ShellHeaderBudget {
  if (isCompactShell(windowHeight)) {
    const opponents = hasOpponents ? COMPACT_OPPONENTS_HEIGHT : 0;
    return { compact: true, bar: COMPACT_BAR_HEIGHT, opponents, status: 0, total: COMPACT_BAR_HEIGHT + opponents };
  }
  const total = Math.round(FULL_HEADER_HEIGHT * Math.min(1.2, s));
  return { compact: false, bar: 68, opponents: 52, status: 36, total };
}

/** The clock's spoken value: rounded up to the next 10 s, so its label does not change every second. */
export function clockA11ySeconds(secondsLeft: number): number {
  return Math.max(0, Math.ceil(secondsLeft / 10) * 10);
}
