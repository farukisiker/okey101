/**
 * @kahve/core: the contract every game in Demli Kahve implements.
 *
 * FROZEN (A0, owner: Fable). Teams read this file, they don't edit it.
 * Change requests go to docs/kahve/requests/<team>-<topic>.md.
 *
 * Rules for every game package:
 * - Pure functions only. `create` + the same list of actions always gives the same state
 *   (the server keeps seed + action log per table to replay bug reports and run bot sims).
 * - State `S`, action `A`, view `V` and options `Opts` must survive JSON.stringify/parse:
 *   plain objects, arrays, strings, numbers, booleans, null. No Map/Set/class/Date/undefined-holes.
 * - `apply` never mutates its input and never throws on bad input; it returns `{ ok: false }`.
 *   The server validates every action with `apply`; the client's hint lists are cosmetic only.
 * - `viewFor` never leaks hidden information: other players' hands, deck order, the seed, rng state.
 */

/** Every game the app knows about, including the ones shown as "Yakında". */
export type GameId =
  | 'okey101'
  | 'okeyDuz'
  | 'pisti'
  | 'batak'
  | 'tavla'
  // soon (listed, not playable)
  | 'king'
  | 'konken'
  | 'elli1';

export const GAME_IDS: readonly GameId[] = ['okey101', 'okeyDuz', 'pisti', 'batak', 'tavla', 'king', 'konken', 'elli1'];

export const isGameId = (x: unknown): x is GameId => typeof x === 'string' && (GAME_IDS as readonly string[]).includes(x);

/** The four table groups on the Kahve Salonu screen. */
export type TableGroup = 'okey' | 'kagit' | 'tavla' | 'dama';

/** Random source in [0, 1). Same shape as `Rng` in @okey/shared/tiles.ts (structurally identical on purpose). */
export type Rng = () => number;

/**
 * Bot strength. UI names: easy = "Acemi", medium = "Orta", hard = "Usta".
 * Okey's bot only has medium/hard; its adapter maps easy -> medium.
 */
export type BotLevel = 'easy' | 'medium' | 'hard';

export type ApplyResult<S> = { ok: true; state: S } | { ok: false; error: string };

/**
 * The turn clock, kept by whoever runs the game (server Room or the offline hook), never by the rules.
 * Structurally identical to `TurnClock` in @okey/shared/clock.ts so the okey adapter passes it through.
 */
export interface TurnClock {
  /** The `TurnInfo.key` of the turn this clock belongs to. */
  turnNumber: number;
  /** Epoch ms when the player runs out of time. */
  deadline: number;
  /** The game's `refillsClock` already refilled this turn (at most one refill per turn). */
  refilled: boolean;
}

/** Whose move it is. `key` must change whenever a new turn starts (a fresh clock starts then). */
export interface TurnInfo {
  seat: number;
  key: number;
  /** First turn of the round: the host gives `firstTurnFactor` x the base time. */
  first: boolean;
}

/** Extra context the host passes to `viewFor` (the rules don't own time). */
export interface ViewContext {
  clock: TurnClock | null;
  now: number;
}

export interface ClockRules {
  /** Base time per turn in ms (okey: 30 000). 0 disables the clock. */
  baseMs: number;
  /** Multiplier for the first turn of a round (okey: 2, so 60 s). */
  firstTurnFactor: number;
}

/** Catalog entry: enough to draw the menus, including games that are only "Yakında". */
export interface GameMeta {
  id: GameId;
  group: TableGroup;
  status: 'active' | 'soon';
  /** Allowed player counts (pişti [2, 4], batak [4], tavla [2], okey [4]). */
  seatChoices: readonly number[];
  /** i18n key for the game's name, e.g. 'game.pisti'. */
  titleKey: string;
}

/**
 * A playable game.
 *  S    = full authoritative state (server/offline host only)
 *  A    = an action a seat sends
 *  V    = what one seat is allowed to see
 *  Opts = house rules ("kahveden kahveye değişen kurallar"), all with defaults
 *
 * Round = one hand/deal (okey el, pişti dağıtım turu, batak eli, tavla oyunu).
 * Match = rounds until `matchOver` (okey 101: never ends, players leave when they like; düz: someone out of points;
 *         pişti 151; tavla 3/5).
 */
export interface GameDefinition<S, A, V, Opts = unknown> extends GameMeta {
  status: 'active';
  defaultOptions: Opts;
  /** Turns untrusted options (from the network or storage) into a full, valid Opts. Unknown keys dropped. */
  normalizeOptions(raw: unknown): Opts;
  /** Player count for these options (must be one of `seatChoices`). */
  seats(opts: Opts): number;
  clock: ClockRules;

  /** Deals a new round. `round` is 0-based within the match (okey uses it for the starting seat). */
  create(opts: Opts, names: string[], rng: Rng, round: number): S;
  /** Cheap shape check for actions arriving from the network, before `apply`. */
  isAction(raw: unknown): raw is A;
  apply(state: S, seat: number, action: A): ApplyResult<S>;
  viewFor(state: S, seat: number, ctx?: ViewContext): V;

  /** Whose move it is, or null when nobody has to move (round over, waiting for next round). */
  turn(state: S): TurnInfo | null;
  /** True if this action refills the running turn clock once per turn (okey: open/meld/addToMeld). */
  refillsClock(action: A): boolean;

  /** A legal action for `seat` (only called when `turn(state)?.seat === seat`). Must never return an illegal move. */
  botMove(state: S, seat: number, level: BotLevel, rng: Rng): A;
  /** The minimal legal move when a human's clock runs out (okey: draw from deck, then throw). */
  quickMove(state: S, seat: number): A;

  roundOver(state: S): boolean;
  /** Points for this round per seat, added to the match totals. Only called when `roundOver`. */
  scoreRound(state: S): number[];
  /** `rounds` = rounds played so far. Totals may be reset by the host when a new match starts. */
  matchOver(totals: number[], rounds: number, opts: Opts): boolean;
}

/** Any game, for registries and hosts that don't care about the concrete types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any, any, any>;
