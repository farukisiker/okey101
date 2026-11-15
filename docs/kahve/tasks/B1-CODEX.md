GÖREV: B1-CODEX (+ sonra B2 Pişti, B3 Batak; her biri ayrı plan/onay)  FAZ: B
AMAÇ: 52'lik kart motoru `@kahve/cards`, ardından `@kahve/pisti` ve `@kahve/batak` kural motorları (saf TS, GameDefinition uygular).
OKU: PROMPT_LOCAL.md §3 "B Aşaması" (BAĞLAYICI), docs/kahve/arastirma/KURALLAR_argon.md (Bölüm 1–2, OYUN 3 Pişti, OYUN 4 Batak, Bölüm 3 #6–8),
     docs/kahve/MASTER_PLAN.md §4–4e, packages/game-core/src/{types,rng,seats,clock}.ts, packages/catalog/src/okey.ts (adaptör örneği), ORKESTRA §2–3
SÖZLEŞME: packages/game-core/src/types.ts @ feat/kahve HEAD (değiştirme; eksik → docs/kahve/requests/codex-<konu>.md)
WORKTREE: C:/Users/mfaru/okey101/kahve-codex (önce `git merge feat/kahve`)
SAHİP OLDUĞUN YOLLAR: packages/cards/**, packages/pisti/**, packages/batak/** (package.json'ları Fable açar; bkz. aşağı)
DOKUNMA: types.ts, shared/**, server/**, app/**, packages/catalog/**, kök package.json, lockfile

PAKET İSKELETİ: Fable her paketi (package.json, tsconfig, boş src/index.ts) feat/kahve'de önceden açar; sen sadece src/test yazarsın. Bağımlılık: yalnız `@kahve/core` (pisti/batak ayrıca `@kahve/cards`).

B1 @kahve/cards:
- `Suit = 'S'|'H'|'D'|'C'`, `Rank = 2..14` (11 J, 12 Q, 13 K, 14 A), `Card = { id: number; suit; rank }` (JSON düz nesne; id 0..51 sabit).
- `fullDeck()`, `shuffleDeck(rng)` (core shuffle), `deal(deck, counts[])`, `compare(a, b, lead, trump?)` (el alma kuralı), `suitColor(s): 'red'|'black'`,
  `cardLabel(c)` (UI için "A♠", "10♦"), `sameRank`, sıralama yardımcıları (`sortHand(hand, order)`: takım sonra değer; 60+ için tutarlı sıra).
- Testler: deste 52 benzersiz, seed'li karıştırma deterministik, dağıtım, compare tüm durumlar.
B2 @kahve/pisti (B1 onayından sonra ayrı plan):
- PROMPT_LOCAL Pişti kuralları + ayarlar: oyuncu 2/4, eşli (4 kişide), hedef 51/101/151 (varsayılan 151), pişti 10, valeye vale pişti 20, puanlar (As 1, Vale 1, ♣2 2, ♦10 3, en çok kart 3),
  son kartlar son alana. Bölgesel ayarlar MASTER_PLAN §4e (kapalı 3 kart, açılışta vale) varsayılanlarıyla, kullanıcı cevabına göre sadece varsayılan değişir.
- Bot: easy rastgele geçerli; medium/hard düşen kartları sayar, pişti fırsatı, rakibe pişti verecek kartı atmaz, valeyi doğru anda.
- GameDefinition<PistiState, PistiAction, PistiView, PistiOptions> (`pistiDef`), noticeOf yok (ceza yok) ama `notices` yerine pişti olayı için `lastAction` görünümde.
- viewFor: rakip eli ASLA (sadece sayısı), deste sırası ve kapalı kartlar asla, seed asla.
B3 @kahve/batak (B2'den sonra ayrı plan): PROMPT_LOCAL Batak (ihaleli tekli, ihale 5'ten (ayar 4), renge uyma, koz zorunluluğu (ayar), geçme zorunluluğu (ayar, varsayılan açık),
  koz ilk koz düşmeden açılamaz (ayar), puanlama ve "hiç el almayan" ayarı; Koz Maça ve Eşli varyantları ayar olarak hazır), bot ihale sezgisi.

KABUL (her paket): `corepack pnpm --filter <paket> test` + typecheck yeşil, kapsam ≥ %85 (`--coverage` yoksa test–kural eşleme tablosu),
seed'li bot-bot 200 oyun geçersiz hamle 0 (paket testinde; 1000 seed sim OpenCode'un), JSON gidiş-dönüş, viewFor sızıntı testi, kökte test/typecheck yeşil.
Codex sandbox .git'e yazamaz: commit'siz bırak, Astra review eder, Fable commit eder. Rapor: docs/kahve/reports/B1-CODEX.md (B2, B3 ayrı).
