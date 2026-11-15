GÖREV: B5-OPUS  FAZ: B
AMAÇ: Pişti'yi (sonra Batak'ı) uygulamada uçtan uca oynanır yapmak: catalog kaydı, çevrimdışı (botlara karşı) ve çevrimiçi (salon, şifreli masa) akış, ekranların gerçek motora bağlanması.
OKU: PROMPT_LOCAL.md §2.2–2.4 ve §3 B, docs/kahve/MASTER_PLAN.md §2 §4e, packages/game-core/src/types.ts, packages/catalog/src/*, packages/pisti/src/* (B2),
     server/src/{room,server}.ts (A4: zaten genel), app/src/net/{useOkey,useLocalGame}.ts, app/src/App.tsx, app/src/components/GameShell.tsx (B6),
     app/src/components/cards/** ve app/src/screens/{PistiScreen,BatakScreen}.tsx (B4, Antigravity), app/src/screens/{KahveSalonu,OyunSecimi,Lobby,Salon,WaitingRoom}.tsx
SÖZLEŞME: types.ts, protocol.ts @ feat/kahve HEAD (değiştirme; eksik → docs/kahve/requests/opus-<konu>.md)
WORKTREE: C:/Users/mfaru/okey101/kahve-b5 (dal feat/kahve-b5)
SAHİP OLDUĞUN YOLLAR: packages/catalog/src/** (+test), server/src/**, app/src/net/**, app/src/App.tsx, yeni `app/src/screens/GameLobby.tsx` (kart oyunları lobisi),
     PistiScreen/BatakScreen ve components/cards'ta SADECE bağlama (fakeTypes → gerçek tipler; ekran düzenine dokunma), i18n (yeni anahtarlar tr/en + 11 dilde İngilizce)
DOKUNMA: packages/{cards,pisti,batak}/src (Codex), shared/**, okey ekranları (GameScreen, Lobby'nin okey akışı), package.json, lockfile

İSTENEN:
1. catalog: `pistiDef` kaydı (`status: 'active'`), `getDefinition('pisti')`; catalog testleri (seatChoices [2,4], normalize).
2. Genel istemci kancası `useKahveGame(gameId)`: çevrimdışı (botlarla, `def` üzerinden, A4/A7 saat + bildirim dondurma mantığıyla aynı) ve çevrimiçi (protokol v2:
   `room:quickPlay/create/join` `game` ile, `GameViewEnvelope` açma, `salon:watch(true, {games:[id]})`). Okey `useOkey`/`useLocalGame` DEĞİŞMEZ.
   Dönen arayüz: `{ view, room, seat, act(a), nextRound(), leave(), matchOver, summary: RoundSummary | null, busy, error }`.
3. `GameLobby` (kart oyunları için): "Hemen Oyna" (botlarla; Pişti için 2 / 4 kişi seçimi, son seçim hatırlanır) ve "Arkadaşlarla" (salon listesi o oyuna filtreli, masa aç / şifreli / kodla katıl).
   Mevcut Lobby/Salon/WaitingRoom bileşenlerini yeniden kullan (gerekirse küçük, geriye uyumlu prop'larla); okey akışı değişmez.
4. App.tsx: OyunSecimi `onPick(gameId)` → GameLobby → (bekleme) → oyun ekranı[game]; geri tuşu her adımda bir geri; "Son oynadığın" kısayolu kart oyunlarını da kapsar.
5. Ekranlar: PistiScreen/BatakScreen'i GameShell içinde gerçek view/act ile bağla; el sonunda `adGate.onHandCompleted(gameId)` (GameShell zaten sayıyorsa çift sayma YOK).
6. Sunucu: kart oyunu masası uçtan uca (create → join → start → oyna → nextRound) için server testi; v1 istemci okey dışı masayı görmez/giremez (A4 testleri yeşil kalır).
KABUL: kökte `pnpm test` ve `pnpm typecheck` yeşil, test sayısı düşmez; `npx expo export --platform android` paketliyor (çıktı boyutu rapora);
raporda tablette deneme adımları (Pişti 2 kişi botlarla, 4 kişi botlarla, yerel sunucuda iki cihaz).
SÜREÇ: Önce plan (≤25 satır) → Fable onayı → kod. Commit'ler feat/kahve-b5, push YOK. Rapor: docs/kahve/reports/B5-OPUS.md.
Batak: B3 birleşince aynı yoldan ikinci tur (ayrı kısa onay).
