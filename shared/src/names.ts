import type { Rng } from './tiles';

/** Everyday Turkish first names for computer players. */
export const BOT_NAMES = [
  'Ahmet', 'Ayşe', 'Mehmet', 'Zeynep', 'Mustafa', 'Elif', 'Hasan', 'Fatma', 'Emre', 'Selin',
  'Murat', 'Hülya', 'Kemal', 'Esra', 'Burak', 'Derya', 'Osman', 'Gül', 'Serkan', 'Nur',
  'Cem', 'Melek', 'Yusuf', 'Sevgi', 'Okan', 'Leyla', 'Tarık', 'Canan', 'Volkan', 'Filiz',
];

/** `count` distinct names, avoiding names (or first names) already at the table. */
export function pickBotNames(count: number, taken: string[] = [], rng: Rng = Math.random): string[] {
  const takenLower = new Set(
    taken.flatMap((n) => {
      const full = n.trim().toLocaleLowerCase('tr');
      return [full, full.split(/\s+/)[0]];
    }),
  );
  const pool = BOT_NAMES.filter((n) => !takenLower.has(n.toLocaleLowerCase('tr')));
  const out: string[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}
