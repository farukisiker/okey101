# C2-AGY raporu: Tavla ekrani (Claude Sonnet 5.5, Antigravity yerine)

## Bilesen agaci
```
TavlaScreen (screens/TavlaScreen.tsx)
└─ GameShell (opponents = PlayerBar, status, summary = tavlaSummary)
   └─ alan (yatay: tahta | panel, dar/dikey: tahta ustte panel altta)
      ├─ TavlaBoard (components/tavla/Board.tsx)
      │   ├─ ucgenler + hane numaralari (View border hilesi), bar, toplama alani
      │   ├─ tam hane yuksekliginde Pressable'lar (dokunma alani)
      │   ├─ Checker'lar (Checker.tsx), >5 pulda 5 pul + sayi
      │   ├─ hedef etiketleri (Chip: "3", "8" + "3+5")
      │   └─ FlyingChecker (rakip hamlesi, reanimated, 250 ms)
      └─ panel: DicePanel (Die/DieFace) + ipucu yazisi + ActionButton'lar (Geri al, Tamam | Pas)
```
Saf (testli) yardimcilar: `boardMath.ts` (yonelim, planSteps, targetsFor, applyStep/unapplyStep, boardBefore), `tavlaGeometry.ts` (olculer, slotCenter), `summary.ts`. Kancalar: `useOpponentAnim.ts`. Ses: `sfx.ts`. Sahte veri: `fakeView.ts` + `screens/tavla-preview/TavlaPreviewScreen.tsx` (App.tsx'e baglanmadi).

## Etkilesim
Pula (veya bara) dokun -> `view.moves`'tan o `from`'un hedefleri parlar ve etiket tasir. Hedefe dokun -> `planSteps` her zar icin `{type:'step', from, die}` uretir; ilki hemen gider, sonrakiler her yeni view'dan sonra, motor hala `moves` icinde sunuyorsa gonderilir (degilse veya 2,5 sn view gelmezse durur). Ayni hedefe birden cok yol varsa en az zarli olan secilir. Tek hedef olsa bile pul kendiliginden gitmez. Geri al = `undo`, Tamam/Pas = `commit`; ana eylem (Tamam veya Pas) vurgulu.

## Olculer (dp)
| Pencere | Mod | Pul capi | Hane (gen x yuk) | Tahta | Panel |
|---|---|---|---|---|---|
| Tablet 1280x800 | yan yana | 54 | 60 x 286 | 849 x 584 | 395 x 640 |
| Telefon 812x375 (kertikli, kenar 44, alt 21) | yan yana, compact | 21 | 24 x 111 | 338 x 228 | 350 x 242 |
| Telefon 667x375 | yan yana, compact | 23 | 26 x 122 | 367 x 250 | 264 x 263 |
| Dikey 400x800 | ust-alt | 23 | 26 x 122 | 367 x 256 | 384 x 364 |

Dokunma alani = hanenin tum yuksekligi; hane numarasi 15 pt; dugmeler >= 56 dp (compact 56, tablet 68), yazi 20 pt; zarlar tablet 60-96, compact 52. Testler (`app/test/tavla.test.ts`) 6 pencere boyutunda tasma olmadigini ve slotlarin tahta icinde kaldigini dogrular.

## Sesler (app/assets/sounds, `app/scripts/make-tavla-sounds.mjs` ile uretildi, indirme yok)
- `dice-roll.wav` 27 KB (0,62 sn, 13 tikirti)
- `checker-move.wav` 7 KB
- `checker-hit.wav` 13 KB
Zar sesi `turnNumber` degisince (acilista degil), pul sesi rakip adimlarinda ve kendi hamlede; kirik pulda "hit" sesi.

## Gercek motor gelince yapilacaklar
- `@kahve/catalog` tavla kaydi ve `useKahveGame` baglantisi: `TavlaScreen`'i App.tsx'te `game === 'tavla'` icin acmak (props BatakScreen ile ayni; `summary` hook'tan gelirse `tavlaSummary` yedek kalir).
- i18n: `text.ts` -> `docs/kahve/i18n-istek-tavla.md` anahtarlari.
- `fakeView.ts` yalniz onizleme icindir (`simpleMoves` "iki zari da oyna" kuralini bilmez); motorun `moves` listesi gercek kaynaktir. Motor `CheckerMove` listesinde gercekten 'tek adimlar + coklu zarli hamleler' dondurmeli (UI ara adimlarin `moves` icinde olmasina guveniyor).
- Rakip animasyonu `view.lastTurn` + o turun basindaki tahtayi `view.board`'dan geri sararak uretir; motor sadece `lastTurn.steps` icinde `hit` bayragini dogru doldurmali.
- Cihazda denenmedi (emulator/tablet yok); yalniz typecheck + saf birim testleri.

## Acik sorular (Fable)
1. Gorev "koltuk 1 icin tahta 180 derece cevrilir, ev sag altta" diyor; ama 180 derece donus siyahin evini (19..24) SOL ALTA koyar. Ev sag altta kalsin diye satirlar yer degistirdi (dikey ayna: siyahin altta 13..24, ustte 12..1). Iki koltuk da ayni saat yonunun tersine oynar. Gercek 180 derece isteniyorsa yalniz `pointCell`/`cellPoint` (boardMath.ts) degisir.
2. Kucuk telefonda (kertikli 812x375) pul capi 21 dp; 60+ icin buyuk degil. Dokunma alani yine tam hane yuksekligi. Gerekirse compact'ta ust bilgi daha da kisaltilmali.
3. Hane renkleri/tahta tonu `theme.ts` disindan sabit; tasarim onayi bekliyor.
