GÖREV: C2-AGY  FAZ: C
AMAÇ: `TavlaScreen` ve tavla bileşenleri: tahta, pullar, zarlar, dokun-parla-oynat, Geri al / Tamam / Pas, zar animasyonu ve sesi. Motor gelmeden sahte `TavlaView` ile başla.
OKU: PROMPT_LOCAL.md §3 "C Aşaması" ve §2.4, docs/tasarim/TASARIM.md (60+ kuralları, BAĞLAYICI), docs/kahve/arastirma/KURALLAR_argon.md OYUN 9 §10,
     packages/tavla/src/types.ts (DONDURULMUŞ TavlaView/TavlaAction; tek gerçek kaynak), app/src/screens/BatakScreen.tsx ve PistiScreen.tsx (GameShell kullanımı, düzen),
     app/src/components/{GameShell,Button,NoticePanel,RoundResult}.tsx, app/src/components/cards/{cardSfx,cardLayout}.ts, app/src/theme.ts, app/src/feedback.ts
WORKTREE: C:/Users/mfaru/okey101/kahve-agy (önce `git merge feat/kahve`)
SAHİP OLDUĞUN YOLLAR: app/src/components/tavla/** (yeni), app/src/screens/TavlaScreen.tsx (yeni), app/src/screens/tavla-preview/** (sahte veri),
     app/assets/sounds/dice-*.wav ve checker-*.wav (yeni, her biri < 50 KB), i18n anahtar önerileri → docs/kahve/i18n-istek-tavla.md (i18n dosyalarına SEN yazmazsın)
DOKUNMA: packages/**, shared/**, server/**, app/src/net/**, App.tsx, okey ve kart ekranları/bileşenleri, i18n dosyaları, package.json, lockfile.
YENİ BAĞIMLILIK YOK, react-native-svg YOK: tahta View'larla (üçgenler border hilesi veya döndürülmüş View; ya da dikdörtgen hane + üçgen uç), pullar yuvarlak View.

İSTENEN:
1. Tahta: 24 hane, ortada bar, sağda toplanan pullar. Oyuncu kendi pullarını daima ALTTA görür, evi sağ altta (koltuk 1 için tahta 180° çevrilmiş çizilir; veri mutlak 1..24).
   Hane numaraları küçük ama okunur. Bir hanede 5'ten çok pul varsa 5 pul + üstünde sayı ("7").
2. Pullar: beyaz (krem) ve siyah (koyu kahve), kalın kontrastlı kenar; 60+ için hane genişliğine sığan en büyük boy.
3. Dokun-parla-oynat (PROMPT_LOCAL): kendi sırandayken pula (veya bara) dokun → `view.moves` içinde o `from`'dan gidilebilen hedefler parlasın ve üzerinde zar etiketi ("3", "5", "8 (3+5)") yazsın.
   Hedefe dokun → `dice` sırasıyla `{type:'step', from, die}` aksiyonları gönder (çok zarlıda her adımdan sonra yeni view'ı bekle; ara adım reddedilirse dur).
   Toplama hedefi ('off') sağdaki toplama alanıdır. Tek yasal hedef olsa bile pul kendiliğinden gitmez; oyuncu hedefe dokunur (yanlış hamleyi önlemek için).
   Sürükleme isteğe bağlı, şart değil.
4. Düğmeler (büyük, ≥56 dp): "Geri al" (`canUndo`), "Tamam" (`canCommit`), "Pas" (`mustPass`, metin: "Oynayacak hamle yok — Pas"). Tek ana eylem vurgulu.
5. Zarlar: iki büyük zar (noktalı yüz, View ile). `turnNumber` değişince kısa yuvarlanma animasyonu (reanimated, ≤ 600 ms) + zar sesi.
   Kullanılan zarlar soluk (`remaining`'e göre; çiftte 4 küçük gösterge). Açılışta (turnNumber 0) iki koltuğun tek zarı ve "Büyük atan başlar" yazısı.
6. Rakip hamlesi: `lastTurn` değişince rakibin adımları sırayla canlandırılır (pul kayar, ~250 ms/adım), kırılan pul bara gider. Pul sesi.
7. Üst bilgi: GameShell başlığında iki oyuncu, pip sayıları, maç skoru (GameShell'in mevcut toplam satırı), sıra kimde. El sonu: tek / mars / konçina ve kazanılan sayı (RoundResult kalıbı).
8. Props: `view: TavlaView & HostTimes`, `onAction(a: TavlaAction)`, GameShell'in istediği diğer props'lar BatakScreen ile aynı biçimde. Tipler `packages/tavla/src/types.ts`'ten
   (catalog bağlanınca `@kahve/catalog`'tan gelecek; şimdilik `app/src/components/tavla/fakeView.ts` içinde sahte view üreticileri ve tipleri doğrudan types.ts'ten kopyalamadan import et:
   `import type { TavlaView, TavlaAction } from '@kahve/tavla'` (app'e bağımlılığı Fable ekler).
9. 60+ ve cihazlar: yatay 1280x800 tablette (ana test cihazı) ve compact (<500 dp yükseklik, telefon) düzende taşma yok; yazı ≥15 pt; dokunma alanı ≥ 56 dp
   (hane dar ise dokunma alanı hanenin tüm yüksekliği). Renk tek başına bilgi taşımaz (parlayan hedefte etiket de var).
KABUL: Fable `corepack pnpm --filter app typecheck` ve kökte test/typecheck çalıştırır (agy komut çalıştıramıyorsa); raporda bileşen ağacı ve ölçüler.
SÜREÇ: Argon (gemini-4-argon-high) plan yazar (docs/kahve/plans/C2-AGY.md) → Fable onayı → Flash (gemini-3.8-flash-high) yazar → Argon review eder → Fable typecheck + commit.
Rapor: docs/kahve/reports/C2-AGY.md. Push YOK.
