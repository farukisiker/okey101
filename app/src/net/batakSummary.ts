// B11 (Claude Sonnet): the one-line contract note under the Batak end-of-hand headline.

export interface BatakNoteInput {
  declarer: number | null;
  contract: number;
  /** Tricks won per seat (index = seat). */
  tricksWon: readonly number[];
  /** This hand's points per seat. */
  scores: readonly number[];
  /** Seat names (index = seat). */
  names: readonly string[];
  mySeat: number;
  /** Translated "you". */
  you: string;
}

export interface BatakNote {
  key: 'batakNoteMade' | 'batakNoteFailed';
  vars: { name: string; n: number; pts: string };
}

/** "+6" / "−6" (a real minus sign, easier to read than a hyphen); 0 stays "0". */
export function signedPoints(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `\u2212${-n}` : '0';
}

/** Who bid what, whether they made it and what it scored. Null while no contract exists. */
export function batakNote(p: BatakNoteInput): BatakNote | null {
  if (p.declarer == null || p.contract <= 0) return null;
  const made = (p.tricksWon[p.declarer] ?? 0) >= p.contract;
  return {
    key: made ? 'batakNoteMade' : 'batakNoteFailed',
    vars: {
      name: p.declarer === p.mySeat ? p.you : (p.names[p.declarer] ?? String(p.declarer + 1)),
      n: p.contract,
      pts: signedPoints(p.scores[p.declarer] ?? 0),
    },
  };
}

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/**
 * The note for a Batak view of a finished hand (any other view, or one still in play: undefined).
 * `translate` is the app's t(); passed in so this stays pure.
 */
export function batakNoteFromView(
  view: unknown,
  scores: readonly number[] | null,
  names: readonly string[],
  mySeat: number,
  you: string,
  translate: (key: BatakNote['key'], vars: BatakNote['vars']) => string,
): string | undefined {
  if (!scores || !isRecord(view) || typeof view.contract !== 'number' || !Array.isArray(view.players)) return undefined;
  const declarer = typeof view.declarer === 'number' ? view.declarer : null;
  const tricksWon: number[] = [];
  for (const pl of view.players) {
    if (isRecord(pl) && typeof pl.seat === 'number' && typeof pl.tricksWon === 'number') tricksWon[pl.seat] = pl.tricksWon;
  }
  const note = batakNote({ declarer, contract: view.contract, tricksWon, scores, names, mySeat, you });
  return note ? translate(note.key, note.vars) : undefined;
}
