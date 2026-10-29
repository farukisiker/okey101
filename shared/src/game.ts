import { type MeldAnalysis, type MeldType, analyzeMeld } from './melds';
import {
  type NormalTile,
  type OkeyInfo,
  type Rng,
  type Tile,
  createTileSet,
  isJoker,
  okeyFromIndicator,
  penaltyValue,
  seededRng,
  shuffle,
} from './tiles';

export const SEATS = 4;
export const OPEN_THRESHOLD = 101;
export const NOT_OPENED_PENALTY = 202;
export const FINISH_BONUS = -101;
export const UNUSED_DISCARD_PENALTY = 101;
/** How many times the discards may be reshuffled into a new middle stack. */
export const DEFAULT_RESHUFFLES = 3;

export interface PlayerState {
  seat: number;
  name: string;
  hand: Tile[];
  discards: Tile[];
  opened: boolean;
  openedOnTurn: number | null;
  penalties: number;
}

export interface TableMeld {
  id: number;
  owner: number;
  type: MeldType;
  points: number;
  tiles: Tile[];
  /** Tile ids in display order. */
  ordered: number[];
  represents: MeldAnalysis['represents'];
}

export type TurnPhase = 'draw' | 'play';

export interface RoundResult {
  winner: number | null;
  okeyFinish: boolean;
  elden: boolean;
  multiplier: number;
  /** Points per seat for this round (lower is better). */
  scores: number[];
}

export type LastAction =
  | { seat: number; type: 'draw'; source: 'deck' | 'discard'; tile?: Tile }
  | { seat: number; type: 'discard'; tile: Tile }
  | { seat: number; type: 'open'; meldIds: number[]; points: number }
  | { seat: number; type: 'meld'; meldId: number }
  | { seat: number; type: 'addToMeld'; meldId: number; tileIds: number[] };

export interface GameState {
  phase: 'playing' | 'finished';
  indicator: NormalTile;
  okey: OkeyInfo;
  deck: Tile[];
  players: PlayerState[];
  table: TableMeld[];
  startingSeat: number;
  turn: number;
  turnPhase: TurnPhase;
  turnNumber: number;
  /** Tile taken from the left player's discards this turn; must be played. */
  mustUseTileId: number | null;
  nextMeldId: number;
  lastAction: LastAction | null;
  result: RoundResult | null;
  /** Reshuffles of the discards still allowed when the middle stack runs out. */
  reshufflesLeft: number;
  /** Reshuffles done so far this round. */
  reshuffles: number;
  /** Seed for reshuffling, so the reducer stays pure and replayable. */
  seed: number;
}

export type Action =
  | { type: 'draw'; source: 'deck' | 'discard' }
  | { type: 'open'; melds: number[][] }
  | { type: 'meld'; tileIds: number[] }
  | { type: 'addToMeld'; meldId: number; tileIds: number[] }
  | { type: 'discard'; tileId: number };

export type ActionResult = { ok: true; state: GameState } | { ok: false; error: string };

export interface NewGameOptions {
  names?: string[];
  startingSeat?: number;
  rng?: Rng;
  /**
   * When the middle runs out, shuffle the discards (all but the last one thrown)
   * into a new middle stack up to this many times; 0 ends the round instead.
   */
  reshuffles?: number;
}

export const leftOf = (seat: number) => (seat + SEATS - 1) % SEATS;
export const nextSeat = (seat: number) => (seat + 1) % SEATS;

export function createGame(opts: NewGameOptions = {}): GameState {
  const rng = opts.rng ?? Math.random;
  const startingSeat = opts.startingSeat ?? 0;
  const deck = shuffle(createTileSet(), rng);

  const indicatorIdx = deck.findIndex((t) => t.kind === 'normal');
  const indicator = deck.splice(indicatorIdx, 1)[0] as NormalTile;

  const players: PlayerState[] = [];
  for (let i = 0; i < SEATS; i++) {
    const seat = (startingSeat + i) % SEATS;
    players[seat] = {
      seat,
      name: opts.names?.[seat] ?? `Oyuncu ${seat + 1}`,
      hand: deck.splice(0, i === 0 ? 22 : 21),
      discards: [],
      opened: false,
      openedOnTurn: null,
      penalties: 0,
    };
  }

  return {
    phase: 'playing',
    indicator,
    okey: okeyFromIndicator(indicator),
    deck,
    players,
    table: [],
    startingSeat,
    turn: startingSeat,
    turnPhase: 'play', // starting player holds 22 tiles and only discards
    turnNumber: 0,
    mustUseTileId: null,
    nextMeldId: 1,
    lastAction: null,
    result: null,
    reshufflesLeft: opts.reshuffles ?? DEFAULT_RESHUFFLES,
    reshuffles: 0,
    seed: Math.floor(rng() * 2 ** 31),
  };
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const fail = (error: string): ActionResult => ({ ok: false, error });

/** Pure reducer: returns a new state, never mutates the input. */
export function applyAction(prev: GameState, seat: number, action: Action): ActionResult {
  if (prev.phase !== 'playing') return fail('Oyun bitti');
  if (seat !== prev.turn) return fail('Sıra sizde değil');
  const state = clone(prev);
  const player = state.players[seat];

  switch (action.type) {
    case 'draw': {
      if (state.turnPhase !== 'draw') return fail('Bu tur zaten taş çektiniz');
      let tile: Tile | undefined;
      if (action.source === 'deck') {
        tile = state.deck.pop();
        if (!tile) return fail('Ortada taş kalmadı');
      } else {
        tile = state.players[leftOf(seat)].discards.pop();
        if (!tile) return fail('Solunuzda atılmış taş yok');
        state.mustUseTileId = tile.id;
      }
      player.hand.push(tile);
      state.turnPhase = 'play';
      state.lastAction =
        action.source === 'deck'
          ? { seat, type: 'draw', source: 'deck' }
          : { seat, type: 'draw', source: 'discard', tile };
      return { ok: true, state };
    }

    case 'open': {
      if (state.turnPhase !== 'play') return fail('Önce taş çekmelisiniz');
      if (player.opened) return fail('Zaten açtınız');
      if (action.melds.length === 0) return fail('Per seçilmedi');
      const groups = takeGroups(player.hand, action.melds);
      if (typeof groups === 'string') return fail(groups);
      const analyses: MeldAnalysis[] = [];
      for (const g of groups) {
        const a = analyzeMeld(g, state.okey);
        if (!a) return fail('Geçersiz per: ' + g.map(tileText).join(' '));
        analyses.push(a);
      }
      const total = analyses.reduce((s, a) => s + a.points, 0);
      if (total < OPEN_THRESHOLD) return fail(`Açmak için en az ${OPEN_THRESHOLD} gerekli (${total})`);
      const used = new Set(action.melds.flat());
      const keep = keepsDiscard(state, player, used);
      if (keep) return fail(keep);
      player.hand = player.hand.filter((t) => !used.has(t.id));
      const meldIds = groups.map((g, i) => addTableMeld(state, seat, g, analyses[i]));
      player.opened = true;
      player.openedOnTurn = state.turnNumber;
      state.lastAction = { seat, type: 'open', meldIds, points: total };
      return { ok: true, state };
    }

    case 'meld': {
      if (state.turnPhase !== 'play') return fail('Önce taş çekmelisiniz');
      if (!player.opened) return fail('Önce elinizi açmalısınız');
      const groups = takeGroups(player.hand, [action.tileIds]);
      if (typeof groups === 'string') return fail(groups);
      const a = analyzeMeld(groups[0], state.okey);
      if (!a) return fail('Geçersiz per');
      const ids = new Set(action.tileIds);
      const keep = keepsDiscard(state, player, ids);
      if (keep) return fail(keep);
      player.hand = player.hand.filter((t) => !ids.has(t.id));
      const meldId = addTableMeld(state, seat, groups[0], a);
      state.lastAction = { seat, type: 'meld', meldId };
      return { ok: true, state };
    }

    case 'addToMeld': {
      if (state.turnPhase !== 'play') return fail('Önce taş çekmelisiniz');
      if (!player.opened) return fail('İşlemek için önce açmalısınız');
      const meld = state.table.find((m) => m.id === action.meldId);
      if (!meld) return fail('Per bulunamadı');
      const groups = takeGroups(player.hand, [action.tileIds]);
      if (typeof groups === 'string') return fail(groups);
      const keep = keepsDiscard(state, player, new Set(action.tileIds));
      if (keep) return fail(keep);
      const a = analyzeMeld([...meld.tiles, ...groups[0]], state.okey);
      if (!a || a.type !== meld.type) return fail('Bu taş bu pere işlenemez');
      const ids = new Set(action.tileIds);
      player.hand = player.hand.filter((t) => !ids.has(t.id));
      Object.assign(meld, {
        tiles: [...meld.tiles, ...groups[0]],
        points: a.points,
        ordered: a.ordered,
        represents: a.represents,
      });
      state.lastAction = { seat, type: 'addToMeld', meldId: meld.id, tileIds: action.tileIds };
      return { ok: true, state };
    }

    case 'discard': {
      if (state.turnPhase !== 'play') return fail('Önce taş çekmelisiniz');
      const idx = player.hand.findIndex((t) => t.id === action.tileId);
      if (idx < 0) return fail('Taş elinizde değil');
      if (state.mustUseTileId !== null && action.tileId === state.mustUseTileId)
        return fail('Yerden aldığınız taşı geri atamazsınız');
      if (state.mustUseTileId !== null && player.hand.some((t) => t.id === state.mustUseTileId)) {
        // Took the left player's discard but did not play it.
        player.penalties += UNUSED_DISCARD_PENALTY;
      }
      const [tile] = player.hand.splice(idx, 1);
      player.discards.push(tile);
      state.lastAction = { seat, type: 'discard', tile };
      state.mustUseTileId = null;

      if (player.hand.length === 0) {
        finishRound(state, seat, isJoker(tile, state.okey));
      } else if (state.deck.length === 0 && !reshuffleDiscards(state, seat)) {
        finishRound(state, null, false);
      } else {
        state.turn = nextSeat(seat);
        state.turnPhase = 'draw';
        state.turnNumber++;
      }
      return { ok: true, state };
    }
  }
}

/**
 * Middle stack is empty: shuffle every discard except the one just thrown
 * (the next player may still take it) into a new middle stack.
 */
function reshuffleDiscards(state: GameState, discarder: number): boolean {
  if (state.reshufflesLeft <= 0) return false;
  const pool: Tile[] = [];
  for (const p of state.players) {
    const keep = p.seat === discarder ? p.discards.pop() : undefined;
    pool.push(...p.discards);
    p.discards = keep ? [keep] : [];
  }
  if (pool.length === 0) return false;
  state.reshufflesLeft--;
  state.reshuffles++;
  state.deck = shuffle(pool, seededRng(state.seed + state.reshuffles));
  return true;
}

/**
 * Playing tiles must leave something legal to discard: at least one tile, and
 * not just the tile taken from the left player (it may not be thrown back).
 */
function keepsDiscard(state: GameState, player: PlayerState, used: Set<number>): string | null {
  const rest = player.hand.filter((t) => !used.has(t.id));
  if (rest.length === 0) return 'Atmak için elinizde bir taş kalmalı';
  if (rest.length === 1 && rest[0].id === state.mustUseTileId) {
    return 'Yerden aldığınız taş elde tek başına kalamaz; onu kullanın';
  }
  return null;
}

function takeGroups(hand: Tile[], groups: number[][]): Tile[][] | string {
  const byId = new Map(hand.map((t) => [t.id, t]));
  const seen = new Set<number>();
  const out: Tile[][] = [];
  for (const ids of groups) {
    const g: Tile[] = [];
    for (const id of ids) {
      const t = byId.get(id);
      if (!t) return 'Taş elinizde değil';
      if (seen.has(id)) return 'Aynı taş iki kez kullanılamaz';
      seen.add(id);
      g.push(t);
    }
    out.push(g);
  }
  return out;
}

function addTableMeld(state: GameState, owner: number, tiles: Tile[], a: MeldAnalysis): number {
  const id = state.nextMeldId++;
  state.table.push({ id, owner, type: a.type, points: a.points, tiles, ordered: a.ordered, represents: a.represents });
  return id;
}

/**
 * Scoring (lower is better):
 * - winner: -101
 * - opened players: sum of tiles left in hand (okey in hand = 101)
 * - not opened: 202
 * Finishing with the okey and finishing "elden" (opening and finishing in the
 * same turn) each double the round. Unused discard pickups add 101.
 */
export function scoreRound(state: GameState, winner: number | null, okeyFinish: boolean): RoundResult {
  const w = winner === null ? null : state.players[winner];
  const elden = !!w && w.openedOnTurn === state.turnNumber;
  const multiplier = winner === null ? 1 : (okeyFinish ? 2 : 1) * (elden ? 2 : 1);
  const scores = state.players.map((p) => {
    let s: number;
    if (p.seat === winner) s = FINISH_BONUS * multiplier;
    else if (!p.opened) s = NOT_OPENED_PENALTY * multiplier;
    else s = p.hand.reduce((sum, t) => sum + penaltyValue(t, state.okey), 0) * multiplier;
    return s + p.penalties;
  });
  return { winner, okeyFinish, elden, multiplier, scores };
}

function finishRound(state: GameState, winner: number | null, okeyFinish: boolean) {
  state.phase = 'finished';
  state.result = scoreRound(state, winner, okeyFinish);
}

export function tileText(t: Tile): string {
  return t.kind === 'fake' ? 'S.Okey' : `${t.color[0].toUpperCase()}${t.value}`;
}

// ---- Views (hidden information) ----

export interface PublicPlayer {
  seat: number;
  name: string;
  handCount: number;
  discards: Tile[];
  opened: boolean;
  penalties: number;
}

export interface PlayerView {
  seat: number;
  phase: GameState['phase'];
  indicator: NormalTile;
  okey: OkeyInfo;
  deckCount: number;
  hand: Tile[];
  players: PublicPlayer[];
  table: TableMeld[];
  turn: number;
  turnPhase: TurnPhase;
  turnNumber: number;
  /** Times the discards were reshuffled into the middle this round. */
  reshuffles: number;
  mustUseTileId: number | null;
  lastAction: LastAction | null;
  result: RoundResult | null;
  /** All hands are revealed once the round is over. */
  revealedHands: Tile[][] | null;
}

export function viewFor(state: GameState, seat: number): PlayerView {
  return {
    seat,
    phase: state.phase,
    indicator: state.indicator,
    okey: state.okey,
    deckCount: state.deck.length,
    hand: state.players[seat].hand,
    players: state.players.map((p) => ({
      seat: p.seat,
      name: p.name,
      handCount: p.hand.length,
      discards: p.discards,
      opened: p.opened,
      penalties: p.penalties,
    })),
    table: state.table,
    turn: state.turn,
    turnPhase: state.turnPhase,
    turnNumber: state.turnNumber,
    reshuffles: state.reshuffles,
    mustUseTileId: state.turn === seat ? state.mustUseTileId : null,
    lastAction: state.lastAction,
    result: state.result,
    revealedHands: state.phase === 'finished' ? state.players.map((p) => p.hand) : null,
  };
}
