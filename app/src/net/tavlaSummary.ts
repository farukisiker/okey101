// C3 (Claude Opus): the end-of-game numbers for Tavla, read from a TavlaView (pure, like batakSummary.ts).
// Tavla's result is { winner, kind, points }, not the card games' `result.scores`, so useKahveGame asks here.

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

type Kind = 'tek' | 'mars' | 'koncina';
const KINDS: readonly Kind[] = ['tek', 'mars', 'koncina'];

function resultOf(view: unknown): { winner: number; kind: Kind; points: number; seats: number } | null {
  if (!isRecord(view) || !isRecord(view.result) || !Array.isArray(view.players)) return null;
  const { winner, kind, points } = view.result;
  if (typeof winner !== 'number' || typeof points !== 'number' || !KINDS.includes(kind as Kind)) return null;
  return { winner, kind: kind as Kind, points, seats: view.players.length };
}

/** This game's points per seat ([p, 0] or [0, p]) from a finished Tavla view; null otherwise. */
export function tavlaPointsFromView(view: unknown): number[] | null {
  const r = resultOf(view);
  if (!r) return null;
  return Array.from({ length: r.seats }, (_, seat) => (seat === r.winner ? r.points : 0));
}

export type TavlaNoteKey = 'tavlaKindTek' | 'tavlaKindMars' | 'tavlaKindKoncina' | 'tavlaResultNote';
const KIND_KEY: Record<Kind, TavlaNoteKey> = { tek: 'tavlaKindTek', mars: 'tavlaKindMars', koncina: 'tavlaKindKoncina' };

/** "Mars — 2 sayı" under the headline of a finished Tavla game (any other view: undefined). `translate` is t(). */
export function tavlaNoteFromView(view: unknown, translate: (key: TavlaNoteKey, vars?: Record<string, string | number>) => string): string | undefined {
  const r = resultOf(view);
  if (!r) return undefined;
  return translate('tavlaResultNote', { kind: translate(KIND_KEY[r.kind]), n: r.points });
}
