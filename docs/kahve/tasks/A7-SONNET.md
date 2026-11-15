GÖREV: A7-SONNET  FAZ: A (okey kural güncellemesi, arayüz kısmı)
AMAÇ: Ceza bilgi paneli, yandan taş alma onay diyaloğu, donmuş geri sayım gösterimi ve 101 maç uzunluğu seçimi.
OKU: docs/tasarim/TASARIM.md, docs/kahve/tasks/A7-OPUS.md (KARARLAR ve CEZA BİLDİRİMİ bölümü: veri biçimi oradan), packages/game-core/src/types.ts (GameNotice, NOTICE_MS),
     app/src/screens/GameScreen.tsx, Lobby.tsx, WaitingRoom.tsx, app/src/components/*, app/src/i18n/{index,tr}.ts, locales/en.ts
WORKTREE: C:/Users/mfaru/okey101/kahve-a7s (dal feat/kahve-a7s)
SAHİP OLDUĞUN YOLLAR: app/src/components/NoticePanel.tsx (yeni), app/src/screens/GameScreen.tsx, Lobby.tsx, WaitingRoom.tsx (sadece bu görevin parçaları),
     app/src/i18n/tr.ts + 12 locale (yeni anahtarlar; diğer 11 dilde İngilizce yer tutucu, A5 düzeniyle)
DOKUNMA: shared/**, server/**, app/src/net/** (Opus), packages/**, package.json, lockfile. Yeni bağımlılık YOK.

VERİ (Opus sağlayacak, sen buna göre yaz; A7-OPUS birleşene kadar typecheck için `view.notice` alanına güvenli erişim kullanabilirsin ama
nihai halde tip doğrudan `PlayerView.notice: GameNotice | null` ve `PlayerView.noticeMsLeft?: number`):
- reason kodları: 'islek' | 'okeyDiscard' | 'sideTileUnused' | 'okeyTaken'.

İSTENEN:
1. NoticePanel: yeni bildirim (id değişince) geldiğinde 5 sn (NOTICE_MS) tüm oyunculara görünen büyük panel: "<isim> işlek taş attı: +101 ceza".
   i18n anahtarları `notice.islek`, `notice.okeyDiscard`, `notice.sideTileUnused`, `notice.okeyTaken` ({name}, {amount} yer tutucuları).
   TASARIM.md: yazı ≥22 pt başlık, yüksek kontrast, renk + simge (⚠), ekranın ortasında ama taşları kapatmayan konum, dokunmayı engellemez.
   Kendine yazılan ceza için de aynı panel (isim yerine "Sen" demek gerekmez; isim yeterli).
2. Geri sayım: panel açıkken sıradaki oyuncunun sayacı donmuş görünür (sunucudan gelen `turnMsLeft` donmuş değer; yerel geri sayım panel süresince azalmaz).
3. Yandan taş alma onayı (karar 3): 101 modunda, henüz açmamış oyuncu soldan (ıskartadan) taş almaya kalkınca diyalog:
   "Bu taşla açamazsan 101 puan ceza yersin. Emin misin?"  Evet → aksiyon gider; Hayır → hiçbir şey olmaz. Düz okeyde ve açmış oyuncuda diyalog YOK.
   Sürükle-bırak ile almada da aynı onay. 60+: iki büyük düğme (≥56 dp), "Evet, al" / "Vazgeç".
4. 101 maç uzunluğu (karar 8): Lobby'de 101 için küçük bir seçim (Sınırsız · 5 el · 7 el · 11 el · 501 puan · 1001 puan), varsayılan 5 el,
   son seçim AsyncStorage'da (`okey101.matchEnd`). "Hemen Oyna" ve arkadaş masası açarken `options: { matchEnd }` olarak geçer
   (Opus'un `quickPlay(name, mode, options?)` / `createRoom(..., options?)` kancaları). Ekranda tek ana eylem kuralı bozulmasın: seçim ikincil, sade.
   Maç bitince el sonu ekranında "Maç bitti" ve sıralama görünür (mevcut RoundResult'a küçük ek).
KABUL: app typecheck + kökte `pnpm test`/`pnpm typecheck` yeşil (Opus'un dalı birleşmeden önce kendi dalında yeşil olmalı). Raporda elle deneme adımları.
SÜREÇ: Önce plan (≤15 satır) → Fable onayı → kod. Commit'ler feat/kahve-a7s, push YOK. Rapor: docs/kahve/reports/A7-SONNET.md
