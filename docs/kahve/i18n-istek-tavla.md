# Tavla i18n anahtarlari (C2)

Su an `app/src/components/tavla/text.ts` icindeki `TAVLA_TEXT` kullaniliyor (`tt(key, vars)`). Entegrasyonda bu anahtarlar i18n dosyalarina tasinir, `tt` yerine `t` gelir, `text.ts` silinir.
Yeniden kullanilan mevcut anahtarlar: `you`, `leave`, `sideTakeNo`, `cardsLeaveConfirm`, `cardsWaitingTurn`, `cardsWaitingOpponent`, `game.tavla`.

| Anahtar | Turkce | English |
|---|---|---|
| tavlaUndo | Geri al | Undo |
| tavlaCommit | Tamam | Done |
| tavlaPass | Oynayacak hamle yok — Pas | No move possible — Pass |
| tavlaPickChecker | Sıra sende — oynayacağın pula dokun | Your turn — tap a checker to move |
| tavlaPickTarget | Şimdi gideceğin yere dokun | Now tap where it goes |
| tavlaPressDone | Hamlen bitti — Tamam'a bas | Move finished — press Done |
| tavlaNoMove | Zarlarla hamle yok | No move with these dice |
| tavlaWaitingFor | Sıra {name} adlı oyuncuda | Waiting for {name} |
| tavlaOpeningRoll | Büyük atan başlar | Higher die starts |
| tavlaOpeningDie | {name}: {n} | {name}: {n} |
| tavlaWhite | Beyaz | White |
| tavlaBlack | Siyah | Black |
| tavlaPips | Pip {n} | Pips {n} |
| tavlaOffCount | Toplanan {n} | Borne off {n} |
| tavlaScore | Skor {n} / {target} | Score {n} / {target} |
| tavlaBar | Bar | Bar |
| tavlaBearOff | Toplama alanı | Bear-off tray |
| tavlaPoint | {n}. hane, {c} pul | Point {n}, {c} checkers |
| tavlaPointEmpty | {n}. hane, boş | Point {n}, empty |
| tavlaKindTek | Tek | Single game |
| tavlaKindMars | Mars | Gammon |
| tavlaKindKoncina | Konçina | Backgammon |
| tavlaResultNote | {kind} — {n} sayı | {kind} — {n} points |

Not: `tavlaWaitingFor` su an kullanilmiyor (ekran `cardsWaitingTurn` kullaniyor); istenirse silinebilir. `tavlaOpeningDie` ayni sekilde ayrildi, kullanilmiyor.
