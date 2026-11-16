# B12 (Claude Sonnet): compact card-game layout for 6-inch landscape phones

Branch `feat/kahve-b12` (from `feat/kahve`). No new strings, no new dependencies, okey's GameScreen untouched.

## What changed
- `app/src/components/shellBudget.ts` (new, pure): `isCompactShell(windowHeight)` (< 500 dp) and `shellHeaderBudget()`.
  Compact header = top bar 60 dp (status line merged into it, replaces the game title) + one opponent row 36 dp = 96 dp
  (tablet: the old 144 dp estimate, scaled up to 1.2, unchanged).
- `GameShell`: on compact windows the status text sits in the top bar (22 pt, shrinks to no less than ~15 pt), the opponents
  get one fixed-height row, the separate status line is gone. Buttons stay 56 dp.
- `CardOpponentPanel` `compact`: one line, name + chips + key stats (tricks / pişti, bid, "Toplam"), 15-16 pt, 32 dp high.
  Not interactive, so no touch-target issue.
- `computeCardLayout`: returns `compact`, `centerBoxHeight`; when compact there is no action-bar row (`actionBarHeight` 0):
  Sort and Play (56 dp high, 120 dp wide) move into two columns beside the table centre (`CompactCenterRow`), together with
  the Batak trump/contract badges (left) and the score hint (right). Compact hand cards: Batak 46 dp (same as before),
  Pişti 60 dp. Trick cross width = the largest that fits (`fitTrickLayout`), Pişti pile up to 72 dp with its badge beside it
  (`PistiCenterPile badgeBeside`).
- `fitTrickLayout`: still prefers names under the cards, but takes the on-card name placement when it gives cards at least
  8 dp wider (`OVERLAY_GAIN`). On tablets both options fit at the desired width, so the result is unchanged.
- Tests: `app/test/compactLayout.test.ts` (header budget as a pure function; both phone sizes with and without notch insets:
  trick >= 44, Pişti pile >= 56, disjoint slots, cross inside the box, side columns >= 140 dp, 13-card hand fits width,
  rank text >= 15, header + centre + hand row <= window height; tablet numbers pinned) and a >= 44 assertion in the existing
  trick-cross size test.

## Numbers (dp). "insets" = notch landscape (L/R 44, bottom 21); "flat" = none
| Window | Case | Trick box (w x h) | Batak trick card before -> after | Pişti centre card before -> after | Batak hand card | Pişti hand card |
|---|---|---|---|---|---|---|
| 812x375 | flat | 780x77 -> 508x190 | 24 -> 66 | 60 -> 72 | 52 -> 46 | 55 -> 60 |
| 812x375 | insets | 692x65 -> 420x169 | 24 -> 58 | 52 -> 72 | 46 -> 46 | 48 -> 60 |
| 852x393 | flat | 820x90 -> 548x208 | 30 -> 72 | 64 -> 72 | 56 -> 46 | 60 -> 60 |
| 852x393 | insets | 732x74 -> 460x187 | 24 -> 64 | 59 -> 72 | 52 -> 46 | 54 -> 60 |
| 1280x800 | both | 1248x401 / 1160x380 (same) | 84 -> 84 | 96 -> 96 | 84 -> 84 | 101 -> 101 |

Header: 812x375 and 852x393 144 -> 96 dp (the 68 + 52 + 36 ~ 156 dp real before); the action-bar row (56 dp) is gone on phones.
13-card Batak hand on a phone: step 50, total width 646 dp, no horizontal scroll. Tablet 1280x800: all layout numbers identical.
Batak hand card on phones is 46 dp on the 852 screens, down from 52-56 there (traded for the trick cards; rank text stays 16 pt).

## Not verified
Only pure-function tests and typechecks ran; the rendering (opponent row text fitting, badge column, side buttons) was not
looked at on a device or emulator. Longest strings (Turkish contract badge, 3 opponents with all stats) rely on
`numberOfLines`/ellipsis in the narrow phone rows.

## Added after the B11 tablet test
- Opponent panel order: new pure `opponentOrder(mySeat, n)` (`cards/opponentOrder.ts`) = seats `s-1, s-2, ..` mod n, i.e. west,
  north, east as in the trick cross (4 players: `s+3, s+2, s+1`; 2 players: the other seat). Used by BatakScreen and
  PistiScreen (normal and compact modes). Test pins it to the TrickArea slot formula. Okey's GameScreen untouched.
- Hand dimming: `Hand` got `dimUnplayable` (default true). Batak passes `isPlayingTurn`, Pişti `isMyTurn`, so during bidding,
  trump selection and other players' turns the hand is full colour (still not tappable); only illegal cards on my own play turn are dimmed.
