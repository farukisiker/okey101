VERDICT: SEND BACK

1. **`app/src/components/cards/Hand.tsx:31-35`, `app/src/screens/BatakScreen.tsx:214-220`, `app/src/screens/PistiScreen.tsx:163-165`, `app/src/screens/PistiScreen.tsx:184-190` — Unplayable (`disabled`) cards can be played via the "Kartı Oyna" button and center pile tap:**
   In `Hand.tsx:31-35`, tapping a card that is not in `playableCardIds` (`!isPlayable`, e.g., an illegal suit/trump card in Batak) still calls `onSelectCard(cardId)` and lifts the disabled card as selected. `BatakScreen.tsx:216-217` and `PistiScreen.tsx:163-165, 186-187` only check `selectedCardId != null && isPlayingTurn` (without checking `view.legalCardIds.includes(selectedCardId)` / `view.playableCardIds.includes(selectedCardId)`), enabling the primary **"Kartı Oyna"** button to dispatch `onAction({ type: 'play', cardId })` for an illegal card. Both the two-tap path and the primary action button must enforce playability.

2. **`app/src/components/cards/cardLayout.ts:43-71`, `app/src/screens/BatakScreen.tsx:169-237`, `app/src/screens/PistiScreen.tsx:151-208` — Severe vertical overflow (~110–130 dp) on 6-inch landscape phones (`812×375` / `852×393`) and missing local player stats:**
   `computeCardLayout` (`cardLayout.ts:43`) calculates `usableHeight` but never uses it. Inside `GameShell` (which already consumes `~156 dp` for top bar `68 dp` + opponents `52 dp` + status line `36 dp`), only `~219 dp` of height remains on a `375 dp` phone, whereas `BatakScreen` stacks `topInfoRow` (`37 dp`) + `TrickArea` (`142 dp` at `height * 1.85`) + `actionBar` (`56 dp`) + `Hand` (`114 dp`) = `349 dp`. Clamp `trickCardWidth`, `centerPileCardWidth`, and `Hand` vertical padding against available vertical space on compact screens. Additionally, `GameShell` already renders `status={statusText}` (`GameShell.tsx:102`), so repeating the status prompt in `actionBar` (`PistiScreen.tsx:178-181`, `BatakScreen.tsx:204-212`) is redundant—meanwhile, because `opponents` filters out `p.seat !== seat`, the local player's own stats (Pişti `capturedCount`, `pistiCount`, `totalScore` / `pistiYourScore`; Batak `tricksWon` `Aldığı: W / B`, `bid`, `totalScore`) are never shown anywhere on screen during play.

3. **`app/src/screens/PistiScreen.tsx:271`, `app/src/screens/BatakScreen.tsx:326`, `app/src/components/cards/TrickArea.tsx:131`, `app/src/components/cards/CardOpponentPanel.tsx:69, 101, 152`, `app/src/components/cards/CardView.tsx:93, 127` — 60+ ergonomics violations (`text >= 15pt` and `touch >= 56dp`):**
   - **Touch target < 56 dp:** `styles.actionBtn` in `PistiScreen.tsx:271` and `BatakScreen.tsx:326` sets `minHeight: 52`, overriding `Button.tsx`'s default `minHeight: 56` down to `52 dp`.
   - **Font size < 15 pt:**
     - `TrickArea.tsx:131`: `nameText` sets `fontSize: font.small - 3` (`12 pt`).
     - `CardOpponentPanel.tsx:152`: `declarerChipText` sets `fontSize: 12` (`12 pt`), and `CardOpponentPanel.tsx:101` sets `adjustsFontSizeToFit minimumFontScale={0.75}` on `font.small` (`15 pt`), shrinking opponent metadata to `11.25 pt`—worsened by `CardOpponentPanel.tsx:69` calling `t('batakContract', { name, n: bid })`, which repeats the opponent's name inside their own panel.
     - `CardView.tsx:93` & `127`: `badgeText` uses `Math.max(10, Math.round(width * 0.16))` (`10–11 pt` on phone cards) and `CardBack` `countText` uses `Math.max(14, ...)` (plan §4.4 specifies `≥ 16 pt`, `TASARIM.md` §4 requires `≥ 15 pt` everywhere).

4. **`app/src/components/cards/CardView.tsx:37`, `app/src/components/cards/TrickArea.tsx:35`, `app/src/screens/cards-preview/CardsPreviewScreen.tsx:43-52, 158` — Hardcoded Turkish strings not routed through `t()`:**
   - `CardView.tsx:37`: `accessibilityLabel` hardcodes `' (seçili)'`.
   - `TrickArea.tsx:35`: fallback seat label hardcodes `` `Koltuk ${seat + 1}` ``.
   - `CardsPreviewScreen.tsx:43-52, 158`: scenario tab labels and gallery heading are raw Turkish strings instead of `t()` keys.

5. **`app/src/screens/PistiScreen.tsx:112-124`, `app/src/screens/BatakScreen.tsx:128-140` — Missing `onNewMatch` and `humanCount` props on `GameShell`:**
   `GameShell.tsx:69-70` calls `p.onNewMatch?.()` when `summary.matchOver` is `true` and `p.onNextHand?.()` otherwise. Both screens pass `onNextHand={onNextRound}` but omit `onNewMatch={onNextRound}` (and `humanCount`), causing the primary button on the match-over summary overlay to do nothing.

6. **`app/src/components/cards/Hand.tsx:13-26` — Optional drag-and-drop (`dropZoneKey`) prop is unused:**
   `HandProps` declares `dropZoneKey?: string` (`fakeTypes.ts:126`), but `Hand.tsx` ignores it and only implements two-tap selection/play. Either wire optional drag onto the same `onPlayCard` callback or remove the dead prop if only two-tap + `PistiCenterPile` tap + `cardsPlay` button are used.
