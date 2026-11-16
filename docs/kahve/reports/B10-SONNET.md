# B10 (Claude Sonnet): fixes from the Pişti tablet smoke test

1. End-of-hand headline is game-aware. `RoundSummary.cardGame` (set by `cardSummary`) switches `summaryHeadlineText`
   (app/src/components/roundSummary.ts) to card wording: "El bitti, en yüksek: {name}", "Bu eli sen kazandın!",
   "Maç bitti, kazanan: {name}", "Tebrikler, maçı kazandın!", "El berabere". Partner games name the winning team row
   ("Cem & Kemal"). Okey summaries have no flag, so their wording is unchanged. Applies to Pişti and Batak.
2. Partners: team rows carry `seats`; GameShell keeps the full row name ("Sen & Ayşe") and marks the row as mine.
   The partner's opponent panel shows an "Eşin" chip (15 pt, green, `partnerTag`).
3. In-hand score labels now read "Toplam: N" (`cardsTotal`, `pistiYourScore`) on opponent panels and own stats
   (Pişti and Batak). No live scoring added.
4. "Pişti fırsatı!" only when the centre has exactly one card and the hand holds the same rank
   (`hasPistiChance`, app/src/components/cards/pistiChance.ts). A lone card you cannot pair shows no badge.
5. Ads: `app/src/ads/interstitial.ts` uses Google TestIds when `__DEV__` or `process.env.EXPO_PUBLIC_TEST_ADS === '1'`.
   It is the only ad unit usage in the app. Real ids untouched.

## Test ads flag (build time)
Expo inlines `EXPO_PUBLIC_*` at bundle time, so set it in the shell/EAS env of the build:
- local: `EXPO_PUBLIC_TEST_ADS=1 npx expo run:android --variant release`
- EAS: `"env": { "EXPO_PUBLIC_TEST_ADS": "1" }` in the test profile of eas.json (never in the store profile).
Store builds leave it unset.

New strings: tr + en real, English placeholders in the other 11 locales. Tests: app/test/headline.test.ts,
app/test/cardSummary.test.ts.
