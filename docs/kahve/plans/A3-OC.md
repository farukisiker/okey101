DURUM: ONAYLANDI 2026-11-15 (Fable)
FABLE NOTLARI:
- Tam el testi İKİ modda da: `'duz'` ve `'101'` (eski istemcilerin asıl oyunu 101). Her biri ≤30 sn zaman aşımı; el, deste bitince de biter.
- Fikstür şeması: `{ "source": "c19eea2:app/src/net/useOkey.ts", "steps": [{ "event", "payload"?, "expectAck"? }] }`.
- İstemci soketini v2 testlerde `KahveServerToClientEvents`/`KahveClientToServerEvents` ile tipleyin; v1 testlerde mevcut `ServerToClientEvents`/`ClientToServerEvents`.
- `it.fails` testlerinde her bekleme 2 sn ile `Promise.race`; askıda kalan dinleyiciler `afterEach`'te kapatılsın (soket `close()`).

# A3-OC Lider Planı — Uyumluluk Fikstürleri (Faz A)

**Worktree:** `C:/Users/mfaru/okey101/kahve-oc` (dal `feat/kahve-oc`) · **Sözleşme:** `shared/src/protocol.ts` @ `2d1c37b` (değiştirilmez)

## 1) Anladığım kapsam

1. **Amaç test yazmak, kod değil.** Mağazadaki v1.0.1 istemcisinin bugünkü sunucuyla konuşmasını sabitleyen testler **önce** yazılır; A4 bunları yeşil tutmak zorunda. Sahip olunan yollar yalnızca `server/test/compat-v1.test.ts`, `server/test/compat-v2.test.ts`, `server/test/fixtures/v1/**`.
2. **compat-v1.test.ts bugünkü sunucuda YEŞİL:** `auth` göndermeyen soket; `room:quickPlay {name}` (mode yok → 101) ve `{name, mode:'duz'}`; `game:view` yükü çıplak `PlayerView` (`game`/`view` sarmalı yok); `room:create {name, isPublic:true}` + ikinci soket `room:join` + `room:start` (RoomInfo'da `mode` var); bir elin sonuna kadar oynama (insan her turda çek+at) ve el bitince `room:nextRound` kabulü; `salon:watch(true)` (ikinci argüman yok) → `salon:list` sadece okey masaları, her `TableSummary`'de `mode`. Sunucu `createOkeyServer({ botDelayMs: 1, turnTimeoutMs: 0 })`, her test ≤ 20 sn.
3. **compat-v2.test.ts bugün KIRMIZI:** her senaryo `it.fails` ile ve ≤ 2 sn zaman aşımı — `auth:{v:2}` + `room:quickPlay {name, game:'okey101'}` → `game:view` yükü `{game:'okey101', view}` zarfı; v1 soket + `room:create {name, game:'pisti'}` → `{ok:false, error: ERR_UPDATE_APP}`; v2 soket `salon:watch(true, {games:['okey101','pisti']})` → TableSummary'lerde `game` dolu; okey masasında `RoomInfo.game` = `'okey101'` / `'okeyDuz'`.
4. **Fikstür:** v1.0.1 `useOkey`'den (`git show c19eea2:app/src/net/useOkey.ts`) çıkarılan mesaj dizisi `fixtures/v1/messages.json` olarak kaydedilir ve bir testte o sırayla sunucuya gönderilir.
5. **Kabul:** `corepack pnpm --filter @okey/server test` yeşil (`it.fails`'ler geçmiş sayılır), kökte `pnpm test` + `pnpm typecheck` yeşil, toplam test sayısı ≥ 93 + yeniler; bitişte `feat/kahve-oc`'da commit + `docs/kahve/reports/A3-OC.md` (test çıktısı son satırları yapıştırılmış). **Push yok.**

### Kapsam dışı
- `server/src/**`, `shared/**`, `app/**`, mevcut test dosyaları, `package.json`, lockfile — hiçbirine dokunulmaz (v2 davranışı A4'ün işi; bugünkü sunucu bilinçli olduğu gibi kalır).
- Yeni bağımlılık yok (yalnızca mevcut `vitest`, `socket.io-client`, `@okey/shared` tipleri).
- Push, merge, `it.todo`'ya çevirme (kullanım yerine kırmızı ancak geçen `it.fails`), A4/A5 konuları.

## 2) Alt görevler

| # | Alt görev | İşçi model | Dosyalar | Test komutu |
|---|---|---|---|---|
| SG1 | v1 fikstürü: `useOkey` (c19eea2) bağlantı + emit dizisinin çıkarılması, `messages.json` olarak yazılması (auth yok, `salon:watch(true)`, `room:quickPlay {name,mode}`, `room:create {name,mode,isPublic,password}`, `room:join {roomId,name,password}`, `room:start`, `room:nextRound`, `game:action`, `room:leave`) | opencode/deepseek-v4.1-flash-free | `server/test/fixtures/v1/messages.json` | `corepack pnpm --filter @okey/server test compat-v1` |
| SG2 | compat-v1 ilk yarısı: authsız soket; `quickPlay {name}` → 101 el dagılımı (hand 22, players [22,21,21,21]); `quickPlay {name,mode:'duz'}` → düz (hand 15); `game:view` yükünün çıplak PlayerView olduğunu zorunlu tutan (`expect` çekirdek alanlara + `view`/`game` sarmalı bulunmaz) kontrol; `create {isPublic:true}` + join + start → RoomInfo `mode` | opencode/deepseek-v4.1-flash-free | `server/test/compat-v1.test.ts` | `corepack pnpm --filter @okey/server test compat-v1` |
| SG3 | compat-v1 ikinci yarısı: insan koltuğunun her turunda `game:action` (çek + at) ile el sonuna kadar oynama, `phase:'finished'` sonrası `room:nextRound` → `{ok:true}`; `salon:watch(true)` filtresiz → liste sadece okey masaları ve her satırda `mode` | opencode/deepseek-v4.1-flash-free | `server/test/compat-v1.test.ts` | `corepack pnpm --filter @okey/server test compat-v1` |
| SG4 | fixtures replay testi: `messages.json` sırasıyla soketten olay olay gönderim, her adımda beklenen ack; test adı "v1.0.1 client message sequence" | opencode/deepseek-v4.1-flash-free | `server/test/compat-v1.test.ts` | `corepack pnpm --filter @okey/server test compat-v1` |
| SG5 | compat-v2 (hepsi `it.fails`, test başına ≤ 2 sn): `auth:{v:2}` + `quickPlay {name, game:'okey101'}` → zarf yükü; v1 soket + `create {name, game:'pisti'}` → `ERR_UPDATE_APP` (sabit `@okey/shared`'den import); `salon:watch(true, {games:['okey101','pisti']})` → `game` dolu; okey masasında `RoomInfo.game` = `'okey101'`/`'okeyDuz'` | opencode/deepseek-v4.1-flash-free | `server/test/compat-v2.test.ts` | `corepack pnpm --filter @okey/server test compat-v2` |
| SG6 | Tüm doğrulama + rapor: server paketi, kök test + typecheck, test sayısı sayımı (≥ 93 + yeni), `docs/kahve/reports/A3-OC.md` | opencode/deepseek-v4.1-flash-free (review: lider) | `docs/kahve/reports/A3-OC.md` | `corepack pnpm --filter @okey/server test` ve kökte `corepack pnpm test` + `corepack pnpm typecheck` |

## 3) Kullanılan arayüzler (olaylar ve yükler)

**İstemci → sunucu (emit):**
- **bağlantı (handshake):** v1 testlerde `io(url, {transports:['websocket'], forceNew:true})` — `auth` gönderilmez; v2 testlerde `io(url, { auth: { v: 2 } })`.
- **`room:quickPlay`** — v1: `{ name: 'Ali' }` (mode yok → 101) ve `{ name: 'Ali', mode: 'duz' }`; v2: `{ name: 'Ali', game: 'okey101' }`. Ack: `{ ok: true, roomId, seat }` | `{ ok: false, error }`.
- **`room:create`** — v1: `{ name, isPublic: true }`; v2-çelişki: `{ name, game: 'pisti' }`. Ack: `{ ok: true, roomId, seat }` | `{ ok: false, error: ERR_UPDATE_APP }`.
- **`room:join`** — `{ roomId, name }` (fikstürde password'lu varyant da var: `{ roomId, name, password? }`). Ack: `{ ok: true, roomId, seat }` | `{ ok: false, error }`.
- **`room:start`** — yük yok. Ack: `{ ok: true }` | `{ ok: false, error }`.
- **`room:nextRound`** — yük yok; el `finished` olduktan sonra `{ ok: true }` beklenir.
- **`game:action`** — okey Action: `{ type: 'draw', source: 'deck' }` ve `{ type: 'discard', tileId }` (sabit tur döngüsü: beklenen hata `/çektiniz/`, sonra discard). Ack: `{ ok: true }` | `{ ok: false, error }`.
- **`salon:watch`** — v1: `true` (ikinci argüman yok); v2: `true, { games: ['okey101', 'pisti'] }`.
- **`room:leave`** — yük yok, ack yok (fikstür kapanışında).

**Sunucu → istemci (dinlenen):**
- **`game:view`** — v1 testlerde çıplak `PlayerView`: `hand` (Tile[], 22 veya 15), `players[].handCount`, `turn`, `turnPhase` (`'draw'`), `mode`, `lastAction` (`{ seat: 3, type: 'discard' }`); üst seviyede `game`/`view` alanlarının **olmadığı** `expect` ile sabitlenir. v2 testte zarf beklenir: `{ game: 'okey101', view: PlayerView }`.
- **`room:state`** — `RoomInfo`: `id`, `mode` (`'101'`/`'duz'`), `seats: (SeatInfo|null)[]` (`isBot` dizisi), `hostSeat`, `started`, `round`, `totals`; v2 testte `game` alanı.
- **`salon:list`** — `TableSummary[]`: `id`, `mode`, `seats: (string|null)[]`, `free`, `started`, `locked`; v2 testte `game` alanının dolu olduğu.

**Dosya arayüzü:** `fixtures/v1/messages.json` — sıralı adım listesi (her adım: `event` + `payload`; örn. `salon:watch true`, `room:quickPlay {name:'Ali', mode:'101'}`, …), replay testi bu diziyi yürütür.

## 4) Riskler ve açık sorular

- **"Bir eli bitirmek" süresi (SG3):** 101 modunda el, 101 sayıya inmeden bitebilir ama bot sıraları ve insanın her tur çek+atması zinciri testi uzatabilir; `botDelayMs: 1` ile 20 sn garantisi simüle edilmeden önce mikro-bench yapılmadan tam el testinin hangi modda (101 mi, hızlı biten `'duz'` mı) koşacağı **açık soru** — görev metni modu şart koşmuyor; varsayılan plan: gövde `'duz'` (15 taş, kısa), quickPlay-101 ayrı zaten SG2'de. **Fable onayı isterim.**
- **`it.fails` + socket.io asenkronizasyonu:** `it.fails` gövdenin reddetmesini bekler; v2 senaryolarda bugünkü sunucu ya beklenen alanı hiç göndermez (assertion reddi → geçer) ya da ack beklerken promise askıda kalabilir → her v2 testine 2 sn sarmalayıcı (`Promise.race`/`vitest test timeout: 2000`) şart. Aksi halde test askıda kalıp genel timeout'a düşer.
- **Sıkı tipler:** `ClientToServerEvents` bugün `game?: GameId`'i içeriyor (sözleşme donduruldu), ama `salon:watch` imzası filter'lı; istemci tarafı `Socket<KahveServerToClientEvents, KahveClientToServerEvents>` ile tiplenir ki `auth:{v:2}` ve zarf tipi tipcheck'ten geçsin. Tip seviyesinde çelişki çıkarsa `as` yerine payload literal ile çözülür; `server/src`'e ve `shared`'e dokunmak yasak.
- **`ERR_UPDATE_APP` metni:** sabit `@okey/shared`'den import edilir; dizgi kopyalanmaz (görev sabit demeyip `ERR_UPDATE_APP` diyor).
- **Ücretsiz model riski:** deepseek-v4.1-flash-free takılırsa yedek Claude Haiku 5.5 (master plan §3'te yazılı); her alt göreve zaman aşımı.
- **Test sayısı ve `it.fails`:** kabul "test sayısı ≥ 93 + yeniler" — `it.fails`'ler de sayıma girer; SG6'da `--reporter=dot`/özet satırı rapora yapıştırılır.
- **Açık soru (Fable):** fixtures `messages.json` şeması serbest mi, yoksa ORKESTRA'da ortak bir fikstür şeması (adım/adım JSON) bekliyor musun? Varsayılan: `{ steps: [{ event, payload? }] }`.

## 5) Tahmini commit listesi

1. `test(server): v1 uyumluluk fikstürü — useOkey(c19eea2) mesaj dizisi fixtures/v1/messages.json` *(SG1; fixtures + replay testi ilk hali)*
2. `test(server): compat-v1 — authsız soket, quickPlay mode yok/'duz', çıplak PlayerView, create+join+start, tam el + nextRound, filtresiz salon` *(SG2–SG4, bugünkü sunucuda yeşil)*
3. `test(server): compat-v2 — it.fails kırmızı senaryolar (zarf, ERR_UPDATE_APP, salon filtresi, RoomInfo.game)` *(SG5, ≤ 2 sn)*
4. `docs(kahve): A3-OC raporu — test çıktısı ve kabul doğrulaması` *(SG6; kök test + typecheck kanıtı raporda)*
