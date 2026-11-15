# FIX-DRAG: a dropped rack tile goes back and comes again

Branch `feat/kahve-fix-drag` (from `feat/kahve` @ 6a9ec94). Claude Opus, 15.11.2026.

## The report

User on an ALFA_8TX tablet (Android 12, armeabi-v7a, 1280x800, release APK, offline 101 vs bots):
"bıraktığımda gidip geri geliyor": when they drop a tile on the rack, it sometimes goes away and comes back.

## What the video shows

Rack crops of `drag.mp4` at 12 fps (instead of the 4 fps sheets) show the same pattern in all three
drags (6.9 s, 10.2 s, 11.5 s):

1. The tile is dragged; the yellow box is the **hover marker** for the target slot (not a selection border).
2. On release the tile **slides back toward its old slot** for 3-4 frames (~250-350 ms).
3. It then **jumps to the new slot for one frame**, jumps back to roughly where the slide had got to,
   and only then glides into the new slot.

The tile always ends in the slot the marker showed. So the arrangement is not lost or reset; what the
user sees is the tile heading home first and coming back later. The 4 fps sheets made step 2 look like
"sits in the new slot, then slides back".

## Root cause

The decision "does this drop move the tile?" is made on the JS thread, but the animation that runs in
the meantime always sends the tile home:

1. `DragSource.tsx` `onDeactivate` (UI thread) posts the drop to JS with `scheduleOnRN(onDrop, …)`.
2. Immediately after, `onFinalize` (UI thread, same gesture end) ran
   `tx.value = withSpring(0)` / `ty.value = withSpring(0)`. `tx/ty` are offsets from the tile's
   **current** slot, so this is a glide back to the **old** slot (old code: DragSource.tsx:316-324).
3. On JS: `Rack.tsx` `drop` → `slotAt` → `placeTile` → `onSlotsChange` → `GameScreen` `setSlots` →
   a re-render of the whole `Table` (≈900 lines, not memoised) → Fabric commit. Only then does the
   tile get its new `left/top`, and `DragSource`'s `useLayoutEffect` re-aims it
   (`tx += oldLeft - newLeft; tx = withSpring(0)`, old DragSource.tsx:275-293).
   On this tablet that round trip takes a few hundred ms, so step 2 has already carried the tile most
   of the way home: **it goes, then comes back**.
4. Extra one-frame jump: the new `left/top` reach the screen through React's commit, but the
   compensating `tx` write from the layout effect goes to the UI thread separately
   (`scheduleOnUI` inside Reanimated's shared-value setter). For a frame or two the tile is drawn at
   the new `left` with the old offset (a full slot-distance jump), then snaps back and glides.

Why "sometimes": it depends on how busy the JS thread is at the drop. Every `GameScreen` re-render
competes with the drop: the turn clock re-rendered the whole table **4 times a second**
(`useSecondsLeft`, `setInterval(() => setNow(Date.now()), 250)`), and a bot move or a clock second
landing in the same window makes the round trip longer. On a fast phone, or a slow adb swipe into an
empty slot, the round trip fits in a frame or two and nothing is visible.

Not the cause: the rack arrangement is never re-derived from props (`syncRack` keeps every known tile
where it is), `rackGeom` is the same for the marker and the drop, and the tap-tap mode isn't involved
(the yellow box is the hover marker). A7 didn't change the drag path; it only adds renders
(NoticePanel, frozen clock), which makes the JS round trip a bit longer.

## Fix

`app/src/components/DragSource.tsx`
- **Hold on drop.** Rack tiles get a `slot` prop. In `onDeactivate` the UI thread computes the target
  with the same `slotAt` the marker uses; if it is a rack slot other than the tile's own, the tile is
  marked `held` and `onFinalize` leaves it where it was dropped instead of springing home.
- **The rack answers.** `onDrop` now returns `true` when the tile moves. On `false` (own slot, full
  row, a zone drop, a pile) the JS side sends the held tile home; on `true` the re-render re-aims it
  from the drop point into the new slot. A 1 s safety net (tagged with a drop counter so it can't
  hit a later drop) sends a still-held tile home if no re-render ever came.
- **Position in one frame.** A positioned tile's `left/top` are no longer layout props: layout pins
  it at 0,0 and the slot position is a shared value (`baseX/baseY`) added to the transform. A slot
  change updates base and offset in one UI-thread worklet, so no frame can show the new slot with the
  old offset.
- Tap, `minDistance: 10`, lift, hover marker, `instantReturn` piles and the tap-tap move mode are
  unchanged.

`app/src/game/rackLayout.ts`: new pure `rackDrop(slots, id, to)`: the new arrangement, or null when
the tile ends up where it started. It replaces the `next === cur.slots` check in `Rack.tsx`, which
called a nudge that puts the tile straight back a move. With the hold, that would have left the tile
hanging.

`app/src/screens/GameScreen.tsx`: the turn clock still polls every 250 ms but only sets state when the
shown second changes, so the table re-renders 1x a second instead of 4x.

## Tests

- `app/test/rackDrop.test.ts` (vitest, 9 tests): empty slot, drop onto a tile (left gap / right gap),
  own slot, full row, the "nudge puts it straight back" case (asserts `placeTile` returns a fresh
  array with the tile in place, which the old check counted as a move), unknown tile, and `slotAt`
  for the UI-thread target.
- `app` has a `test` script (`vitest run`). No dependency or lockfile change.
- The bug itself is a race between UI-thread animation and JS-thread rendering. A Node test can't
  reproduce it: there is no UI thread or Fabric commit, and Reanimated's jest mock runs everything
  synchronously, which hides the race. It needs the manual check below.

Results: app `vitest run` 9/9. Root `pnpm test` 271 (41 + 104 + 61 + 65), root `pnpm typecheck` and
app `tsc --noEmit` clean. `expo export --platform android` bundles (worklets compile).
**Not yet run on a device.**

## Manual repro / check on the tablet

1. Release APK on the ALFA_8TX (or any slow Android device; or an emulator with the CPU throttled).
2. Offline 101 vs bots. Wait for your turn so the clock is running.
3. Drag a tile quickly (under ~0.3 s) a few slots along the rack and drop it **onto another tile**
   (between two tiles), several times. Also do it while a bot is moving.
4. Before the fix: on release the tile slides back toward its old slot, flickers, then glides into
   the new one. After the fix: it stays where you let go and glides straight into the new slot.
5. Also check: dropping on its own slot or a full row glides home; dropping on "Buraya at" or a meld
   glides home and is then played; drag from the deck/discard to a slot still draws into that slot;
   tap a tile then tap an empty slot (tap-tap) still moves it; tiles are tappable after a move.
6. Screen recording at 30+ fps (`adb shell screenrecord`) makes the before/after easy to compare.

## Live 1.0.1 (c19eea2)

**Affected, by the same root cause.** In 1.0.1 `DragSource.onFinalize` also springs home at once
(`withSpring(0, { duration: 160 })`) while the drop goes to JS. The re-render then *resets* the offset
in a plain `useEffect` (`tx = 0`), so on a slow device the tile slides fully home in 160 ms, waits
there, then **snaps** into the new slot (no glide). Same "gidip geri geliyor", arguably more visible.
1.0.1 also has the 4x/s clock re-render. This fix applies to the 1.0.1 drag code too (only DragSource,
Rack and rackLayout are involved), if a 1.0.2 hotfix is wanted.
