import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  okeyFromIndicator,
  pickBotNames,
  seededRng,
  viewFor,
  type Color,
  type GameState,
  type Tile,
} from '@okey/shared';
import { botStep } from '../src/bot';

let nextId = 7000;
const t = (color: Color, value: number): Tile => ({ id: nextId++, kind: 'normal', color, value });

function countTiles(g: GameState) {
  return (
    1 +
    g.deck.length +
    g.table.reduce((s, m) => s + m.tiles.length, 0) +
    g.players.reduce((s, p) => s + p.hand.length + p.discards.length, 0)
  );
}

function playBotGame(seed: number, level: 'medium' | 'hard' = 'medium') {
  let g = createGame({ rng: seededRng(seed), startingSeat: seed % 4 });
  const rngs = [0, 1, 2, 3].map((i) => seededRng(seed * 10 + i));
  let steps = 0;
  while (g.phase === 'playing') {
    const action = botStep(viewFor(g, g.turn), { level, rng: rngs[g.turn] });
    const r = applyAction(g, g.turn, action);
    if (!r.ok) throw new Error(`seed ${seed}: ${r.error} for ${JSON.stringify(action)}`);
    g = r.state;
    expect(countTiles(g)).toBe(106);
    if (++steps > 2000) throw new Error('game did not end');
  }
  return g;
}

describe('bot', () => {
  it.each(['medium', 'hard'] as const)('%s: plays 40 full 4-bot rounds without illegal moves', (level) => {
    let opened = 0;
    let won = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = playBotGame(seed, level);
      expect(g.result).not.toBeNull();
      opened += g.players.filter((p) => p.opened).length;
      if (g.result!.winner !== null) won++;
    }
    expect(opened).toBeGreaterThan(0);
    console.log(`${level}, 40 rounds: ${opened} openings, ${won} finished by a player`);
  });

  function rigged(hand: Tile[]) {
    const g = createGame({ rng: seededRng(2) });
    g.indicator = { id: 9999, kind: 'normal', color: 'red', value: 4 };
    g.okey = okeyFromIndicator(g.indicator);
    g.players[0].hand = hand;
    return g;
  }

  it('opens when the hand is worth 101+', () => {
    const hand = [
      t('blue', 13), t('black', 13), t('yellow', 13),
      t('black', 10), t('black', 11), t('black', 12),
      t('yellow', 9), t('yellow', 10), t('yellow', 11),
      t('blue', 1), t('yellow', 4),
    ];
    expect(botStep(viewFor(rigged(hand), 0), { level: 'hard' }).type).toBe('open');
  });

  it('a medium bot waits before opening, then opens once the deck runs low', () => {
    const hand = [
      t('blue', 13), t('black', 13), t('yellow', 13),
      t('black', 10), t('black', 11), t('black', 12),
      t('yellow', 9), t('yellow', 10), t('yellow', 11),
      t('blue', 1), t('yellow', 4),
    ];
    const g = rigged(hand);
    const patient = () => 0.99;
    expect(botStep(viewFor(g, 0), { rng: patient }).type).toBe('discard');
    g.deck = g.deck.slice(0, 8);
    expect(botStep(viewFor(g, 0), { rng: patient }).type).toBe('open');
  });

  it('gives computer players distinct everyday names', () => {
    const names = pickBotNames(3, ['Ayşe']);
    expect(new Set(names).size).toBe(3);
    expect(names).not.toContain('Ayşe');
    expect(names.every((n) => !/bot/i.test(n))).toBe(true);
  });

  it('never throws the okey and drops the loneliest tile', () => {
    const joker = t('red', 5);
    const lonely = t('blue', 12);
    const hand = [joker, t('black', 3), t('black', 4), t('yellow', 3), lonely, t('yellow', 7), t('yellow', 8)];
    const action = botStep(viewFor(rigged(hand), 0), { level: 'hard' });
    expect(action).toEqual({ type: 'discard', tileId: lonely.id });
  });

  it('takes the left discard when it completes a 101 opening', () => {
    const hand = [
      t('blue', 13), t('black', 13),
      t('black', 10), t('black', 11), t('black', 12),
      t('yellow', 9), t('yellow', 10), t('yellow', 11),
      t('blue', 1), t('red', 2),
    ];
    const g = rigged(hand);
    g.turn = 0;
    g.turnPhase = 'draw';
    g.players[3].discards = [t('yellow', 13)];
    expect(botStep(viewFor(g, 0), { level: 'hard' })).toEqual({ type: 'draw', source: 'discard' });
    g.players[3].discards = [t('blue', 6)];
    expect(botStep(viewFor(g, 0), { level: 'hard' })).toEqual({ type: 'draw', source: 'deck' });
  });
});
