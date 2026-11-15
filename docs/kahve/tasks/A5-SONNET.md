GÖREV: A5-SONNET  FAZ: A
AMAÇ: Kahve kabuğu: Intro metni, Kahve Salonu (4 grup), Oyun Seçimi, "Son oynadığın" kısayolu, Android geri tuşu. Okey oynanışı değişmez.
OKU: PROMPT_LOCAL.md §1 ve §2.4, docs/tasarim/TASARIM.md, docs/ux-raporu.md, app/src/App.tsx, app/src/screens/{Intro,Lobby}.tsx, app/src/i18n/{index,tr,en}.ts
SÖZLEŞME: packages/game-core/src/types.ts (GameId, TableGroup, GameMeta) @ 2d1c37b. CATALOG A2'den gelecek; gelene kadar
          app/src/screens/kahveGames.ts içinde geçici sabit liste tut (aynı GameMeta şekli). A2 birleşince `@kahve/catalog`'a geçilir.
WORKTREE: C:/Users/mfaru/okey101/kahve-a5 (dal feat/kahve-a5)
SAHİP OLDUĞUN YOLLAR: app/src/screens/KahveSalonu.tsx, OyunSecimi.tsx, kahveGames.ts, Intro.tsx (metin), App.tsx (sadece ekran seçimi / gezinme), app/src/i18n/tr.ts, en.ts
DOKUNMA: app/src/net/**, shared/**, server/**, packages/**, GameScreen ve okey bileşenleri, diğer 11 dil dosyası, package.json, lockfile. Yeni bağımlılık YOK.

AKIŞ: intro → isim (mevcut) → KahveSalonu → OyunSecimi(grup) → okey için bugünkü Lobby (101/Düz, Hemen Oyna / Arkadaşlarla) aynen.
- KahveSalonu: 2×2 ızgara: 🀄 Okey Masaları (aktif), 🃏 Kağıt Masaları, 🎲 Tavla Köşesi, ⚫ Dama & Domino ("Yakında" rozeti, tıklanmaz, erişilebilirlik etiketi).
- Okey oyuncusu için tek ek adım "Okey Masaları" olmalı: Okey grubuna dokununca doğrudan bugünkü Lobby (101/Düz zaten orada).
  OyunSecimi ekranı kağıt/tavla grupları için (Faz A'da hepsi "Yakında" listesi).
- "Son oynadığın: 101 Okey · Devam" kısayolu KahveSalonu'nun üstünde; mevcut depolama (AsyncStorage) ile, son seçilen oyun kaydedilir. Devam → o oyunun Lobby'si.
- Android geri tuşu: her ekranda bir geri; KahveSalonu'nda varsayılan davranış.
- 60+: yazı ≥15 pt, dokunma alanı ≥56 dp, renk + şekil/simge, ekran başına tek ana eylem, sistem yazı büyütmede taşma yok.
- Metinler tr + en; diğer diller İngilizceye düşer (i18n/index.ts'deki mevcut düşme davranışını kontrol et, değiştirme).
KABUL: `corepack pnpm --filter app typecheck` ve kökte `pnpm test` / `typecheck` yeşil. Ekran ağacının kısa açıklaması ve elle deneme adımları raporda.
SÜREÇ: Önce kısa plan (≤15 satır) → Fable onayı → kod. Commit'ler feat/kahve-a5'te, push YOK. Rapor: docs/kahve/reports/A5-SONNET.md
