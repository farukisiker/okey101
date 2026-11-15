GÖREV: B6-SONNET  FAZ: B
AMAÇ: Tüm oyunlar için ortak kabuk `GameShell` ve oyundan bağımsız reklam kapısı; Kahve Salonu'nda kart oyunlarını aktif gösterme hazırlığı.
OKU: PROMPT_LOCAL.md §2.4 ve ORKESTRA §5.9 (reklam kuralları), kullanıcının global reklam kuralları (MASTER_PLAN'da özet yoksa: açılışta reklam yok,
     sayaç ve bekleme kalıcı, "Reklamsız" tüm oyunları kapsar), app/src/ads/{interstitial,policy}.ts, app/src/components/{OpponentPanel,RoundResult,NoticePanel}.tsx,
     app/src/screens/{GameScreen,KahveSalonu,OyunSecimi}.tsx, app/src/App.tsx, docs/tasarim/TASARIM.md
WORKTREE: C:/Users/mfaru/okey101/kahve-b6 (dal feat/kahve-b6)
SAHİP OLDUĞUN YOLLAR: app/src/components/GameShell.tsx (yeni), app/src/ads/** (sadece oyundan bağımsızlaştırma), RoundResult/OpponentPanel'den ortak parçaları çıkarma,
     OyunSecimi.tsx/KahveSalonu.tsx (aktif oyunlar catalog `status`'una göre otomatik açılır), i18n tr/en (+11 dilde İngilizce yer tutucu)
DOKUNMA: shared/**, server/**, packages/**, app/src/net/**, PistiScreen/BatakScreen ve components/cards (Antigravity), package.json, lockfile

İSTENEN:
1. `GameShell`: üst çubuk (Çık, Ses, oyun adı, kalan süre), rakip panelleri yuvası, durum satırı, el sonu ekranı yuvası, NoticePanel yuvası; çocuk olarak oyun alanı.
   Okey GameScreen'i ŞİMDİ taşınmaz (risk); GameShell kart ekranları için yazılır, okey'e uyumu raporda değerlendirilir.
2. Reklam kapısı: `adGate.onHandCompleted(gameId)` her oyunun el sonunda; ortak, kalıcı sayaç ve bekleme (oyun ayrımı yok); "Reklamsız" hepsini kapsar; açılışta reklam yok.
   Mevcut okey davranışı birebir korunur (aynı sıklık, aynı bekleme). Politika saf fonksiyonsa (policy.ts) app/test altında vitest testleri ekle.
3. El sonu ekranı (genel): her oyun `RoundSummary { rows: {seat, name, points, total}[], matchOver, winnerSeats }` verir; GameShell bunu büyük yazıyla gösterir ("Yeni el" / "Yeni maç" / "Masadan kalk").
4. KahveSalonu/OyunSecimi: catalog'da `status: 'active'` olan oyun kendiliğinden tıklanabilir olur (bugün sadece okey). Kağıt grubundan seçilen oyun için App.tsx yönlendirmesi
   Opus'un B5 işi; sen sadece `onPick(gameId)` geri çağrısını ver.
KABUL: app typecheck + kökte `pnpm test`/`pnpm typecheck` yeşil, okey davranışında değişiklik yok. Rapor: docs/kahve/reports/B6-SONNET.md
SÜREÇ: Önce plan (≤15 satır) → Fable onayı → kod. Push YOK.
