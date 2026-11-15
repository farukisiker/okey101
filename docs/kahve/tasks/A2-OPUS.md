GÖREV: A2-OPUS  FAZ: A
AMAÇ: Okeyi `GameDefinition` arkasına saran adaptör ve tüm oyunların kaydı `@kahve/catalog`.
OKU: PROMPT_LOCAL.md §2, docs/kahve/MASTER_PLAN.md §2–3, packages/game-core/src/types.ts, shared/src/{game,bot,clock,protocol}.ts, server/src/room.ts
SÖZLEŞME: packages/game-core/src/types.ts @ 2d1c37b (değiştirme)
WORKTREE: C:/Users/mfaru/okey101/kahve-a2 (dal feat/kahve-a2)
SAHİP OLDUĞUN YOLLAR: packages/catalog/src/**, packages/catalog/test/**
DOKUNMA: shared/** (adaptör sarar, değiştirmez), server/**, app/**, package.json dosyaları, lockfile

İSTENEN:
- `packages/catalog/src/okey.ts`: tek fabrika `makeOkeyDef(mode)` → `okey101Def`, `okeyDuzDef`,
  tipi `GameDefinition<GameState, Action, PlayerView, OkeyOptions>`.
  - create → `createGame({mode, names, startingSeat: round % 4, rng, reshuffles})`
  - turn → `phase === 'playing' ? {seat: turn, key: turnNumber, first: turnNumber === 0} : null`
  - refillsClock → open / meld / addToMeld
  - viewFor → `viewFor(state, seat, ctx?.clock ?? null, ctx?.now)`
  - botMove → `botStep(viewFor(state, seat), {rng, level})`, easy → medium
  - quickMove → `quickMove(viewFor(state, seat))`
  - roundOver → `phase === 'finished'`; scoreRound → `result.scores`; matchOver → `matchOver(mode, totals)`
  - clock `{baseMs: TURN_MS, firstTurnFactor: 2}`; seats → 4; seatChoices `[4]`
  - `OkeyOptions = { reshuffles: number }` (varsayılan DEFAULT_RESHUFFLES), normalizeOptions bozuk girdiyi varsayılana çevirir
  - `isAction`: Action birleşiminin her üyesi için şekil kontrolü. Bozuk girdi → false, asla fırlatmaz.
- `packages/catalog/src/index.ts`: `CATALOG: readonly GameMeta[]` (8 oyun; okey101 ve okeyDuz active, diğerleri soon;
  pisti seatChoices [2,4], batak [4], tavla [2], king/konken/elli1 [4]), `getDefinition(id): AnyGameDefinition | null` (soon → null),
  `gamesInGroup(group)`, titleKey `'game.<id>'`.

KABUL:
- Eşdeğerlik: 200 seed, her biri için bir el bot-bot (a) doğrudan createGame/applyAction/botStep, (b) adaptör üzerinden;
  her adımda durum JSON'u eşit, el sonu skorları eşit. Hem 101 hem düz.
- JSON gidiş-dönüş: el ortasında `JSON.parse(JSON.stringify(state))` ile devam eden oyun aynı sonucu verir.
- isAction: geçerli tüm aksiyon örnekleri true; null, {}, eksik alan, string tileIds vb. false.
- Kökte `pnpm test` ve `pnpm typecheck` yeşil; test sayısı düşmez. (`corepack pnpm` notu: A1 kâğıdı.)
SÜREÇ: Önce kısa plan (≤15 satır) → Fable onayı → kod. Commit'ler feat/kahve-a2'de, push YOK. Rapor: docs/kahve/reports/A2-OPUS.md
