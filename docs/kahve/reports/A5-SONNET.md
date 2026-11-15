# A5-SONNET raporu

Dal: feat/kahve-a5. Commitler: 9d5ccf8 (plan), 47c8135 (kod), rapor commit'i bunun üstünde. Push yok.

## Değişen dosyalar
- yeni: app/src/screens/KahveSalonu.tsx, OyunSecimi.tsx, kahveGames.ts
- app/src/App.tsx (yalnız ekran seçimi ve geri tuşu), app/src/screens/Intro.tsx (yalnız metin satırı)
- app/src/screens/Lobby.tsx: 3 isteğe bağlı prop (onNameReady, onExit, onPicked); prop yokken eski davranış.
  onNameReady yalnız ilk isim girişinde çağrılır (isim değiştirmede değil); onExit isim yokken çağrılmaz.
- app/src/i18n/tr.ts, en.ts ve 11 dil dosyası: 24 yeni anahtar (diğer diller İngilizce yer tutucu, faz D'de çevrilecek). Dosyalar UTF-8, tr.ts'te ğ/ş/ı sağlam.

## Ekran ağacı
intro -> (isim yoksa okeyLobi'de isim sorulur, sonra) salon
salon (KahveSalonu): Son oynadığın kısayolu, 2x2 kart
  - Okey Masaları -> okeyLobi (bugünkü Lobby: 101 / Düz / Salon-arkadaşlar), tek ek adım
  - Kağıt Masaları, Tavla Köşesi -> secim (OyunSecimi, hepsi "Yakında" listesi)
  - Dama & Domino: tıklanmaz, "Yakında" rozeti
  - Son oynadığın · Devam -> okeyLobi
okeyLobi -> oturum -> WaitingRoom / GameScreen (değişmedi)
Geri: secim -> salon (App BackHandler); okeyLobi -> Lobby iç adımı (arkadaşlar/isim), yoksa salon (onExit); salon -> varsayılan (çıkış).

Son oynanan: AsyncStorage anahtarı `okey101.lastGame` ('okey101' | 'okeyDuz'), 101/Düz düğmesine basınca kaydedilir.

## Çıktılar
- `corepack pnpm --filter app typecheck`: `$ tsc --noEmit` hatasız.
- Kök `pnpm test`: son satırlar: `Test Files 3 passed (3)  Tests 23 passed (23)` (server; paketlerde test yok).
- Kök `pnpm typecheck`: game-core, shared, catalog, server, app: Done, hata yok.

## Elle deneme
1. Temiz kurulum: intro -> isim sorulur -> kaydedince salon gelir.
2. Salon: 4 kart, Dama soluk ve tıklanmaz; Kağıt/Tavla -> liste "Yakında", Geri/Android geri -> salon.
3. Okey Masaları -> 101 (veya Düz) Hemen Oyna: eskisi gibi başlar. Çıkınca Lobby; Android geri -> salon; salonda geri -> uygulamadan çıkar.
4. Salon üstünde "Son oynadığın: 101 Okey · Devam" görünür, dokununca Lobby.
5. Arkadaşlarla (Salon) ve isim değiştir akışında geri tuşu bir adım geri gider; isim değiştirme salona atmaz.
6. Sistem yazı boyutunu büyüt: kartlar taşmaz (ScrollView + flexWrap). Cihazda denenmedi (yalnız typecheck).

## Düzeltme (Fable incelemesi)
iOS'ta donanım geri tuşu yok: Lobby ana ekranında (isim varken, `onExit` verilmişse) ikincil "Salona dön" düğmesi eklendi (minWidth 120, Button 56 dp). Arkadaşlar alt ekranı ve isim düzenleyicide görünmez; `onExit` yoksa hiçbir şey çizilmez.

## A2 birleşti
feat/kahve birleştirildi; geçici liste kaldırıldı, kahveGames.ts artık @kahve/catalog (CATALOG, gamesInGroup) kullanıyor; ekran davranışı aynı.
