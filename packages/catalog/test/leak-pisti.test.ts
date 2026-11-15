// B8 ADIM 2: does `viewFor` leak hidden information in pişti? The generic gates live in
// leak-harness.ts; this file is the pişti probe they are driven with. The three seat shapes
// (2, 4 solo, 4 partner) and both `hiddenCards` settings get their own suite, because the secret
// pile is exactly what differs between them.
import { expect } from 'vitest';
import type { Card } from '@kahve/cards';
import { seededRng } from '@kahve/core';
import { pistiDef, type PistiOptions, type PistiState, type PistiView } from '@kahve/pisti';
import { BIG_SEED, registerLeakSuite, type LeakProbe } from './leak-harness';

/** The published top-level keys of @kahve/pisti PistiView (19; `openingCard` is always written). */
const VIEW_KEYS = [
  'options',
  'round',
  'dealer',
  'seat',
  'turn',
  'turnNumber',
  'phase',
  'hand',
  'topCard',
  'centerCount',
  'deckCount',
  'playableCardIds',
  'players',
  'openingCard',
  'publicHistory',
  'lastAction',
  'lastCapture',
  'result',
  'clock',
];

/** Internal state keys that would give the seed, the deck order or the hidden pile away. */
const FORBIDDEN_KEYS = [
  'seed',
  'rng',
  'random',
  'shuffle',
  'deck',
  'cards',
  'state',
  'hiddenOpeningCardIds',
  'captured',
  'pistis',
  'lastCapturer',
  'centerPile',
];

type PistiMode = { seats: 2 | 4; partnerMode: boolean; hiddenCards: 'reveal' | 'secret' };

/**
 * Card ids a view shows. @kahve/cards has no `kind` marker, so the harness's own collectViewIds()
 * (built for @okey/shared tiles) finds nothing in a pişti view; this walk catches card-shaped
 * objects (`{ id, suit, rank }`) plus the explicit id lists of the contract (`playableCardIds`).
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
    if (typeof record.id === 'number' && typeof record.suit === 'string' && typeof record.rank === 'number')
      ids.push(record.id);
    const playable = record.playableCardIds;
    if (Array.isArray(playable)) for (const id of playable) if (typeof id === 'number') ids.push(id);
    for (const nested of Object.values(record)) walk(nested, seen);
  };
  walk(value, new Set());
  return ids;
}

function pistiProbe(mode: PistiMode): LeakProbe<PistiState, PistiView> {
  const options: PistiOptions = pistiDef.normalizeOptions({ ...pistiDef.defaultOptions, ...mode });
  const seats = options.seats;
  const names = Array.from({ length: seats }, (_, i) => `Bot${i + 1}`);
  const id = `${pistiDef.id}-${seats}p${mode.partnerMode ? '/partner' : ''}/${mode.hiddenCards}`;

  const cardIds = (cards: readonly Card[]): number[] => cards.map((c) => c.id);
  const topOf = (state: PistiState): Card | null => state.centerPile.at(-1) ?? null;

  /**
   * Ids `seat` must not see: the undealt deck (so neither its order nor its cards), the other
   * seats' hands, and the opening cards that are still face down. `hiddenOpeningCardIds` is the
   * engine's own list of those; it is empty once a capture made them public history, which is why
   * 'reveal' and 'secret' can share this one definition.
   */
  const hiddenIds = (state: PistiState, seat: number): number[] => [
    ...cardIds(state.deck),
    ...state.players.filter((p) => p.seat !== seat).flatMap((p) => cardIds(p.hand)),
    ...state.hiddenOpeningCardIds,
  ];

  /**
   * Ids `seat` may see: its own hand, every card of the public history (played cards and, in
   * 'reveal' mode, the opening cards a capture turned face up), the face-up opening card, the top
   * of the pile and the card of the last capture. The pile count is public by rule; its order is
   * not in the view at all.
   */
  const publicIds = (state: PistiState, seat: number): number[] => {
    const top = topOf(state);
    return [
      ...cardIds(state.players[seat].hand),
      ...state.publicHistory.flatMap((event) => [...event.revealedCards, event.card].map((c) => c.id)),
      ...(state.openingCard ? [state.openingCard.id] : []),
      ...(top ? [top.id] : []),
      ...(state.lastCapture ? [state.lastCapture.cardId] : []),
    ];
  };

  return {
    name: id,
    seats,
    viewKeys: VIEW_KEYS,
    forbiddenKeys: FORBIDDEN_KEYS,

    rng: (seed) => seededRng(seed),
    deal: (seed) => pistiDef.create(options, names, seededRng(seed), seed % seats),
    step: (state, _step, rng) => {
      const turn = pistiDef.turn(state);
      if (turn === null) throw new Error(`${id}: turn() is null while the round is playing`);
      const action = pistiDef.botMove(state, turn.seat, 'medium', rng);
      if (!pistiDef.isAction(action)) throw new Error(`${id}: the bot produced a malformed action`);
      const result = pistiDef.apply(state, turn.seat, action);
      if (!result.ok) throw new Error(`${id}: bot move rejected: ${result.error}`);
      return result.state;
    },
    playing: (state) => pistiDef.turn(state) !== null,
    turnSeat: (state) => {
      const turn = pistiDef.turn(state);
      if (turn === null) throw new Error(`${id}: turn() is null while the round is playing`);
      return turn.seat;
    },
    view: (state, seat) => pistiDef.viewFor(state, seat),

    clone: (state) => JSON.parse(JSON.stringify(state)) as PistiState,
    hiddenIds,
    publicIds,
    handCount: (state, seat) => state.players[seat].hand.length,
    deckCount: (state) => state.deck.length,

    hideMore: (state, target) => {
      // The permutation test: nothing here may reach `target`'s view. The deck order, the
      // opponents' hand order, two opponents' hands swapped wholesale, the face-down opening cards
      // permuted among themselves with one identity swapped into the deck, and the seed.
      // `centerPile.at(-1)` stays untouched: the top card is public.
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
      const faceDownCount = state.hiddenOpeningCardIds.length;
      if (faceDownCount > 1 && faceDownCount < state.centerPile.length && state.deck.length > 0) {
        const block = state.centerPile.slice(0, faceDownCount).reverse();
        state.centerPile.splice(0, faceDownCount, ...block);
        [state.centerPile[0], state.deck[0]] = [state.deck[0], state.centerPile[0]];
        state.hiddenOpeningCardIds = state.centerPile.slice(0, faceDownCount).map((c) => c.id);
      }
      (state as PistiState & { seed?: number }).seed = BIG_SEED;
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
      expect(view.options, `${label}: options`).toEqual(state.options);
      expect(view.round, `${label}: round`).toBe(state.round);
      expect(view.dealer, `${label}: dealer`).toBe(state.dealer);
      expect(view.seat, `${label}: seat`).toBe(seat);
      expect(view.turn, `${label}: turn`).toBe(state.phase === 'playing' ? state.turn : null);
      expect(view.turnNumber, `${label}: turnNumber`).toBe(state.turnNumber);
      expect(view.phase, `${label}: phase`).toBe(state.phase);
      expect(view.hand, `${label}: own hand, in state order`).toEqual(state.players[seat].hand);
      expect(view.hand.map((c) => c.id), `${label}: own hand ids`).toEqual(cardIds(state.players[seat].hand));
      expect(view.topCard, `${label}: topCard`).toEqual(topOf(state));
      expect(view.centerCount, `${label}: centerCount`).toBe(state.centerPile.length);
      expect(view.deckCount, `${label}: deckCount`).toBe(state.deck.length);
      // only the seat to move is handed its playable ids
      const myTurn = state.phase === 'playing' && state.turn === seat;
      expect(view.playableCardIds, `${label}: playableCardIds`).toEqual(myTurn ? cardIds(state.players[seat].hand) : []);
      expect(view.players, `${label}: players`).toEqual(
        state.players.map((p) => ({
          seat: p.seat,
          name: p.name,
          team: state.options.partnerMode ? p.seat % 2 : p.seat,
          handCount: p.hand.length,
          capturedCount: state.captured[p.seat].length,
          pistiCount: state.pistis[p.seat].length,
        })),
      );
      expect(view.openingCard, `${label}: openingCard`).toEqual(state.openingCard);
      expect(view.publicHistory, `${label}: publicHistory`).toEqual(state.publicHistory);
      expect(view.lastAction, `${label}: lastAction`).toEqual(state.lastAction);
      expect(view.lastCapture, `${label}: lastCapture`).toEqual(state.lastCapture);
      expect(view.result, `${label}: result`).toEqual(state.result);
      // the probe passes no clock, so the view must say so instead of inventing a time
      expect(view.clock, `${label}: clock`).toBeNull();

      // 1) @kahve/cards has no `kind`, so the harness's own id gate cannot see these: no hidden
      // card id may appear in the view, and every card id in it must be genuinely public.
      const shown = collectCardIds(view);
      const hidden = new Set(hiddenIds(state, seat));
      const open = new Set(publicIds(state, seat));
      expect(
        [...new Set(shown.filter((cardId) => hidden.has(cardId)))],
        `${label}: hidden card ids (deck, other hands, face-down opening cards) leaked into the view`,
      ).toEqual([]);
      expect(
        [...new Set(shown.filter((cardId) => !open.has(cardId)))],
        `${label}: card ids in the view that are not public`,
      ).toEqual([]);

      // The three face-down opening cards: neither id nor object may show up while they are face
      // down. In 'secret' mode they never become public at all; in 'reveal' mode only a capture
      // publishes them, and then the engine drops them from `hiddenOpeningCardIds`.
      const serialized = JSON.stringify(view);
      for (const card of state.centerPile.filter((c) => state.hiddenOpeningCardIds.includes(c.id))) {
        expect(shown, `${label}: face-down opening card id ${card.id}`).not.toContain(card.id);
        expect(serialized, `${label}: the object of face-down opening card ${card.id}`).not.toContain(
          JSON.stringify(card),
        );
      }
    },
    checkRevealed: (state) => {
      expect(pistiDef.roundOver(state), `${id}: the round did not end inside the step cap`).toBe(true);
      expect(state.players.every((p) => p.hand.length === 0), `${id}: a hand left at round end`).toBe(true);
      expect(state.deck.length, `${id}: cards left in the deck at round end`).toBe(0);
      for (let seat = 0; seat < seats; seat++) {
        const view = pistiDef.viewFor(state, seat);
        const label = `${id} seat=${seat} (round over)`;
        expect(view.phase, `${label}: phase`).toBe('finished');
        expect(view.turn, `${label}: turn`).toBeNull();
        expect(view.hand, `${label}: hand`).toEqual([]);
        expect(view.playableCardIds, `${label}: playableCardIds`).toEqual([]);
        expect(view.deckCount, `${label}: deckCount`).toBe(0);
        expect(view.centerCount, `${label}: centerCount`).toBe(state.centerPile.length);
        expect(view.topCard, `${label}: topCard`).toEqual(topOf(state));
        expect(view.result, `${label}: result`).toEqual(state.result);
        expect(view.result, `${label}: result is missing`).not.toBeNull();
        // the cards nobody ever played stay hidden after the last trick too
        const shown = collectCardIds(view);
        for (const hiddenId of state.hiddenOpeningCardIds)
          expect(shown, `${label}: face-down opening card id ${hiddenId}`).not.toContain(hiddenId);
        // in 'secret' mode no capture ever publishes them, not even the last one
        if (state.options.hiddenCards === 'secret')
          expect(
            state.publicHistory.every((event) => event.revealedCards.length === 0),
            `${label}: a face-down opening card reached the public history`,
          ).toBe(true);
      }
    },
  };
}

// 25 seeds per suite (KAHVE_LEAK_SEEDS overrides it): 2 seats, 4 solo and 4 partner, each with the
// opening cards revealed on capture and with them kept secret for the whole round.
const MODES: PistiMode[] = [
  { seats: 2, partnerMode: false, hiddenCards: 'reveal' },
  { seats: 2, partnerMode: false, hiddenCards: 'secret' },
  { seats: 4, partnerMode: false, hiddenCards: 'reveal' },
  { seats: 4, partnerMode: false, hiddenCards: 'secret' },
  { seats: 4, partnerMode: true, hiddenCards: 'reveal' },
  { seats: 4, partnerMode: true, hiddenCards: 'secret' },
];

for (const mode of MODES) registerLeakSuite(pistiProbe(mode), { seeds: 25 });
