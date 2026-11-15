# Demli Kahve: Ana Plan

> Sahip: Fable (bu oturumda Claude Opus 5.5 yürütüyor). Ürün ve kırmızı çizgiler: `PROMPT_LOCAL.md`.
> Kim, nasıl, hangi kontrolle: `docs/kahve/ORKESTRA.md`. Durum: `docs/kahve/STATUS.md`.
> Çelişkide kırmızı çizgiler kazanır. Her faz sonunda Fable durur, kullanıcı "devam" der.

## 1. Başlangıç noktası
- `feat/kahve` @ `1254b41`: okeyin son hali (tur saati, yerdeki okeyi alma, gösterge, sürükle-bırak, **çift açma**).
- Test tabanı **93** (shared 70, server 23). Hiçbir fazda azalamaz.
- A0 sözleşmeleri donduruldu: `packages/game-core/src/types.ts`, `shared/src/protocol.ts` v2 ekleri.

## 2. Sözleşme özeti (A0, donmuş)

### 2.1 `@kahve/core` (`packages/game-core/src/types.ts`)
- `GameId`, `GAME_IDS`, `isGameId`, `TableGroup`, `Rng`, `BotLevel = 'easy'|'medium'|'hard'`.
- `GameMeta` (katalog satırı; "Yakında" oyunlar sadece bunu verir) ve `GameDefinition<S, A, V, Opts>`.
- `PROMPT_LOCAL.md` §2.2 arayüzünden bilinçli farklar (Room'u genelleştirmek için gerekenler):

| Ek / fark | Neden |
|---|---|
| `create(opts, names, rng, round)` | Okey başlangıç koltuğunu tur sırasından alıyor (`round % 4`). |
| `seats(opts)` + `seatChoices` (sabit `seats: number` yerine) | Pişti 2 veya 4 kişi. |
| `turn(state) → {seat, key, first} \| null` | Room/useLocalGame kimin oynayacağını ve saatin ne zaman sıfırlanacağını bilmeli. |
| `refillsClock(action)`, `clock: {baseMs, firstTurnFactor}` | Okeyin "ilk tur 60 sn, açma/işleme bir kez doldurur" kuralı geneldir; süre oyun başına. |
| `viewFor(state, seat, ctx?)` | Okey görünümü kalan süreyi (`turnMsLeft`) taşıyor; saat kuralın değil, ev sahibinin. |
| `isAction(raw)`, `normalizeOptions(raw)` | Ağdan gelen güvenilmez veri, `apply`'dan önce şekil kontrolü. |
| `TurnClock` core'da, okeyinkiyle yapısal olarak aynı | Okey adaptörü saati olduğu gibi geçirir. |

### 2.2 Protokol v2 (`shared/src/protocol.ts`, hepsi isteğe bağlı alan)
- `PROTOCOL_VERSION = 2`, `HandshakeAuth {v}`, `clientProtocol(auth)` (yok/bozuk = 1).
- `room:create` / `room:quickPlay`: `game?`, `options?`. `room:join`: `game?` (uyuşmazlık = hata).
- `RoomInfo.game?`, `TableSummary.game?` (yeni sunucu hep doldurur; yoksa eski sunucu → `gameOfMode(mode)`).
- `salon:watch(on, filter?: {games?})`: filtre yok = sadece okey masaları (v1 istemciler).
- `game:view`: v1 sokete çıplak `PlayerView`, v2 sokete `GameViewEnvelope {game, view}`.
- `KahveClientToServerEvents` / `KahveServerToClientEvents`: A4 sunucu ve `app/net`'i bunlara geçirir. Olay adları aynı.
- Yeni istemci + eski sunucu: `game` gönderip dönen `RoomInfo`'da `game` yoksa → odadan çık, "Sunucu güncelleniyor" göster
  (eski sunucu `game`'i yok sayıp 101 masası açar; sessizce okeye düşmek yasak).
- Eski istemci + yeni sunucu, okey dışı masa → `ERR_UPDATE_APP`.

## 3. Faz A: Kahve kabuğu (oynanış değişmez)

| Görev | Sahip (model) | Bağımlılık | Yollar | Kabul |
|---|---|---|---|---|
| **A0** Sözleşmeler | Fable | – | `packages/game-core/src/types.ts`, `shared/src/protocol.ts`, `pnpm-workspace.yaml`, `shared/package.json` | Yapıldı: typecheck 4 paket yeşil, 93 test yeşil |
| **A1** game-core | Codex: Astra `gpt-6-astra` planlar/review eder, Sol `gpt-6.1-sol` yazar | A0 | `packages/game-core/src/**` (types.ts hariç), `packages/game-core/test/**` | `seededRng` okeydekiyle **bit bit aynı dizi** (aynı seed → aynı sayılar, test), `shuffle`, koltuk yardımcıları (`nextSeat(seat, n)`, `leftOf`, `seatOrder`), bir `pickBotNames` sarmalayıcısı değil sadece saf yardımcılar. Kök `test` script'ine `@kahve/core` eklenir. `tiles.ts` **değişmez** (yeniden dışa aktarım kararı A2'de: okey kendi RNG'sini korur, core aynı algoritmayı taşır). Kapsam ≥%90. |
| **A2** Okey adaptörü + katalog | Claude Opus 5.5 | A0 | `packages/catalog/**` (yeni `@kahve/catalog`), adaptör `packages/catalog/src/okey.ts` | `okey101Def`, `okeyDuzDef` (`GameDefinition` uygular, `shared/src/*`'a dokunmaz). `CATALOG: GameMeta[]` 8 oyun, `getDefinition(id)`. **Eşdeğerlik testleri:** aynı seed ile 200 el, adaptör üzerinden bot-bot oyun = doğrudan `createGame/applyAction/botStep` ile aynı durum dizisi. `isAction` okey aksiyonlarının hepsini kabul, bozuk girdiyi ret. |
| **A3** Uyumluluk fikstürleri (önce kırmızı) | OpenCode: lider `glm-5.3-flash-free`, işçi `deepseek-v4.1-flash-free`; takılırsa Claude Haiku 5.5 | A0 | `server/test/compat*.test.ts`, `server/test/fixtures/v1/**` | v1 istemci senaryoları: `auth` yok, `mode:'101'` ve `'duz'` ile create/quickPlay/join, bir eli bitirene kadar oynama, `salon:watch(true)` filtresiz → sadece okey, `game:view` çıplak PlayerView. v2 senaryoları: `game:'pisti'` + v1 soket → `ERR_UPDATE_APP`; v2 soket → envelope. Bugünkü sunucuda v1 testleri **yeşil**, v2 testleri `it.todo` veya `it.fails` olarak işaretli (A4 yeşile çevirir; test sayısı tabanı düşmez). |
| **A4** Genel Room + useLocalGame + protokol | Claude Opus 5.5 | A1, A2, A3 | `server/src/**`, `app/src/net/**`, gerekirse `app/src/App.tsx` | `Room` → `GameDefinition` ile çalışır (`def.seats(opts)`, `def.turn`, genel saat), `SEATS` sabiti oda kodundan kalkar. Sunucu v1/v2 ayrımı `clientProtocol`. Mevcut 23 server testi + A3 testleri yeşil, `useLocalGame` okeyi adaptör üzerinden oynatır. Durum JSON'a çevrilebilir (yeniden bağlanma testi). Masa başına `seed` + aksiyon günlüğü tutulur (görünmez, sadece hata ayıklama). |
| **A5** Kahve kabuğu UI | Claude Sonnet 5.5 | A0 (A2'nin `CATALOG`'unu okur; gelmeden sabit listeyle başlar) | `app/src/screens/KahveSalonu.tsx`, `OyunSecimi.tsx`, `Intro.tsx` metni, `App.tsx` gezinme kısmı (A4 ile sırayla, aynı anda değil), `app/src/i18n/tr.ts`, `en.ts` | Intro "Kahveye hoş geldin ☕". 2×2 ızgara, kartlar ≥56 dp, yazı ≥15 pt, renk + şekil işareti. "Yakında" rozetli kartlar tıklanmaz. Okey → bugünkü Lobby (101/Düz) aynen. "Son oynadığın: X, Devam" kısayolu (mevcut depolama yöntemiyle). Android geri tuşu her adımda bir geri. Yeni metinler sadece tr+en; diğer 11 dil İngilizceye düşer. `app typecheck` yeşil. |
| **A5b** i18n denetimi | Claude Haiku 5.5 | A5 | (sadece okur, rapor yazar) | tr/en anahtar eşitliği, eksik anahtar listesi, UTF-8 (`ğ` var, `?` bozulması yok). |
| **A6** Elle deneme | Fable + kullanıcı | A1–A5 | – | 101 ve Düz: çevrimdışı ve yerel sunucuyla (`EXPO_PUBLIC_SERVER_URL=http://<ip>:3001`) eskisi gibi. v1.0.1 build'i (mağazadaki) yerel v2 sunucuya bağlanıp oynuyor. |

**Paralel akış:** A0 bitti → **A1, A2, A3, A5 aynı anda** (dosyaları ayrık). A4, A1+A2 birleşince başlar; A5'in `App.tsx` dokunuşu A4'ten önce
birleşir, A4 onun üstüne kurar. Codex ve OpenCode kendi worktree'lerinde (`kahve-codex`, `kahve-oc`); Claude ajanları `feat/kahve`
üzerinde sırayla veya kendi alt dallarında. Antigravity Faz A'da **boşta** (ileriye dönük B hazırlığı onaylanırsa: sahte veriyle `CardView` taslağı).

**Entegrasyon:** her merge öncesi yerel etiket `kahve-pre-<GÖREV>`, `--no-ff`, kökte `pnpm test && pnpm typecheck`, gizli dosya taraması
(`rg -i "BEGIN PRIVATE|\.p8|api[_-]?key|revenuecat|ca-app-pub" --hidden`). Kırmızıysa merge geri alınır.

**A bitti:** testler yeşil, sayı ≥ 93 + yeni testler, "eski istemci 101 masası açar ve oynar" geçti, okey oyuncusu için tek fark "Okey Masaları" adımı.

## 4. Faz B: Kart motoru, Pişti, Batak (ana hat; ayrıntı A sonunda)
| Takım | İş |
|---|---|
| Codex | `@kahve/cards` → `@kahve/pisti` (mimariyi doğrular) → `@kahve/batak`; ayar nesneleri, Acemi/Orta/Usta bot, ≥%85 kapsam |
| Antigravity (Argon → Flash) | `CardView` SVG, `PistiScreen`, `BatakScreen`, ihale/koz diyalogları, <50 KB `.wav` sesler |
| Claude Opus | catalog + sunucu + useLocalGame bağlama, salon ve şifreli masa akışı |
| Claude Sonnet | `GameShell`, kart ekranlarına uygulama, ortak kalıcı reklam sayacı |
| OpenCode | 1000 seed sim (`tools/sim/`), `viewFor` sızıntı testleri, `docs/oyunlar/pisti.md`, `batak.md` |

**Önkoşul (kullanıcı kararı):** `react-native-svg` app'te **yok**. Expo'nun hazır modülü ama native modül sayılır → B'den önce sorulacak.

## 4b. Kural kaynağı (B ve C görev kâğıtları için)
- `docs/kahve/arastirma/KURALLAR_argon.md`: 11 oyunun kural şartnamesi, test senaryoları, ev kuralı ayarları (Argon, web kaynaklı).
- B/C görev kâğıtları (Pişti, Batak, Tavla) **girdi olarak** bunu kullanır: kural bölümü, `Opts` taslağı (Bölüm 2), test senaryoları (her oyunun §9'u).
- Kurala bağlayıcı olan `PROMPT_LOCAL.md`'dir; şartname onunla çelişirse PROMPT_LOCAL kazanır. "DOĞRULANMALI" işaretli ve Bölüm 3'teki
  bölgesel kurallar kullanıcıya sorulmadan varsayılan yapılmaz (Pişti #6, Batak #7–8, Tavla #10 B/C öncesi sorulacak).
- **Okey'e dokunmaz.** Şartnamenin okey "yanlış" listesi çoğunlukla `game.ts` yorumunda yazılı bilinçli ev kuralları. Aşağıdaki §4c soruları cevaplanmadan okey davranışı değişmez.

## 4c. Okey kural soruları: CEVAPLANDI (kullanıcı, 15.11.2026) → görev A7 (`tasks/A7-OPUS.md`, `tasks/A7-SONNET.md`)
**Kararlar:** 1 → okey sayısı × 101 (sayı değeri eklenmez) · 2 → aynen · 3 → aynen + açmamış oyuncuya onay diyaloğu · 4 → kendisi açmadan işleyemez (eşli mod gelince) ·
5 → ilk turda taş atana kadar · 6 → sayı sınırı kesinleştiriyorsa uçtaki okey alınır · 7 → +101, ayar, varsayılan 'opened' (Fable önerisi) ·
8 → ayar, varsayılan 5 el (Fable önerisi). **Yeni:** her canlı cezada herkese 5 sn bilgi paneli, panel süresince saat ve botlar durur.
Sadece `feat/kahve`; `feat/okey101-app`'e gitmez.

Asıl sorular:
| # | Konu | Bugün (kod) | Alternatif |
|---|---|---|---|
| 1 | 101: elde kalan gerçek okeyin cezası | okeyin sayısı + 101 | sadece 101 |
| 2 | 101: "elden" bitme | masada hiç kimse açmamış olmalı | biten kişi o tura kadar açmamışsa yeter (×2) |
| 3 | 101: yandan alınan taşla açamamak | alabilir, açamazsa +101 ceza | açamayacaksa yandan alamaz |
| 4 | Eşli 101: ortağın perine işlemek | (eşli mod yok) | kendisi açmadan işleyemez / işleyebilir |
| 5 | Düz: gösterge ne zaman | sadece taş çekmeden önce | ilk turda taş atmadan önce her an |
| 6 | Seri ucundaki okeyi almak (ör. Mavi 11-12-Okey) | uçtaki okey alınamaz (iki yöne okunabilir diye) | sayı sınırı yönü kesinleştiriyorsa (12 sonrası 13, 1 öncesi yok) alınır |
| 7 | 101: işlenebilecek taşı yere atma (işlek) cezası | ceza yok | +101 (ayar) |
| 8 | 101: maç sonu | hiç bitmez, oyuncular istediğinde kalkar | N el (5/7/11) veya ceza barajı (501/1001), ayar |
| – | Ayrıca not: çiftteki okey alınamaz (Faz 0 kararı); `viewFor` tüm ıskarta geçmişini gönderiyor (masada kronoloji için kullanılıyor; "hafıza yardımı" ayarı adayı) |

## 4d. Faz E önerisi: Kahve havası (C'den sonra, D'den önce) · ÖNERİ, İŞ BAŞLAMADI
Kaynak: `docs/kahve/arastirma/SOSYAL_HEDIYE_claude.md` (§4 zarar etmeyen lot defteri, §10 alt aşamalar, §10b Argon çapraz kontrolü), `KAHVE_HAVASI_argon.md`.
| Alt aşama | İçerik | Önerilen takım |
|---|---|---|
| E1 Hesap + profil fotoğrafı | Apple/Google girişi, kalıcı DB (Postgres, Pi'de değil), foto yükleme + 2 katmanlı yapay zekâ moderasyonu, yönetim kuyruğu, hesap silme | Opus (sunucu, güvenlik) · Antigravity (foto ekranı) · OpenCode (moderasyon test seti) |
| E2 Sohbet | Hazır mesaj + metin, sesli masa (LiveKit), şikâyet/engelleme | Opus (token servisi) · Antigravity (mikrofon arayüzü) · Sonnet (ayarlar) |
| E3 Hediyeler (ödemesiz) | Jeton satın alma, `@kahve/economy` lot defteri, hediye animasyonları, harcama tavanı | Codex (saf economy paketi + test) · Opus (webhook, defter) · Antigravity (arayüz) |
| E4 Para ödemesi | Onaylı hesap (KYC), IBAN, ay sonu ödeme listesi, iade geri alma | Sadece şirket/hukuk hazır ve ödeme şalteri açılınca · Opus + Fable |
Her alt aşama sonunda Fable durur, kullanıcı onaylar.

**Başlamadan önce kullanıcı kararları** (SOSYAL_HEDIYE §11):
1. Yeni native modüller (LiveKit WebRTC, `expo-image-picker`/`expo-image-manipulator`).
2. Ses sunucusu: kendi VPS mi, Agora / LiveKit Cloud mu?
3. Şirket + mali müşavir; hazır olana kadar hediyeler ödemesiz mi?
4. Alıcı payı (öneri: net gelirin %40'ı).
5. Ödeme kuruluşu (iyzico / Papara / PayTR / Param) ve KYC yöntemi.
6. Kişi başı aylık harcama tavanı.
7. **Kırmızı çizgi güncellemesi:** ORKESTRA §5.8 ve PROMPT_LOCAL "sadece sanal puan, para birimi veya satın alınabilir puan yok" diyor. Gerçek parayla jeton/hediye ve
   para ödemesi bu kuralın bilinçli olarak değişmesini gerektirir (oyun puanı yine paraya çevrilemez, hediye oyun sonucuna bağlanmaz). Kullanıcı açıkça onaylamadan E3/E4 planlanmaz.

## 4e. Faz B görevleri ve Pişti/Batak bölgesel kuralları (16.11.2026)
Görevler: `tasks/B1-CODEX.md` (cards → pisti → batak), `B4-AGY.md` (CardView + ekranlar), `B6-SONNET.md` (GameShell + reklam kapısı),
`B7-OC.md` (docs/oyunlar), `B8-CLINE.md` (1000 seed sim, kapsam, viewFor sızıntı testleri; Cline); B5 Opus entegrasyonu Pişti motoru birleşince yazılır.
**Kart görseli kararı:** `react-native-svg` eklenmedi; kartlar RN View/Text + Unicode takım simgeleriyle çizilir (yeni native modül yok).

**Bölgesel kurallar: AYAR olarak. Kullanıcı (16.11.2026): "genel kabul gören kurallarla yap şimdilik. Oyunu bitir önce sonra bakarız o sorulara."**
Aşağıdaki varsayılanlar UYGULANIR (genel kabul / KURALLAR_argon "Seçenek A"); Faz B sonunda kullanıcıya liste olarak gösterilir, soru sorulmaz:
| # | Kural | Önerilen varsayılan | Ayar seçenekleri |
|---|---|---|---|
| P1 | Pişti: açılıştaki 3 kapalı kart | Ortayı ilk toplayan alır; kartlar o an herkese açık gösterilir, toplayanın kart sayısına eklenir. İlk toplama (yerde 4 kart) pişti sayılmaz. | `hiddenCards: 'reveal' \| 'secret'` (secret: kimse görmez, el sonunda sayılır) |
| P2 | Pişti: açılışta en üstteki açık kart Vale çıkarsa | Vale destenin ortasına sokulur, yeni kart açılır (açılışta valeyle başlanmaz). | `openingJack: 'redraw' \| 'allow'` |
| K1 | Batak: renk yok, yerdeki kozu geçemiyorsa (alttan çakma) | Elinde koz varsa küçük de olsa koz atmak ZORUNLU (PROMPT_LOCAL "renk yoksa koz atmak zorunlu" ile uyumlu). | `mustTrumpWhenVoid: true \| false`, `mustOvertrump: true \| false` |
| K2 | Eşli Batak: ihaleyi alanın ortağı | Ortağın eli kapalı kalır, herkes kendi elini oynar (60+ için sade; ilk sürüm zaten tekli). | `partnerDummy: false \| true` |

## 5. Faz C: Tavla · Faz D: Yayına hazırlık
- C: Codex `@kahve/tavla` (hamle dizisi üretimi <50 ms, Usta 1 zar beklenen değer) · Antigravity `TavlaScreen` · Opus sunucu tarafı seed'li zar · OpenCode sim + `tavla.md`.
- D (her adım onayla): 15 dilde mağaza metni (kullanıcı kuralı: en-US birincil), UI çevirileri, "Demli Kahve" adı, ikon, 1.1.0,
  önce Pi sunucusu, canlıda v1 istemci kontrolü, en son `feat/okey101-app` merge.

## 6. Riskler ve açık sorular
1. **Çift açma canlıda yok.** `feat/okey101-app`'e ayrıca alınıp alınmayacağı kullanıcı kararı.
2. **Ev kuralı:** perde (çift) içindeki okey alınamaz (`okeySwap` çifte `null`). Kullanıcı farklı isterse tek satır.
3. **Metro + `@kahve/*`:** app henüz `@kahve/core`'u çalışma zamanında import etmiyor (sadece tip). A4/A5'te ilk gerçek import'ta
   `npx expo export` ile Android paketlemesi doğrulanır; Expo'nun monorepo otomatik ayarı yetmezse `metro.config.js` gerekir.
4. **Eski sunucu + yeni istemci:** 1.1.0 yayına çıkmadan Pi güncellenmeli (D sırası bunu sağlar); yine de istemci tarafı koruma A4'te.
5. **Ücretsiz OpenCode modelleri** öğleden sonra takılabiliyor: her işe zaman aşımı, yedek Claude Haiku.
6. **Fable modeli:** bu oturum `claude-fable-5-2` değil, Opus 5.5. Kullanıcı isterse planlama Fable oturumunda devralınır.
