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
