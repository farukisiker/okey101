GÖREV: C3-OPUS  FAZ: C
AMAÇ: Tavla'yı uygulamada uçtan uca oynanır yapmak: catalog kaydı, çevrimdışı (bota karşı) ve çevrimiçi (salon, şifreli masa) akış, TavlaScreen bağlama, sunucu testi.
OKU: docs/kahve/tasks/B5-OPUS.md ve reports/B5-OPUS.md (aynı yol Pişti/Batak için yapıldı), packages/tavla/src/** (C1), app/src/screens/TavlaScreen.tsx (C2),
     packages/catalog/src/*, app/src/App.tsx, app/src/net/*, app/src/screens/{GameLobby,KahveSalonu,OyunSecimi}.tsx, server/src/{room,server}.ts
SÖZLEŞME: game-core types.ts, shared protocol.ts, packages/tavla/src/types.ts (değiştirme)
SAHİP OLDUĞUN YOLLAR: packages/catalog/src/** (+test), server/src/** ve server/test/**, app/src/net/**, app/src/App.tsx, GameLobby (tavla için 2 kişi, kişi seçimi yok),
     KahveSalonu'nda Tavla Köşesi'nin açılması, TavlaScreen'de SADECE bağlama, i18n (yeni anahtarlar tr/en + 11 dilde İngilizce; C2'nin i18n-istek-tavla.md önerileri)
DOKUNMA: packages/tavla/src (Codex), tavla bileşen düzeni (Antigravity), okey akışı, package.json/lockfile (Fable)
İSTENEN:
1. catalog: `tavlaDef` kaydı (status 'active'), CATALOG'da meta('tavla') yerine gerçek kayıt; catalog testleri (seatChoices [2], normalize, sözleşme).
2. Zar sunucuda: çevrimiçi masada zarlar yalnız sunucudaki state'te (rngState) üretilir; istemciye gelen view'da rngState yok (sunucu testi + sızıntı testi).
3. Çevrimdışı: localHost üzerinden bota karşı (useKahveGame aynen); bot adımları arasında okunur gecikme (BOT_DELAY; tavlada bir turdaki adımlar ~600 ms arayla).
4. Sunucu: tavla masası create → join → start → oyna → nextRound → maç sonu (targetScore) uçtan uca testi; v1 istemci tavla masasını görmez.
5. App.tsx: tavla ekranı `kahve.gameId === 'tavla'` dalı, el sonu reklam kapısı GameShell üzerinden (çift sayma yok).
KABUL: kökte test/typecheck yeşil, test sayısı düşmez; clock-equivalence (localHost ↔ Room) tavla için de geçer; `npx expo export --platform android` paketliyor.
SÜREÇ: Önce plan (≤20 satır) → Fable onayı → kod. Push YOK. Rapor: docs/kahve/reports/C3-OPUS.md.
