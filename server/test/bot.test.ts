import { describe, expect, it } from 'vitest';
import {
  applyAction,
  createGame,
  okeyFromIndicator,
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

function playBotGame(seed: number) {
  let g = createGame({ rng: seededRng(seed), startingSeat: seed % 4 });
  let steps = 0;
  while (g.phase === 'playing') {
    const action = botStep(viewFor(g, g.turn));
    const r = applyAction(g, g.turn, action);
    if (!r.ok) throw new Error(`seed ${seed}: ${r.error} for ${JSON.stringify(action)}`);
    g = r.state;
    expect(countTiles(g)).toBe(106);
    if (++steps > 2000) throw new Error('game did not end');
  }
  return g;
}

describe('bot', () => {
  it('plays 40 full 4-bot rounds without illegal moves', () => {
    let opened = 0;
    let won = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = playBotGame(seed);
      expect(g.result).not.toBeNull();
      opened += g.players.filter((p) => p.opened).length;
      if (g.result!.winner !== null) won++;
    }
    expect(opened).toBeGreaterThan(0);
    console.log(`40 rounds: ${opened} openings, ${won} finished by a player`);
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
    const action = botStep(viewFor(rigged(hand), 0));
    expect(action.type).toBe('open');
  });

  it('never throws the okey and drops the loneliest tile', () => {
    const joker = t('red', 5);
    const lonely = t('blue', 12);
    const hand = [joker, t('black', 3), t('black', 4), t('yellow', 3), lonely, t('yellow', 7), t('yellow', 8)];
    const action = botStep(viewFor(rigged(hand), 0));
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
    expect(botStep(viewFor(g, 0))).toEqual({ type: 'draw', source: 'discard' });
    g.players[3].discards = [t('blue', 6)];
    expect(botStep(viewFor(g, 0))).toEqual({ type: 'draw', source: 'deck' });
  });
});
