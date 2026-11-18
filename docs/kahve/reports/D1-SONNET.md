# D1 report: UI translations (Sonnet)

Scope: `app/src/i18n/locales/{de,es,fr,hi,id,it,ja,ko,pt,ru,zh}.ts`. No key names, `tr.ts` or `en.ts` touched. UTF-8, CRLF line endings kept. Nothing committed.

## Result
- Keys translated per language: 140 each (119 plain keys such as salon, Pişti, Batak, Tavla, GameShell, lobby, plus 21 dotted/quoted keys: `game.okey101`, `game.okeyDuz`, `game.tavla`, `notice.*`, `sideTake*`, `matchLen*`, `matchOver`, `standings`, `newMatch`, `soundOn/Off`, `timeLeftA11y`, `winnersA11y`), 11 languages = 1540 values.
- Method: a script applied a per-language list to the files; it checks that the `{placeholder}` set of every value equals the English one (no mismatch found) and that only values still equal to `en.ts` are replaced.
- `corepack pnpm --filter ./app typecheck`: pass. `corepack pnpm --filter ./app test`: 9 files, 126 tests, pass.
- Special letters verified (ğ/ş/İ in `PİŞTİ!`, accents, Cyrillic, Devanagari, CJK all intact; no stray `?`).

## Deliberately left the same as English (all languages)
- `game.pisti` (Pişti), `game.batak` (Batak), `game.king`, `game.konken`, `game.elli1` (Elli Bir): proper game names, Latin script kept in every language for consistency with the existing files. Pişti/Batak also stay Latin inside translated phrases (also in hi/ja/ko/ru/zh).
- `tavlaKindKoncina`: "Konçina" in all languages (Turkish special term, per the task sheet).
- Okey names `game101`, `mode101`, `modeBtn101`, `okeyLabel`: left as the English-shaped value in de/es/fr/id/it/pt/zh (Okey is the proper name there); hi/ja/ko/ru already had transliterations.
- `zoom` (de, id, it: "Zoom"), `bot` (es, fr, id, it, pt: "bot"), `no` (es, it: "No"), `total` (es, fr, id, pt: "Total"): same word in the language.

## Values identical to English after translation (a real word in that language)
- de: `groupTavlaSub`/`game.tavla`/`game.okey101` (Backgammon, 101 Okey), `tavlaBar` (Bar), `tavlaKindMars` (Gammon).
- es: same plus `cardsPoints` ("{n} pts"), `pistiYourScore`/`cardsTotal` (Total), `tavlaPips` (Pips).
- fr: `playSolo` (Solo), `pistiPointsEarned`, `tavlaScore`, `tavlaScoreFinal`, `tavlaResultNote`, `tavlaMatchPoints`, `matchLenPoints` ("{n} points"), `tavlaPips`, `cardsPoints`.
- id: `pistiYourScore`/`cardsTotal` (Total), `tavlaBar` (Bar).
- it, pt: `tavlaKindMars` (Gammon), pt also `cardsPoints`, `pistiYourScore`, `cardsTotal`, `tavlaPips`.
- Gammon ("Mars") kept as "Gammon" in the Latin-script languages; "Tek" became "Single/Simple" equivalents (Einfach, Simple, Semplice, Simples, Tunggal, 单局, シングル, 싱글, Обычная, सिंगल).

## Terminology choices
- Tavla: Backgammon (de/es/fr/it/id), Gamão (pt), Нарды (ru), バックギャモン (ja), 백개먼 (ko), 双陆棋 (zh), बैकगैमन (hi). Coffeehouse ("Kahve"): Kaffeehaus, café, café, caffè, Café, kedai kopi, кофейня, 喫茶店, 커피하우스, 茶馆, कॉफ़ीहाउस.
- Penalty: Strafe, penalización, pénalité, penalità, penalidade, penalti, штраф, 罰点, 벌점, 罚分, दंड (matches the older strings in each file).
- Short button labels kept short (e.g. Done = Fertig/Listo/Terminé/Fatto/Pronto/Selesai/Готово/完了/완료/完成/हो गया).

## Review hints
- Native-speaker review is still advisable for ja/ko/zh/hi/ru card terms (trump, trick, bid) and Batak wording.
- Remaining 'same as en' list after the run is only the table above.
