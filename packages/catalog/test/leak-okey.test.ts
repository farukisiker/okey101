// B8: does `viewFor` leak hidden information in okey? The generic gates live in leak-harness.ts;
// this file is the okey probe (101 and düz) they are driven with. A new game adds a probe here,
// not a switch in the harness.
import { expect } from 'vitest';
import { seededRng, type GameMode, type GameState, type PlayerView } from '@okey/shared';
import { makeOkeyDef, type OkeyOptions } from '../src/okey';
import { BIG_SEED, registerLeakSuite, type LeakProbe } from './leak-harness';

const NAMES = ['Bot1', 'Bot2', 'Bot3', 'Bot4'];
const SEATS = 4;

/** The published view of @okey/shared PlayerView (22 keys; `noticeMsLeft` is never written). */
const VIEW_KEYS = [
  'mode',
  'seat',
  'phase',
  'indicator',
  'okey',
  'deckCount',
  'hand',
  'players',
  'table',
  'turn',
  'turnPhase',
  'turnNumber',
  'reshuffles',
  'mustUseTileId',
  'lastAction',
  'result',
  'revealedHands',
  'gosterge',
  'turnMsLeft',
  'notice',
  'notices',
  'islek',
];

/** Internal state keys that would give the seed or the hidden stack away. */
const FORBIDDEN_KEYS = ['seed', 'rng', 'random', 'shuffle', 'deck', 'state', 'reshufflesLeft', 'nextMeldId', 'startingSeat'];

const tileIds = (tiles: readonly { id: number }[]): number[] => tiles.map((tile) => tile.id);

/**
 * Tile ids the last action made public. A discarded tile sits on a pile everyone can see, and the
 * tile a player just took off a pile is on the view's `lastAction`; a draw from the stack carries
 * no tile at all, which is what keeps the stack order hidden.
 */
function lastActionIds(state: GameState): number[] {
  const action = state.lastAction;
  if (action === null) return [];
  switch (action.type) {
    case 'draw':
      return action.tile ? [action.tile.id] : [];
    case 'discard':
      return [action.tile.id];
    case 'finish':
      return [action.tile.id];
    case 'addToMeld':
      return [...action.tileIds];
    default:
      return []; // open / meld / showIndicator carry meld ids and counters, never tiles
  }
}

function okeyProbe(mode: GameMode): LeakProbe<GameState, PlayerView> {
  const def = makeOkeyDef(mode);
  const options: OkeyOptions = def.normalizeOptions(def.defaultOptions);
  const id = def.id;

  const turnOf = (state: GameState) => {
    const turn = def.turn(state);
    if (turn === null) throw new Error(`${id}: turn() is null while the round is playing`);
    return turn;
  };

  return {
    name: id,
    seats: SEATS,
    viewKeys: VIEW_KEYS,
    forbiddenKeys: FORBIDDEN_KEYS,

    rng: (seed) => seededRng(seed),
    deal: (seed) => def.create(options, NAMES, seededRng(seed), seed % SEATS),
    step: (state, _step, rng) => {
      const turn = turnOf(state);
      const result = def.apply(state, turn.seat, def.botMove(state, turn.seat, 'medium', rng));
      if (!result.ok) throw new Error(`${id}: bot move rejected: ${result.error}`);
      return result.state;
    },
    playing: (state) => def.turn(state) !== null,
    turnSeat: (state) => turnOf(state).seat,
    view: (state, seat) => def.viewFor(state, seat),

    clone: (state) => JSON.parse(JSON.stringify(state)) as GameState,
    hiddenIds: (state, seat) => {
      // The tile the previous player just took off a pile is on the view's `lastAction`, so it is
      // public history rather than hidden information; the rest of the stack and the other hands
      // are hidden from `seat`.
      const taken = new Set(lastActionIds(state));
      const keep = (tile: { id: number }) => !taken.has(tile.id);
      return [
        ...state.deck.filter(keep).map((tile) => tile.id),
        ...state.players.filter((p) => p.seat !== seat).flatMap((p) => p.hand.filter(keep).map((tile) => tile.id)),
      ];
    },
    publicIds: (state, seat) => [
      ...tileIds(state.players[seat].hand),
      ...state.players.flatMap((p) => tileIds(p.discards)),
      ...state.table.flatMap((meld) => tileIds(meld.tiles)),
      state.indicator.id,
      ...lastActionIds(state),
    ],
    handCount: (state, seat) => state.players[seat].hand.length,
    deckCount: (state) => state.deck.length,

    hideMore: (state, target) => {
      // Nothing here may reach `target`'s view: the stack order, the opponents' hand order, two
      // opponents' hands swapped wholesale, and the reshuffle seed.
      state.deck = [...state.deck].reverse();
      const opponents = state.players.filter((p) => p.seat !== target);
      for (const p of opponents) p.hand = [...p.hand].reverse();
      const first = opponents.findIndex((p, i) => opponents.slice(i + 1).some((q) => q.hand.length === p.hand.length));
      if (first !== -1) {
        const second = opponents.findIndex((q, i) => i > first && q.hand.length === opponents[first].hand.length);
        const hand = opponents[first].hand;
        opponents[first].hand = opponents[second].hand;
        opponents[second].hand = hand;
      }
      state.seed = BIG_SEED;
    },
    scrambleOwnHand: (state, seat) => {
      const hand = state.players[seat].hand;
      if (hand.length < 2) return false;
      state.players[seat].hand = [...hand].reverse();
      return true;
    },
    checkView: (state, seat, view) => {
      const label = `${id} seat=${seat}`;
      // positive controls: everything the view calls public matches the state exactly
      expect(view.mode, `${label}: mode`).toBe(state.mode);
      expect(view.seat, `${label}: seat`).toBe(seat);
      expect(view.phase, `${label}: phase`).toBe('playing');
      expect(view.indicator, `${label}: indicator`).toEqual(state.indicator);
      expect(view.okey, `${label}: okey`).toEqual(state.okey);
      expect(view.hand.map((tile) => tile.id), `${label}: own hand, in order`).toEqual(tileIds(state.players[seat].hand));
      expect(view.players.map((p) => tileIds(p.discards)), `${label}: discards`).toEqual(
        state.players.map((p) => tileIds(p.discards)),
      );
      expect(view.players.map((p) => p.opened), `${label}: opened`).toEqual(state.players.map((p) => p.opened));
      expect(view.players.map((p) => p.pairs), `${label}: pairs`).toEqual(state.players.map((p) => p.pairs));
      expect(view.players.map((p) => p.penalties), `${label}: penalties`).toEqual(state.players.map((p) => p.penalties));
      expect(view.table.map((meld) => tileIds(meld.tiles)), `${label}: table`).toEqual(
        state.table.map((meld) => tileIds(meld.tiles)),
      );
      expect(view.turn, `${label}: turn`).toBe(state.turn);
      expect(view.turnPhase, `${label}: turnPhase`).toBe(state.turnPhase);
      expect(view.turnNumber, `${label}: turnNumber`).toBe(state.turnNumber);
      expect(view.reshuffles, `${label}: reshuffles`).toBe(state.reshuffles);
      expect(view.deckCount, `${label}: deckCount`).toBe(state.deck.length);
      expect(view.gosterge, `${label}: gosterge`).toBe(state.gosterge);
      expect(view.islek, `${label}: islek`).toBe(state.islek);
      expect(view.notice, `${label}: notice`).toEqual(state.notice ?? null);
      expect(view.notices, `${label}: notices`).toEqual(state.notices ?? []);
      // the probe passes no clock, so the view must say so instead of inventing a time
      expect(view.turnMsLeft, `${label}: turnMsLeft`).toBeNull();
      // the reveal exception only exists once the round is over
      expect(view.revealedHands, `${label}: revealedHands while playing`).toBeNull();
      // mustUseTileId belongs to the seat to move; everyone else is told null
      expect(view.mustUseTileId, `${label}: mustUseTileId`).toBe(state.turn === seat ? state.mustUseTileId : null);
      // a seat with no tiles left would have ended the round
      expect(view.players.every((p) => p.handCount > 0), `${label}: an empty hand while playing`).toBe(true);
    },
    checkRevealed: (state) => {
      expect(def.roundOver(state), `${id}: the round did not end inside the step cap`).toBe(true);
      for (let seat = 0; seat < SEATS; seat++) {
        const view = def.viewFor(state, seat);
        const label = `${id} seat=${seat} (round over)`;
        expect(view.phase, `${label}: phase`).toBe('finished');
        // the documented exception: every hand is public once the round is over, in state order
        expect(view.revealedHands, `${label}: revealedHands`).toEqual(state.players.map((p) => p.hand));
        expect(view.result, `${label}: result`).toEqual(state.result);
        expect(view.deckCount, `${label}: deckCount`).toBe(state.deck.length);
      }
    },
  };
}

// 25 seeds per mode (KAHVE_LEAK_SEEDS overrides): 101 is fast, düz is the slow one.
registerLeakSuite(okeyProbe('101'), { seeds: 25 });
registerLeakSuite(okeyProbe('duz'), { seeds: 25 });


