# B6-SONNET raporu

Yapılan:
- `app/src/components/GameShell.tsx`: GameShell + `GameShellProps`; ayrıca `RoundSummary`, `RoundSummaryRow`, `summaryHeadline` buradan da yeniden dışa aktarılır (kaynak `components/roundSummary.ts`). Özet katmanı zIndex 500, `notice` yuvası onun üstünde (600, pointerEvents box-none).
- `SummaryTable.tsx`: RoundResult ve genel özetin ortak tablosu. RoundResult aynı stillerle onu kullanır (okey görünümü değişmedi; explain/standings/çarpan notu RoundResult'ta).
- Reklam: `policy.ts` içine `shouldShowAtBreak(leave, matchOver, humans)`; RoundResult aynı koşulu onunla çağırır. `adGate.onHandCompleted(_gameId?)` geriye uyumlu; App.tsx çağrısı aynen. GameShell özet göründüğünde eli bir kez sayar (`onHandCompleted(gameId)`) ve yalnız doğal arada `showIfEligible` çağırır. Sayaç anahtarları, 180 sn bekleme, 8/gün sınırı, açılışta reklam yok, isAdFree tüm oyunlar: değişmedi.
- OyunSecimi: `onPick?(gameId)`; `status:'active'` satır tıklanabilir. KahveSalonu: "Yakında" rozeti katalogdaki active oyundan türetilir (okey kartı aynı).
- i18n: soundOn, soundOff, timeLeftA11y, winnersA11y (tr + en, diğer 11 dilde İngilizce). Diğer başlık/düğme metinleri mevcut anahtarlardan (leave, nextHand, newMatch, leaveTable, youWon...).
- Test: app/test/policy.test.ts (10 test).

Okey GameScreen'e uyum değerlendirmesi: üst çubuk ve NoticePanel yuvası karşılanır; 919 satırlık dönen masa/el rafı yerleşimi nedeniyle taşıma önerilmez.
