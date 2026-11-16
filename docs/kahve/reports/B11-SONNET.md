# B11 (Claude Sonnet): Batak tablet smoke-test fixes

Branch `feat/kahve-b11` (from `feat/kahve`).

## 1. Trick area cross
- New pure `app/src/components/cards/trickLayout.ts`: `trickLayout(cardWidth, tagMode)` returns the four slot rectangles
  (north top, south bottom, west left, east right, each = card + name tag) and `fitTrickLayout(boxW, boxH, desiredCard)`
  shrinks the cross to the room it has. Names go under the cards; on screens too short for that they sit on the card's
  bottom edge (`overlay`), and the card floor is then 24 dp.
- `computeCardLayout` moved to the pure `computeCardLayout.ts` (re-exported from `cardLayout.ts`, so vitest can load it)
  and now also returns `trickBoxWidth/Height` (room between the header and the action bar + hand).
- `TrickArea` takes `boxWidth/boxHeight`; the local seat is labelled `t('you')` ("Sen").
- Tests (`app/test/batakSummary.test.ts`): slots never intersect for card widths 24..84 in both tag modes, cross order
  holds, and for 1280x800, 852x393 and 812x375 the fitted cross is disjoint and fits the estimated box.
- Caveat: on the 812x375 phone the box is only ~77 dp tall, so trick cards shrink to about 24-26 dp wide there. Geometry is
  correct, but that is small for 60+ players; the real fix is a taller table area on phones (shell header is ~144 dp).
  Not verified on a device.

## 2. Bid and trump dialogs
- No backdrop, no centering over the table. Both are a compact strip (`pointerEvents="box-none"`) anchored just above the
  action bar + hand (`reserveBottom` = action bar + card height + 26 + bottom inset), so the hand stays bright and tappable.
- BidDialog: status line + one row with 4..13 and Pass, buttons >= 56 dp, text >= 15 pt, numbers at or below the high bid
  stay disabled. TrumpDialog: four suit buttons (symbol + name side by side) >= 60 dp tall, text >= 15 pt.

## 3. End-of-hand contract note
- `app/src/net/batakSummary.ts`: `batakNote`, `signedPoints` (real minus sign U+2212), `batakNoteFromView`; wired into
  `useKahveGame` (summary) and the BatakScreen preview fallback. `RoundSummary.note?` is rendered by GameShell under the
  headline at 20 pt. Result: "İhale: Sen 5, tuttu, +6" / "İhale: Filiz 6, tutmadı, −6".
- New keys `batakNoteMade`, `batakNoteFailed`: tr (Turkish) and en; English placeholders in the other 11 locales.
