# B9 (Sonnet): card sounds and 60+ corner symbol
- Files: app/assets/sounds/card-play.wav, card-take.wav (new); cardSfx.ts (registered both, mute via isSoundOn kept); CardView.tsx; PistiScreen.tsx (stale comment).
- WAV sizes: card-play.wav 4014 bytes (90 ms), card-take.wav 7542 bytes (170 ms); 16-bit mono 22050 Hz, peak 15000 (place.wav 18021, discard.wav 24575).
- CardView: cornerSymbolSize min 12 -> 15; symbol marginTop -3 -> -5 to keep the corner block on the 40 pt Batak card; rank size unchanged.
- cardPlayFeedback/cardTakeFeedback are called in both PistiScreen and BatakScreen (play on card laid, take on capture/trick).
- Checks: app typecheck, root test (server 77 passed), root typecheck all pass.
