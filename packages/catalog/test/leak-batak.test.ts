// B8 ADIM 2 (batak): does `viewFor` leak hidden information in batak? The generic gates live in
// leak-harness.ts; this file is the batak probe they are driven with (a new game adds a probe here,
// not a switch in the harness). Batak deals the whole 52-card deck (4 x 13, no stock is left over),
// so the only hidden information is the other seats' hands and the order the deal put them in; the
// harness suite samples the bidding, the trump selection and the playing phase of every seeded round.
import { describe, expect, it } from 'vitest';
import { sortHand, type Card } from '@kahve/cards';
import { seededRng } from '@kahve/core';
import { batakDef, legalCardsFor, type BatakOptions, type BatakPhase, type BatakState, type BatakView } from '@kahve/batak';
import { BIG_SEED, registerLeakSuite, type LeakProbe } from './leak-harness';

const SEATS = 4; // batakDef.seatChoices = [4]
const HAND_SIZE = 13; // 4 x 13 = 52: every card of the deck is dealt, none stays hidden in a stock
const DECK_SIZE = 52;
const LEVEL = 'medium' as const; // one bot level for every seat, so a seeded round is reproducible

/** The published top-level keys of @kahve/batak BatakView (27). */
const VIEW_KEYS = [
  'options',
  'variant',
  'round',
  'targetRounds',
  'dealer',
  'seat',
  'turn',
  'turnNumber',
  'phase',
  'hand',
  'legalCardIds',
  'players',
  'minBid',
  'highestBid',
  'highestBidder',
  'canPass',
  'declarer',
  'contract',
  'forcedBid',
  'trump',
  'trumpBroken',
  'currentTrick',
  'lastTrick',
  'lastTrickWinner',
  'tricks',
  'lastAction',
  'result',
];

/**
 * Internal state keys that would give the seed, the deal order or another hand away. None of them is
 * a view key: the view carries `players[].bid`, not the whole `bids` array, and `tricks` /
 * `currentTrick` (played face up) instead of `hands`.
 */
const FORBIDDEN_KEYS = ['seed', 'rng', 'random', 'shuffle', 'deck', 'remaining', 'hands', 'bids', 'state'];

/**
 * Card ids a view shows. @kahve/cards has no `kind` marker, so the harness's own collectViewIds()
 * (built for @okey/shared tiles) finds nothing in a batak view; this walk catches card-shaped objects
 * (`{ id, suit, rank }`) plus the explicit id fields of the contract (`legalCardIds`, and the
 * `cardId` of a played `lastAction`, whose card lies on the table for everyone).
 */
function collectCardIds(value: unknown): number[] {
  const ids: number[] = [];
  const walk = (node: unknown, seen: Set<unknown>) => {
    if (node === null || typeof node !== 'object') return;
    if (seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) walk(item, seen);
      return;
    }
    const record = node as Record<string, unknown>;
    if (typeof record.id === 'number' && typeof record.suit === 'string' && typeof record.rank === 'number') ids.push(record.id);
    const legal = record.legalCardIds;
    if (Array.isArray(legal)) for (const cardId of legal) if (typeof cardId === 'number') ids.push(cardId);
    if (typeof record.cardId === 'number') ids.push(record.cardId);
    for (const nested of Object.values(record)) walk(nested, seen);
  };
  walk(value, new Set());
  return ids;
}

/** Views per phase that the harness really sampled; the companion test below asserts on this. */
const sampled: Record<BatakPhase, number> = { bidding: 0, selectingTrump: 0, playing: 0, finished: 0 };

const cardIds = (cards: readonly Card[]): number[] => cards.map((card) => card.id);

function batakProbe(): LeakProbe<BatakState, BatakView> {
  const options: BatakOptions = batakDef.normalizeOptions(batakDef.defaultOptions);
  const id = batakDef.id;
  const names = Array.from({ length: SEATS }, (_, seat) => `Bot${seat + 1}`);

  /** Every card played so far this round: the finished tricks first, then the open trick. */
  const playedCards = (state: BatakState): Card[] => [
    ...state.tricks.flatMap((trick) => trick.cards.map((played) => played.card)),
    ...state.currentTrick.map((played) => played.card),
  ];
  /** Ids `seat` must not see: the other seats' hands, and with them the order of the deal. */
  const hiddenIds = (state: BatakState, seat: number): number[] =>
    state.players.filter((player) => player.seat !== seat).flatMap((player) => cardIds(player.hand));
  /** Ids `seat` may see: its own hand plus every card played face up on the table. */
  const publicIds = (state: BatakState, seat: number): number[] => [
    ...cardIds(state.players[seat].hand),
    ...cardIds(playedCards(state)),
  ];

  return {
    name: id,
    seats: SEATS,
    viewKeys: VIEW_KEYS,
    forbiddenKeys: FORBIDDEN_KEYS,

    rng: (seed) => seededRng(seed),
    // `round = seed % SEATS`, so the deal and the seat that speaks first rotate with the seed.
    deal: (seed) => batakDef.create(options, names, seededRng(seed), seed % SEATS),
    step: (state, _step, rng) => {
      const turn = batakDef.turn(state);
      if (turn === null) throw new Error(`${id}: turn() is null while the round is playing`);
      const action = batakDef.botMove(state, turn.seat, LEVEL, rng);
      if (!batakDef.isAction(action)) throw new Error(`${id}: the bot produced a malformed action`);
      const result = batakDef.apply(state, turn.seat, action);
      if (!result.ok) throw new Error(`${id}: bot move rejected: ${result.error}`);
      return result.state;
    },
    playing: (state) => batakDef.turn(state) !== null,
    turnSeat: (state) => {
      const turn = batakDef.turn(state);
      if (turn === null) throw new Error(`${id}: turn() is null while the round is playing`);
      return turn.seat;
    },
    view: (state, seat) => batakDef.viewFor(state, seat),

    clone: (state) => JSON.parse(JSON.stringify(state)) as BatakState,
    hiddenIds,
    publicIds,
    handCount: (state, seat) => state.players[seat].hand.length,
    // Batak deals all 52 cards, there is no stock, and BatakView has no `deckCount` field at all;
    // the harness's stack gate therefore compares undefined with undefined here.
    deckCount: () => undefined as unknown as number,

    hideMore: (state, target) => {
      // The permutation test: nothing in here may reach `target`'s view. The other three hands are
      // reversed (the deal's order inside a hidden hand) and then shuffled among themselves with one
      // card moving on to the next hand, which keeps every handCount; finally the seed is written
      // into the state. `target`'s own hand, the trick and the bidding stay untouched (all public).
      const others = state.players.filter((player) => player.seat !== target);
      for (const player of others) player.hand = [...player.hand].reverse();
      const sizes = others.map((player) => player.hand.length);
      const pool = others.flatMap((player) => player.hand);
      if (pool.length > 1) pool.push(pool.shift() as Card);
      let at = 0;
      for (let i = 0; i < others.length; i++) {
        others[i].hand = pool.slice(at, at + sizes[i]);
        at += sizes[i];
      }
      // BatakState has no seed field; the view must not pick this extra key up either.
      (state as BatakState & { seed?: number }).seed = BIG_SEED;
    },
    scrambleOwnHand: (state, seat) => {
      const hand = state.players[seat].hand;
      if (hand.length < 2) return false;
      // `viewFor` sorts the hand (S,H,D,C; rank descending), so reversing it in place would still
      // give the same view. The positive control therefore trades one card of the seat's own hand
      // with a card of another hand: the own hand changes, so the view has to change with it.
      const donor = state.players.find((player) => player.seat !== seat && player.hand.length > 0);
      if (!donor) return false;
      const mine = hand[0];
      hand[0] = donor.hand[0];
      donor.hand[0] = mine;
      return true;
    },

    checkView: (state, seat, view) => {
      const label = `${id} seat=${seat}`;
      sampled[view.phase] += 1;

      // positive controls: everything the view calls public matches the state exactly
      expect(view.options, `${label}: options`).toEqual(state.options);
      expect(view.variant, `${label}: variant`).toBe(state.options.variant);
      expect(view.round, `${label}: round`).toBe(state.round);
      expect(view.targetRounds, `${label}: targetRounds`).toBe(state.options.targetRounds);
      expect(view.dealer, `${label}: dealer`).toBe(state.dealer);
      expect(view.seat, `${label}: seat`).toBe(seat);
      expect(view.turn, `${label}: turn`).toBe(state.phase === 'finished' ? null : state.turn);
      expect(view.turnNumber, `${label}: turnNumber`).toBe(state.turnNumber);
      expect(view.phase, `${label}: phase`).toBe(state.phase);
      // the seat's own hand is public to itself, sorted for display (S,H,D,C; rank descending)
      const ownHand = sortHand(state.players[seat].hand, 'desc');
      expect(view.hand, `${label}: own hand, sorted for display`).toEqual(ownHand);
      expect(view.hand.map((card) => card.id), `${label}: own hand ids`).toEqual(cardIds(ownHand));
      // legalCardIds is the engine's own list and always a subset of the seat's own hand
      const handIds = new Set(cardIds(state.players[seat].hand));
      expect(view.legalCardIds, `${label}: legalCardIds`).toEqual(cardIds(legalCardsFor(state, seat)));
      expect(
        view.legalCardIds.filter((cardId) => !handIds.has(cardId)),
        `${label}: a legalCardId outside the seat's own hand`,
      ).toEqual([]);
      // another seat is a count, never a hand
      expect(view.players, `${label}: players`).toEqual(
        state.players.map((player) => ({
          seat: player.seat,
          name: player.name,
          handCount: player.hand.length,
          tricksWon: state.tricksWon[player.seat],
          bid: state.bids[player.seat] ?? (state.passed[player.seat] ? 0 : null),
          passed: state.passed[player.seat],
          isDeclarer: state.declarer === player.seat,
        })),
      );
      expect(view.minBid, `${label}: minBid`).toBe(state.options.minBid);
      expect(view.highestBid, `${label}: highestBid`).toBe(state.highestBid);
      expect(view.highestBidder, `${label}: highestBidder`).toBe(state.highestBidder);
      expect(view.canPass, `${label}: canPass`).toBe(state.phase === 'bidding');
      expect(view.declarer, `${label}: declarer`).toBe(state.declarer);
      expect(view.contract, `${label}: contract`).toBe(state.contract);
      expect(view.forcedBid, `${label}: forcedBid`).toBe(state.forcedBid);
      expect(view.trump, `${label}: trump`).toBe(state.trump);
      expect(view.trumpBroken, `${label}: trumpBroken`).toBe(state.trumpBroken);
      // the open trick and every finished trick are public: they were played face up
      expect(view.currentTrick, `${label}: currentTrick`).toEqual(state.currentTrick);
      expect(view.tricks, `${label}: tricks`).toEqual(state.tricks);
      const lastTrick = state.tricks.length > 0 ? state.tricks[state.tricks.length - 1] : null;
      expect(view.lastTrick, `${label}: lastTrick`).toEqual(lastTrick);
      expect(view.lastTrickWinner, `${label}: lastTrickWinner`).toBe(lastTrick ? lastTrick.winner : null);
      expect(view.lastAction, `${label}: lastAction`).toEqual(state.lastAction);
      expect(view.result, `${label}: result`).toEqual(state.result);

      // positive control: every card that was played on the table shows up in the view
      const shown = collectCardIds(view);
      const shownIds = new Set(shown);
      for (const card of playedCards(state))
        expect(shownIds.has(card.id), `${label}: the played card ${card.id} is missing from the view`).toBe(true);

      // gate 1 again: @kahve/cards has no `kind` marker, so the harness's own id scan finds nothing
      // in a batak view; the ids are collected above instead
      const hidden = new Set(hiddenIds(state, seat));
      expect(
        [...new Set(shown.filter((cardId) => hidden.has(cardId)))],
        `${label}: hidden card ids (other hands, the deal order) leaked into the view`,
      ).toEqual([]);
      const open = new Set(publicIds(state, seat));
      expect([...new Set(shown.filter((cardId) => !open.has(cardId)))], `${label}: card ids in the view that are not public`).toEqual([]);
      // and no object of another hand may show up either: the id+suit+rank of a hidden card
      const serialized = JSON.stringify(view);
      for (const player of state.players) {
        if (player.seat === seat) continue;
        for (const card of player.hand)
          expect(serialized, `${label}: the object of the hidden card ${card.id}`).not.toContain(JSON.stringify(card));
      }
    },
    checkRevealed: (state) => {
      expect(batakDef.roundOver(state), `${id}: the round did not end inside the step cap`).toBe(true);
      expect(state.tricks.length, `${id}: finished tricks at round end`).toBe(HAND_SIZE);
      expect(state.currentTrick.length, `${id}: a trick left open at round end`).toBe(0);
      expect(state.players.every((player) => player.hand.length === 0), `${id}: a hand left at round end`).toBe(true);
      expect(state.tricksWon.reduce((sum, won) => sum + won, 0), `${id}: tricksWon at round end`).toBe(HAND_SIZE);
      expect(state.result, `${id}: result at round end`).not.toBeNull();
      // the whole deck lies on the table once the last trick is over: nothing stays hidden
      const played = cardIds(playedCards(state));
      expect(new Set(played).size, `${id}: distinct cards played at round end`).toBe(DECK_SIZE);
      for (let seat = 0; seat < SEATS; seat++) {
        const view = batakDef.viewFor(state, seat);
        const label = `${id} seat=${seat} (round over)`;
        expect(view.phase, `${label}: phase`).toBe('finished');
        expect(view.turn, `${label}: turn`).toBeNull();
        expect(view.hand, `${label}: hand`).toEqual([]);
        expect(view.legalCardIds, `${label}: legalCardIds`).toEqual([]);
        expect(view.currentTrick, `${label}: currentTrick`).toEqual([]);
        expect(view.tricks.length, `${label}: tricks`).toBe(HAND_SIZE);
        expect(view.lastTrick, `${label}: lastTrick`).toEqual(state.tricks[HAND_SIZE - 1]);
        expect(view.result, `${label}: result`).toEqual(state.result);
        expect(view.players.every((player) => player.handCount === 0), `${label}: a handCount left at round end`).toBe(true);
        // every card of the deal is face up now, so the finished view shows all 52 card ids
        const shownIds = new Set(collectCardIds(view));
        for (const cardId of played)
          expect(shownIds.has(cardId), `${label}: the played card ${cardId} is missing from the finished view`).toBe(true);
        expect(shownIds.size, `${label}: distinct card ids in the finished view`).toBe(DECK_SIZE);
      }
    },
  };
}

// 25 seeds by default (KAHVE_LEAK_SEEDS overrides it). `sampleEvery: 1` on purpose: the one-step
// trump selection and the short bidding phase must be sampled as well, not only the playing phase.
registerLeakSuite(batakProbe(), { seeds: 25, sampleEvery: 1 });

// The harness suite samples the views; this counter (filled by checkView) proves the sampled set
// really covered all three phases of a round. Vitest runs the tests of a file in declaration order,
// so the harness suite above has filled the counter by the time this one runs; if the sampling ever
// stops reaching a phase, this fails loudly instead of quietly checking less than it claims.
describe('viewFor leaks: batak phase coverage', () => {
  it('sampled the bidding, the trump selection and the playing phase', () => {
    expect(sampled.bidding).toBeGreaterThan(0);
    expect(sampled.selectingTrump).toBeGreaterThan(0);
    expect(sampled.playing).toBeGreaterThan(0);
    // the finished state is never handed to checkView: checkRevealed covers the round end instead
    expect(sampled.finished).toBe(0);
  });
});
