/**
 * B8: bot-vs-bot simulation over every active game in the catalog.
 *
 * Independent verification of the frozen @kahve/core contract. For each `status: 'active'` game,
 * each seat count it offers, N seeds and mixed bot levels, it checks on every step that
 * `def.isAction(action)` accepts the bot's move (raw and after a JSON round-trip) and that
 * `def.apply(...)` accepts it (an invalid move is counted, never thrown), that the round finishes
 * inside the step cap, that `apply` does not mutate its input, and that the state plus every seat's
 * view survive a JSON round-trip. Nothing is written to disk, no package.json is needed: run it
 * with `corepack pnpm exec tsx tools/sim/run.ts`.
 *
 * Usage:
 *   corepack pnpm exec tsx tools/sim/run.ts [--seeds 1000] [--seedStart 1] [--shard 1/2]
 *     [--games okey101,okeyDuz] [--levels easy,medium,hard] [--rounds 1] [--stepCap 2000]
 *     [--sampleImmutable 100] [--quiet] [--json] [--help]
 *
 * Exit code 0 when no invalid move, unfinished round or JSON/contract error was seen, 1 otherwise.
 */
import { CATALOG, getDefinition } from '@kahve/catalog';
import { seededRng, type AnyGameDefinition, type BotLevel, type GameId, type TurnClock } from '@kahve/core';

// -------------------------------------------------------------------------------------------------
// CLI
// -------------------------------------------------------------------------------------------------

interface SimOptions {
  seeds: number;
  seedStart: number;
  shardIndex: number;
  shardCount: number;
  games: GameId[] | null;
  levels: BotLevel[];
  rounds: number;
  stepCap: number;
  sampleImmutable: number;
  quiet: boolean;
  json: boolean;
}

const BOT_LEVELS: readonly BotLevel[] = ['easy', 'medium', 'hard'];

const DEFAULTS: SimOptions = {
  seeds: 1000,
  seedStart: 1,
  shardIndex: 1,
  shardCount: 1,
  games: null,
  levels: [...BOT_LEVELS],
  rounds: 1,
  stepCap: 2000,
  sampleImmutable: 100,
  quiet: false,
  json: false,
};

const USAGE = [
  'B8 sim - bot vs bot over every active game in the catalog',
  '',
  '  --seeds <n>             seeds per game (default 1000)',
  '  --seedStart <n>         first seed (default 1)',
  '  --shard <i>/<n>         play every n-th seed starting at i (1-based, default 1/1)',
  '  --games <id,id>         games to play (default: every status:active game in the catalog)',
  '  --levels <easy,medium,hard>  mixed bot levels (default all three)',
  '  --rounds <n>            rounds per seed (default 1; >1 also walks matchOver)',
  '  --stepCap <n>           max steps per round before it counts as unfinished (default 2000)',
  '  --sampleImmutable <n>   check apply() does not mutate its input every n steps (0 = off, default 100)',
  '  --quiet                 only the header and the summary',
  '  --json                  print a single JSON object instead of the text report',
  '  --help                  this text',
].join('\n');

function intArg(name: string, raw: string, min: number): number {
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min) throw new Error(`--${name} expects an integer >= ${min}, got "${raw}"`);
  return n;
}

function parseArgs(argv: string[]): SimOptions | 'help' {
  const opts: SimOptions = { ...DEFAULTS, levels: [...DEFAULTS.levels] };
  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i] ?? '';
    if (!raw.startsWith('--')) throw new Error(`unexpected argument "${raw}"`);
    const eq = raw.indexOf('=');
    const name = eq === -1 ? raw.slice(2) : raw.slice(2, eq);
    const inline = eq === -1 ? undefined : raw.slice(eq + 1);
    const value = (): string => {
      if (inline !== undefined) return inline;
      const next = argv[++i];
      if (next === undefined) throw new Error(`--${name} needs a value`);
      return next;
    };
    switch (name) {
      case 'help':
        return 'help';
      case 'seeds':
        opts.seeds = intArg(name, value(), 1);
        break;
      case 'seedStart':
        opts.seedStart = intArg(name, value(), 0);
        break;
      case 'shard': {
        const [a, b] = value().split('/');
        const index = intArg('shard i', a ?? '', 1);
        const count = intArg('shard n', b ?? '', 1);
        if (index > count) throw new Error(`--shard ${a}/${b}: i must be <= n`);
        opts.shardIndex = index;
        opts.shardCount = count;
        break;
      }
      case 'games': {
        const ids = value()
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (ids.length === 0) throw new Error('--games needs at least one id');
        opts.games = ids as GameId[];
        break;
      }
      case 'levels': {
        const levels = value()
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const l of levels) if (!BOT_LEVELS.includes(l as BotLevel)) throw new Error(`--levels: unknown level "${l}"`);
        if (levels.length === 0) throw new Error('--levels needs at least one level');
        opts.levels = levels as BotLevel[];
        break;
      }
      case 'rounds':
        opts.rounds = intArg(name, value(), 1);
        break;
      case 'stepCap':
        opts.stepCap = intArg(name, value(), 1);
        break;
      case 'sampleImmutable':
        opts.sampleImmutable = intArg(name, value(), 0);
        break;
      case 'quiet':
        opts.quiet = true;
        break;
      case 'json':
        opts.json = true;
        break;
      default:
        throw new Error(`unknown flag --${name} (see --help)`);
    }
  }
  return opts;
}

// -------------------------------------------------------------------------------------------------
// Contract helpers
// -------------------------------------------------------------------------------------------------

const BOT_SALT = 0x9e3779b9;

type LevelMix = Record<BotLevel, number>;

interface RoundOutcome {
  steps: number;
  ms: number;
  invalid: number;
  unfinished: number;
  jsonErrors: number;
  refills: number;
  mix: LevelMix;
  scores: number[] | null;
  botCalls: number;
  botMsSum: number;
  botMsMax: number;
  botMsHardMax: number;
  /** Game-specific: finished turns (tavla: turnNumber at the end). */
  turns: number;
}

interface GameTotals {
  game: GameId;
  seeds: number;
  rounds: number;
  steps: number;
  ms: number;
  invalid: number;
  unfinished: number;
  jsonErrors: number;
  mix: LevelMix;
  seatVariants: number[];
  refills: number;
  botCalls: number;
  botMsSum: number;
  botMsMax: number;
  botMsHardMax: number;
  turns: number;
}

interface RunConfig {
  levels: readonly BotLevel[];
  rounds: number;
  stepCap: number;
  sampleImmutable: number;
  botRng: () => number;
  notes: string[];
}

const emptyMix = (): LevelMix => ({ easy: 0, medium: 0, hard: 0 });

const addMix = (into: LevelMix, from: LevelMix): void => {
  into.easy += from.easy;
  into.medium += from.medium;
  into.hard += from.hard;
};

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

/**
 * Why a value is not plain JSON, or null when it is. Stricter than a stringify round-trip:
 * a Map/Set/Date/class instance or an `undefined` hole all stringify to something losable,
 * so the whole tree is walked instead.
 */
function jsonProblem(value: unknown, path: string, seen: Set<object> = new Set()): string | null {
  if (value === null) return null;
  const type = typeof value;
  if (type === 'string' || type === 'boolean') return null;
  if (type === 'number') return Number.isFinite(value as number) ? null : `${path} is a non-finite number`;
  if (type === 'undefined') return `${path} is undefined (JSON.stringify drops it)`;
  if (type === 'bigint' || type === 'function' || type === 'symbol') return `${path} is a ${type}`;
  const obj = value as object;
  if (seen.has(obj)) return null; // a cycle would make JSON.stringify throw; every view is a tree
  seen.add(obj);
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const problem = jsonProblem(obj[i], `${path}[${i}]`, seen);
      if (problem) return problem;
    }
    return null;
  }
  const proto: object | null = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) return `${path} is not a plain object (${proto?.constructor?.name ?? 'null'})`;
  for (const [key, nested] of Object.entries(obj)) {
    const problem = jsonProblem(nested, `${path}.${key}`, seen);
    if (problem) return problem;
  }
  return null;
}

/** The slice of the tavla state the invariant reads (@kahve/tavla is not a sim dependency; the catalog does not export TavlaState). */
interface TavlaState {
  board: { points: number[]; bar: [number, number]; off: [number, number] };
  turnNumber: number;
}

/** Tavla invariant: for each seat, checkers on points + bar + off = 15 (null when it holds). */
function tavlaCheckerProblem(s: TavlaState): string | null {
  for (const seat of [0, 1]) {
    let onPoints = 0;
    for (let p = 1; p <= 24; p++) {
      const n = s.board.points[p] ?? 0;
      if (seat === 0 ? n > 0 : n < 0) onPoints += Math.abs(n);
    }
    const total = onPoints + s.board.bar[seat] + s.board.off[seat];
    if (total !== 15) return `seat ${seat} has ${total} checkers (points ${onPoints} + bar ${s.board.bar[seat]} + off ${s.board.off[seat]})`;
  }
  return null;
}

// -------------------------------------------------------------------------------------------------
// One round of one seed
// -------------------------------------------------------------------------------------------------

function playRound(def: AnyGameDefinition, opts: unknown, names: string[], seed: number, round: number, cfg: RunConfig): RoundOutcome {
  const started = Date.now();
  const out: RoundOutcome = { steps: 0, ms: 0, invalid: 0, unfinished: 0, jsonErrors: 0, refills: 0, mix: emptyMix(), scores: null, botCalls: 0, botMsSum: 0, botMsMax: 0, botMsHardMax: 0, turns: 0 };
  const note = (message: string) => cfg.notes.push(message);
  const where = (step: number) => `${def.id} seed=${seed} round=${round} step=${step}`;

  let state = def.create(opts, names, seededRng(seed + round * 1000), round);
  const stateProblem = jsonProblem(state, 'state');
  if (stateProblem) {
    out.jsonErrors++;
    note(`${where(0)}: create() state is not JSON: ${stateProblem}`);
  }

  let step = 0;
  let noticeId = 0;
  let nowMs = 1_000_000 + seed * 1000;

  while (!def.roundOver(state)) {
    const turn = def.turn(state);
    if (turn === null) {
      out.unfinished++;
      note(`${where(step)}: roundOver() is false but turn() is null`);
      break;
    }
    if (step >= cfg.stepCap) {
      out.unfinished++;
      note(`${where(step)}: no finish within ${cfg.stepCap} steps`);
      break;
    }

    const level = cfg.levels[(seed + round * 7 + step) % cfg.levels.length];
    out.mix[level]++;

    // Host clock: a fresh clock whenever the turn key changes, plus the refill a laying action triggers.
    nowMs += 137 + (step % 7) * 1000;
    let clock: TurnClock | null = {
      turnNumber: turn.key,
      deadline: nowMs + def.clock.baseMs * (turn.first ? def.clock.firstTurnFactor : 1),
      refilled: false,
    };
    const ctx = () => ({ clock, now: nowMs });

    const botStarted = performance.now();
    const action = def.botMove(state, turn.seat, level, cfg.botRng);
    const botMs = performance.now() - botStarted;
    out.botCalls++;
    out.botMsSum += botMs;
    out.botMsMax = Math.max(out.botMsMax, botMs);
    if (level === 'hard') out.botMsHardMax = Math.max(out.botMsHardMax, botMs);
    if (!def.isAction(action)) {
      out.jsonErrors++;
      note(`${where(step)}: isAction(botMove()) is false`);
    } else if (!def.isAction(JSON.parse(JSON.stringify(action)))) {
      out.jsonErrors++;
      note(`${where(step)}: isAction() fails on the action after a JSON round-trip`);
    }

    // quickMove is the clock-out move; it must be legal too. Its result is thrown away on purpose.
    if (step === 0) {
      const quick = def.quickMove(state, turn.seat);
      if (!def.isAction(quick)) {
        out.jsonErrors++;
        note(`${where(step)}: isAction(quickMove()) is false`);
      } else {
        const quickResult = def.apply(state, turn.seat, quick);
        if (!quickResult.ok) {
          out.invalid++;
          note(`${where(step)}: quickMove() rejected by apply(): ${quickResult.error}`);
        }
      }
    }

    const frozen = cfg.sampleImmutable > 0 && step % cfg.sampleImmutable === 0 ? JSON.stringify(state) : null;
    const applied = def.apply(state, turn.seat, action);
    if (frozen !== null && JSON.stringify(state) !== frozen) {
      out.jsonErrors++;
      note(`${where(step)}: apply() mutated its input state`);
    }
    if (!applied.ok) {
      out.invalid++;
      note(`${where(step)}: botMove() rejected by apply(): ${applied.error}`);
      break;
    }
    state = applied.state;
    step++;

    if (def.id === 'tavla') {
      const problem = tavlaCheckerProblem(state as TavlaState);
      if (problem) {
        out.jsonErrors++;
        note(`${where(step)}: tavla invariant: ${problem}`);
      }
    }

    if (def.refillsClock(action) && clock !== null && !clock.refilled) {
      clock = { turnNumber: clock.turnNumber, deadline: nowMs + def.clock.baseMs, refilled: true };
      out.refills++;
    }

    if (def.noticeOf) {
      const notice = def.noticeOf(state);
      if (notice !== null && notice.id < noticeId) {
        out.jsonErrors++;
        note(`${where(step)}: notice id went backwards (${notice.id} after ${noticeId})`);
      }
      noticeId = Math.max(noticeId, notice?.id ?? 0);
    }

    const views: unknown[] = [];
    for (let seat = 0; seat < names.length; seat++) views.push(def.viewFor(state, seat, ctx()));
    const viewProblem = jsonProblem(views, 'views');
    if (viewProblem) {
      out.jsonErrors++;
      note(`${where(step)}: viewFor() is not JSON: ${viewProblem}`);
    } else if (!sameJson(views, JSON.parse(JSON.stringify(views)))) {
      out.jsonErrors++;
      note(`${where(step)}: a view does not survive a JSON round-trip`);
    }
  }

  if (def.roundOver(state)) {
    if (def.turn(state) !== null) {
      out.jsonErrors++;
      note(`${where(step)}: roundOver() is true but turn() is not null`);
    }
    const scores = def.scoreRound(state);
    if (
      !Array.isArray(scores) ||
      scores.length !== names.length ||
      !scores.every((n) => Number.isInteger(n) && Number.isFinite(n))
    ) {
      out.jsonErrors++;
      note(`${where(step)}: scoreRound() is not ${names.length} integers (${JSON.stringify(scores)})`);
    } else {
      out.scores = scores as number[];
    }
    if (!sameJson(state, JSON.parse(JSON.stringify(state)))) {
      out.jsonErrors++;
      note(`${where(step)}: the finished state does not survive a JSON round-trip`);
    }
  }

  if (def.id === 'tavla') out.turns = (state as TavlaState).turnNumber;
  out.steps = step;
  out.ms = Date.now() - started;
  return out;
}

// -------------------------------------------------------------------------------------------------
// Whole-catalog driver
// -------------------------------------------------------------------------------------------------

function seedsFor(opts: SimOptions): number[] {
  const seeds: number[] = [];
  for (let i = 0; i < opts.seeds; i++) {
    if (i % opts.shardCount !== opts.shardIndex - 1) continue;
    seeds.push(opts.seedStart + i);
  }
  return seeds;
}

const pad = (value: string | number, width: number): string => String(value).padEnd(width);

function runGame(def: AnyGameDefinition, seeds: number[], opts: SimOptions, notes: string[], emit: (line: string) => void): GameTotals {
  const totals: GameTotals = {
    game: def.id,
    seeds: 0,
    rounds: 0,
    steps: 0,
    ms: 0,
    invalid: 0,
    unfinished: 0,
    jsonErrors: 0,
    mix: emptyMix(),
    seatVariants: [],
    refills: 0,
    botCalls: 0,
    botMsSum: 0,
    botMsMax: 0,
    botMsHardMax: 0,
    turns: 0,
  };
  const progressEvery = Math.max(1, Math.round(seeds.length / 10));
  const verbose = !opts.quiet && !opts.json;
  const started = Date.now();

  for (const seatChoice of def.seatChoices) {
    // Every seat count the game offers gets its own options object (R6). Games that take the count
    // under another key return their own seat count unchanged, which is reported below.
    const gameOptions = def.normalizeOptions({ ...(def.defaultOptions as Record<string, unknown>), seats: seatChoice });
    totals.seatVariants.push(seatChoice);
    if (!sameJson(def.normalizeOptions(JSON.parse(JSON.stringify(gameOptions))), gameOptions)) {
      totals.jsonErrors++;
      notes.push(`${def.id}: normalizeOptions() is not idempotent over a JSON round-trip`);
    }
    const seats = def.seats(gameOptions);
    if (seats !== seatChoice) notes.push(`${def.id}: seatChoices offers ${seatChoice} but seats(normalized options) is ${seats}`);
    const names = Array.from({ length: seats }, (_, i) => `Bot${i + 1}`);

    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i] ?? 0;
      const cfg: RunConfig = {
        levels: opts.levels,
        rounds: opts.rounds,
        stepCap: opts.stepCap,
        sampleImmutable: opts.sampleImmutable,
        botRng: seededRng(seed ^ BOT_SALT),
        notes,
      };
      let steps = 0;
      let ms = 0;
      let invalid = 0;
      let unfinished = 0;
      let jsonErrors = 0;
      let refills = 0;
      const mix = emptyMix();
      const matchTotals = new Array<number>(seats).fill(0);

      for (let round = 0; round < opts.rounds; round++) {
        const result = playRound(def, gameOptions, names, seed, round, cfg);
        steps += result.steps;
        ms += result.ms;
        invalid += result.invalid;
        unfinished += result.unfinished;
        jsonErrors += result.jsonErrors;
        refills += result.refills;
        totals.botCalls += result.botCalls;
        totals.botMsSum += result.botMsSum;
        totals.botMsMax = Math.max(totals.botMsMax, result.botMsMax);
        totals.botMsHardMax = Math.max(totals.botMsHardMax, result.botMsHardMax);
        totals.turns += result.turns;
        addMix(mix, result.mix);
        totals.rounds++;
        if (result.scores) for (let k = 0; k < seats; k++) matchTotals[k] += result.scores[k] ?? 0;
        if (opts.rounds > 1) {
          const over = def.matchOver(matchTotals, round + 1, gameOptions);
          if (over && round + 1 < opts.rounds) notes.push(`${def.id} seed=${seed}: matchOver() after ${round + 1} rounds (totals ${JSON.stringify(matchTotals)})`);
        }
      }

      totals.seeds++;
      totals.steps += steps;
      totals.ms += ms;
      totals.invalid += invalid;
      totals.unfinished += unfinished;
      totals.jsonErrors += jsonErrors;
      totals.refills += refills;
      addMix(totals.mix, mix);

      if (verbose) {
        emit(
          `seed=${seed} game=${def.id} seats=${seats} rounds=${opts.rounds} steps=${steps} ms=${ms} ` +
            `levelMix=e${mix.easy}/m${mix.medium}/h${mix.hard} gecersiz=${invalid} bitmeyen=${unfinished} ` +
            `jsonHata=${jsonErrors} sonuc=${invalid + unfinished + jsonErrors === 0 ? 'ok' : 'hata'}`,
        );
      }
      if (verbose && (i + 1) % progressEvery === 0) {
        emit(`... ${i + 1}/${seeds.length} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
      }
    }
  }

  totals.ms = Date.now() - started;
  return totals;
}
// -------------------------------------------------------------------------------------------------
// Report and entry point
// -------------------------------------------------------------------------------------------------

interface SimTotals {
  games: number;
  seeds: number;
  rounds: number;
  steps: number;
  ms: number;
  invalid: number;
  unfinished: number;
  jsonErrors: number;
  refills: number;
  mix: LevelMix;
}

function main(argv: string[]): number {
  let opts: SimOptions | 'help';
  try {
    opts = parseArgs(argv);
  } catch (error) {
    console.error(`HATA: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }
  if (opts === 'help') {
    console.log(USAGE);
    return 0;
  }

  const gameIds: GameId[] = opts.games ?? CATALOG.filter((meta) => meta.status === 'active').map((meta) => meta.id);
  const seeds = seedsFor(opts);
  const notes: string[] = [];
  const skipped: string[] = [];
  const emit = (line: string) => {
    if (opts.json) skipped.push(line);
    else console.log(line);
  };

  const header = [
    `B8 sim | oyun=${gameIds.length} (${gameIds.join(',')})`,
    `seed/oyun=${seeds.length}/${opts.seeds}`,
    `seedStart=${opts.seedStart}`,
    `rounds/seed=${opts.rounds}`,
    `stepCap=${opts.stepCap}`,
    `seviyeler=${opts.levels.join(',')}`,
    `sampleImmutable=${opts.sampleImmutable}`,
    opts.shardCount > 1 ? `shard=${opts.shardIndex}/${opts.shardCount}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(' ');
  emit(header);

  const games: GameTotals[] = [];
  for (const id of gameIds) {
    const def = getDefinition(id);
    if (def === null) {
      console.error(`HATA: ${id} has no definition in the catalog (not playable yet)`);
      return 2;
    }
    games.push(runGame(def, seeds, opts, notes, emit));
  }




  const totals: SimTotals = {
    games: games.length,
    seeds: games.reduce((n, game) => n + game.seeds, 0),
    rounds: games.reduce((n, game) => n + game.rounds, 0),
    steps: games.reduce((n, game) => n + game.steps, 0),
    ms: games.reduce((n, game) => n + game.ms, 0),
    invalid: games.reduce((n, game) => n + game.invalid, 0),
    unfinished: games.reduce((n, game) => n + game.unfinished, 0),
    jsonErrors: games.reduce((n, game) => n + game.jsonErrors, 0),
    refills: games.reduce((n, game) => n + game.refills, 0),
    mix: emptyMix(),
  };
  for (const game of games) addMix(totals.mix, game.mix);
  const failed = totals.invalid + totals.unfinished + totals.jsonErrors > 0;

  if (opts.json) {
    console.log(JSON.stringify({ ok: !failed, options: opts, games, totals, notes }, null, 2));
    return failed ? 1 : 0;
  }

  console.log('OZET');
  console.log(
    `${pad('oyun', 10)}${pad('seed', 7)}${pad('el', 7)}${pad('adim', 9)}${pad('ms', 9)}${pad('gecersiz', 10)}${pad('bitmeyen', 10)}${pad('jsonHata', 10)}seviye(e/m/h)`,
  );
  for (const game of games) {
    console.log(
      `${pad(game.game, 10)}${pad(game.seeds, 7)}${pad(game.rounds, 7)}${pad(game.steps, 9)}${pad(game.ms, 9)}${pad(game.invalid, 10)}${pad(game.unfinished, 10)}${pad(game.jsonErrors, 10)}${game.mix.easy}/${game.mix.medium}/${game.mix.hard}`,
    );
    console.log(`  ${game.game}: koltuk=${game.seatVariants.join('/')} saatTazeleme=${game.refills}`);
    console.log(
      `  ${game.game}: botMove ${game.botCalls} cagri, ort=${(game.botMsSum / Math.max(1, game.botCalls)).toFixed(3)} ms, ` +
        `max=${game.botMsMax.toFixed(2)} ms, hard max=${game.botMsHardMax.toFixed(2)} ms` +
        (game.game === 'tavla' ? `, ortalama tur/oyun=${(game.turns / Math.max(1, game.rounds)).toFixed(1)} (30 pul korunumu her adimda)` : ''),
    );
  }
  console.log(
    `TOPLAM: ${totals.games} oyun, ${totals.seeds} seed, ${totals.rounds} el, ${totals.steps} adim, ` +
      `${totals.invalid} gecersiz hamle, ${totals.unfinished} bitmeyen el, ${totals.jsonErrors} json/sozlesme hatasi, ${totals.ms} ms`,
  );
  console.log(
    `TOPLAM seviye(e/m/h)=${totals.mix.easy}/${totals.mix.medium}/${totals.mix.hard} saatTazeleme=${totals.refills}`,
  );
  if (notes.length > 0) {
    console.log(`UYARI (${notes.length}):`);
    for (const note of notes.slice(0, 20)) console.log(`  - ${note}`);
    if (notes.length > 20) console.log(`  ... +${notes.length - 20} more`);
  }
  return failed ? 1 : 0;
}

process.exitCode = main(process.argv.slice(2));
