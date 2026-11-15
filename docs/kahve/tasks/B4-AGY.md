GÖREV: B4-AGY  FAZ: B
AMAÇ: Kart görselleri (`CardView`) ve Pişti/Batak oyun ekranları. Motor gelmeden sahte veriyle başla; motor birleşince bağla.
OKU: PROMPT_LOCAL.md §3 "Kart görselleri" ve §2.4, docs/tasarim/TASARIM.md (60+ kuralları, BAĞLAYICI), docs/ux-raporu.md,
     docs/kahve/arastirma/KURALLAR_argon.md OYUN 3–4 §10 (60+ yardımcı bilgiler), app/src/components/{TileView,Rack,OpponentPanel,RoundResult,Button,ConfirmDialog,NoticePanel}.tsx,
     app/src/screens/GameScreen.tsx (okey ekranı: düzen ve dokunma kalıpları için örnek), app/src/theme.ts, app/src/feedback.ts
WORKTREE: C:/Users/mfaru/okey101/kahve-agy (dal feat/kahve-agy)
SAHİP OLDUĞUN YOLLAR: app/src/components/cards/** (yeni), app/src/screens/PistiScreen.tsx, app/src/screens/BatakScreen.tsx, app/src/screens/cards-preview/** (sahte veri),
     app/assets/sounds/card-*.wav (yeni, her biri < 50 KB), i18n anahtar önerileri → docs/kahve/i18n-istek-agy.md (dosyalara SEN yazmazsın)
DOKUNMA: shared/**, server/**, packages/**, app/src/net/**, App.tsx, GameScreen.tsx ve okey bileşenleri, i18n dosyaları, package.json, lockfile.
YENİ BAĞIMLILIK YOK. **react-native-svg YOK:** kartlar View/Text/Unicode (♠ ♥ ♦ ♣) ile çizilir (Fable kararı: yeni native modül istemiyoruz).

İSTENEN:
1. `CardView`: büyük köşe harfi (A, K, Q, J, 10…) ve büyük takım simgesi; ♥♦ kırmızı, ♠♣ siyah; kapalı kart sırtı; seçili (yukarı kalkmış) hali; devre dışı hali.
   En az okey taşı kadar büyük ve okunaklı (TileView ölçülerine bak). Renk körü için takım şekli zaten ayırt edici; ayrıca yüksek kontrast.
2. `Hand`: elde kartlar; ilk dokunuş kartı kaldırır, ikinci dokunuş oynar (PROMPT_LOCAL). Sürükle-bırak isteğe bağlı (reanimated + gesture-handler mevcut; DragSource kalıbı).
   Oynanamayan kartlar soluk (motorun "geçerli hamleler" listesinden; sadece görsel ipucu).
3. `PistiScreen`: orta yığın (üst kart açık, altındakilerin sayısı), rakip panelleri (kart sayısı, toplanan kart sayısı, pişti sayısı), puan satırı, "Pişti!" vurgusu.
4. `BatakScreen`: 4 koltuk, masadaki el (trick), ihale diyaloğu (4/5…13 ve "Pas"), koz seçim diyaloğu (4 büyük takım düğmesi), alınan el sayıları ve ihale göstergesi.
5. Sesler: kart atma, kart toplama (küçük .wav, `feedback.ts` üzerinden; mevcut ses ayarına uyar).
6. Ekran props'ları: `view` (motorun V tipi), `onAction(a)`, `seat`; motor tipleri gelene kadar `app/src/components/cards/fakeTypes.ts` içinde tek yerde sahte tip ve sahte veri.
   Önizleme: geliştirme için `cards-preview` ekranı (App.tsx'e bağlamak Opus'un işi; sen sadece bileşeni yaz).
7. 60+: yazı ≥15 pt (kart köşe harfi çok daha büyük), dokunma ≥56 dp, tek ana eylem, yatay ekran 1280x800 tablette taşma yok (ana test cihazı ALFA_8TX tablet).
KABUL: `corepack pnpm --filter app typecheck` ve kökte `pnpm test`/`pnpm typecheck` yeşil; raporda ekran görüntüsü alınamıyorsa bileşen ağacı ve ölçüler.
SÜREÇ: Argon (gemini-4-argon-high) plan yazar → Fable onayı → Flash (gemini-3.8-flash-high) işçiler kodlar ve typecheck çalıştırır → Argon review eder.
Rapor: docs/kahve/reports/B4-AGY.md. Push YOK.
