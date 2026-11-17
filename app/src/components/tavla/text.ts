// C2: Tavla texts. The integrator moves these into the i18n files (see docs/kahve/i18n-istek-tavla.md) and drops this map.
export const TAVLA_TEXT = {
  tavlaUndo: 'Geri al',
  tavlaCommit: 'Tamam',
  tavlaPass: 'Oynayacak hamle yok — Pas',
  tavlaPickChecker: 'Sıra sende — oynayacağın pula dokun',
  tavlaPickTarget: 'Şimdi gideceğin yere dokun',
  tavlaPressDone: 'Hamlen bitti — Tamam\'a bas',
  tavlaNoMove: 'Zarlarla hamle yok',
  tavlaWaitingFor: 'Sıra {name} adlı oyuncuda',
  tavlaOpeningRoll: 'Büyük atan başlar',
  tavlaOpeningDie: '{name}: {n}',
  tavlaWhite: 'Beyaz',
  tavlaBlack: 'Siyah',
  tavlaPips: 'Pip {n}',
  tavlaOffCount: 'Toplanan {n}',
  tavlaScore: 'Skor {n} / {target}',
  tavlaBar: 'Bar',
  tavlaBearOff: 'Toplama alanı',
  tavlaPoint: '{n}. hane, {c} pul',
  tavlaPointEmpty: '{n}. hane, boş',
  tavlaKindTek: 'Tek',
  tavlaKindMars: 'Mars',
  tavlaKindKoncina: 'Konçina',
  tavlaResultNote: '{kind} — {n} sayı',
} as const;

export type TavlaKey = keyof typeof TAVLA_TEXT;

/** Same shape as t(): {name} placeholders are replaced. */
export function tt(key: TavlaKey, vars?: Record<string, string | number>): string {
  let s: string = TAVLA_TEXT[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
