// B5 (Claude Opus): the end-of-hand summary GameShell shows, built from plain numbers so any card game can use it.
import type { RoundSummary, RoundSummaryRow } from '../components/roundSummary';

export interface CardSummaryInput {
  /** Seat names (index = seat). */
  names: readonly string[];
  /** This hand's points per seat (pişti partner mode: [A, B, A, B]). */
  points: readonly number[];
  /** Match totals per seat, this hand included. */
  totals: readonly number[];
  matchOver: boolean;
  /** Team per seat (index = seat). Missing or a seat's own number: everyone for themselves. */
  teams?: readonly (number | undefined)[];
  mySeat: number;
  /** Translated "you", used inside a team row ("Sen & Ayşe"); a single-seat row is named by GameShell. */
  you: string;
}

/**
 * One row per seat, or one per team in partner games (team mates share their points, so a team is listed once,
 * under its first seat). The winners are every seat of the best team(s): by this hand's points, or by the match
 * totals when the match is over. Nobody wins when everyone is level.
 */
export function cardSummary(p: CardSummaryInput): RoundSummary {
  const teamOf = (seat: number) => p.teams?.[seat] ?? seat;
  const groups: number[][] = [];
  const byTeam = new Map<number, number[]>();
  p.names.forEach((_, seat) => {
    const team = teamOf(seat);
    let g = byTeam.get(team);
    if (!g) {
      g = [];
      byTeam.set(team, g);
      groups.push(g);
    }
    g.push(seat);
  });
  const rows: RoundSummaryRow[] = groups.map((g) => ({
    seat: g[0],
    name: g.length === 1 ? p.names[g[0]] : g.map((s) => (s === p.mySeat ? p.you : p.names[s])).join(' & '),
    points: p.points[g[0]] ?? 0,
    total: p.totals[g[0]] ?? 0,
  }));
  const score = (r: RoundSummaryRow) => (p.matchOver ? r.total : r.points);
  const best = Math.max(...rows.map(score));
  const top = groups.filter((_, i) => score(rows[i]) === best);
  const winnerSeats = top.length === groups.length ? [] : top.flat();
  return { rows, matchOver: p.matchOver, winnerSeats };
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/**
 * This hand's points from a card game's view, by the shared convention `view.result.scores` (pişti, batak;
 * okey's PlayerView too). Null while the hand is still being played.
 */
export function viewScores(view: unknown): number[] | null {
  if (!isRecord(view) || !isRecord(view.result)) return null;
  const s = view.result.scores;
  return Array.isArray(s) && s.every((n) => typeof n === 'number') ? (s as number[]) : null;
}

/** Team per seat from `view.players[].{seat, team}` when the game has teams (pişti does), else undefined. */
export function viewTeams(view: unknown): (number | undefined)[] | undefined {
  if (!isRecord(view) || !Array.isArray(view.players)) return undefined;
  const teams: (number | undefined)[] = [];
  for (const pl of view.players) {
    if (isRecord(pl) && typeof pl.seat === 'number' && typeof pl.team === 'number') teams[pl.seat] = pl.team;
  }
  return teams.length ? teams : undefined;
}
