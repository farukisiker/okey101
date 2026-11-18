# E2 — Opus (sunucu) raporu: hazır sözler, sesli masa, şikâyet ve engelleme

Tarih: 19.11.2026. Commit ve push yapılmadı. Yeni npm paketi eklenmedi, `pnpm install` çalıştırılmadı, `pnpm-lock.yaml` ve `app/`'e dokunulmadı
(o dosyalardaki değişiklikler Sonnet'in). Gerçek anahtar yok; testler sahte anahtarla imzalayıp JWT'yi kendileri doğruluyor. Bulut kaynağına dokunulmadı.

## Dosyalar
Yeni:
- `server/src/voice.ts`: `liveKitToken` (HS256 JWT, `node:crypto`), `liveKitConfigFromEnv` (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`), `VOICE_TOKEN_TTL_SEC` = 7200.
- `server/src/chat.ts`: `SayLimiter` (2 sn'de 1, kayan dakikada 15; reddedilen deneme sayılmaz).
- `server/test/e2-chat-voice.test.ts`: 11 test.
- `server/Dockerfile` + `server/cloudbuild.yaml`: Cloud Run test imajı (bağlam = repo kökü).
- `packages/accounts/test/reports.test.ts`: 35 test (3 depo × sözleşme, HTTP uçları, şema geçişi).

Değişen:
- `shared/src/protocol.ts`: `QUICK_SAYINGS`, `QuickSaying`, `QUICK_EMOJI`, `QuickEmoji`, `isQuickSaying`, `isQuickEmoji`, `TableSay`, `TableSaid`, `TableSayError`,
  `SAY_MIN_GAP_MS`, `SAY_PER_MINUTE`, `VoiceTokenResult`. `RoomInfo.voice?`, `SeatInfo.accountId?`, `HandshakeAuth.accountId?`.
  `room:create` → `voice?`, `accountId?`; `room:join` ve `room:quickPlay` → `accountId?`. `KahveClientToServerEvents`'e `table:say` ve `voice:token`,
  `KahveServerToClientEvents`'e `table:said` eklendi. v1 arayüzleri (`ClientToServerEvents` / `ServerToClientEvents`) yalnızca isteğe bağlı alan aldı.
- `server/src/room.ts`: `RoomOptions.voice`, `Room.voice`, `Seat.accountId`; `join(name, socketId, accountId)`; `info()` içinde `voice` ve insan koltuklarında `accountId`.
- `server/src/server.ts`: `table:say`, `voice:token`, `accountId` alma, `voice` varsayılanı, `v1Info` artık `voice` ve koltuk `accountId`'sini de siliyor.
  `createOkeyServer`'a 3. isteğe bağlı parametre: `extras: { livekit?, sayMinGapMs?, sayPerMinute? }` (eski çağrılar aynen çalışıyor).
- `server/test/compat-v1.test.ts`: +1 test (karışık masada v1 soket `table:said` almıyor, RoomInfo'sunda `voice`/`accountId` yok).
- `server/test/compat-v2.test.ts`: +1 test (v2 RoomInfo'da `voice` ve `accountId`). Ayrıca bu dosya ile `cards-e2e`, `notice-wire`, `server-generic`,
  `tavla-e2e` testlerindeki `waitFor` yardımcısında tek satırlık tip dönüşümü: v1/v2 olay haritaları artık farklı (`table:said`), birleşik soket tipinde
  `on/off` çağrılamıyordu (yalnız `tsc` hatası, çalışma davranışı aynı).
- `packages/accounts/src/types.ts`: `Me.voiceBannedUntil`, `ReportReason`, `ReportContext`, `ReportStatus`, `AdminReportItem`, hata kodu `limit_reached`.
- `packages/accounts/src/store.ts`, `memoryStore.ts`, `sqliteStore.ts`: `addReport`, `countReportsBy`, `listReports`, `closeReports`, `getVoiceBan`,
  `setVoiceBan`, `listBlocks`, `addBlock`, `removeBlock`; `deleteAccount` genişledi.
- `packages/accounts/src/schema.sql`: `reports`, `voice_bans`, `blocks` tabloları (`IF NOT EXISTS`, E1 veritabanı açılışta alıyor; testi var).
- `packages/accounts/src/app.ts`: yeni uçlar, `summarizeReports`, sabitler; `admin.ts`: "Şikâyetler" sekmesi; `index.ts`: dışa aktarımlar.
- `packages/accounts/test/app.test.ts`: tek satır, "fresh Me" beklentisine `voiceBannedUntil: null` (sözleşme gereği).

## Davranış
### table:say / table:said (sadece v2)
- Yük: `saying` veya `emoji`'den tam olarak biri, listedeki değerlerden. Serbest metin, ikisi birden, hiçbiri, bilinmeyen değer → `{ ok:false, error:'invalid' }`.
- Masada oturmayan, ya da v1 soket → `not_seated`. Yükte masa kimliği yok: soket sadece oturduğu masada konuşabilir (yabancı masaya söz gönderilemez).
- Oran: soket başına 2 sn'de 1 ve kayan dakikada 15 → `rate_limited`.
- Yayın: o masadaki **v2** soketlerin hepsine (gönderen dahil) `{ seat, saying | emoji, at }`. v1 soketler hiç almaz.
- Engel filtresi istemcide (sunucu engel listesini bilmiyor).

### Sesli masa
- `room:create` `voice: boolean` gönderirse o geçerli. Göndermezse: şifreli masa **açık**, listelenen şifresiz açık masa **kapalı**,
  listelenmeyen (sadece kodla girilen) masa **açık** (arkadaş masası sayıldı). `room:quickPlay` masası kapalı.
  v1 kurucunun masası her zaman kapalı (kurucu seçmedi).
- `RoomInfo.voice` her v2 RoomInfo'da var (boolean); v1'e gitmez.

### voice:token
- Sıra: masada oturan insan değil (veya v1) → `not_seated`; masa `voice` değil → `voice_off`; LiveKit ortam değişkenleri eksik → `not_configured`.
- Başarılı: `{ ok:true, url: LIVEKIT_URL, token, room: <masaId>, identity: 's<seat>-<12 hex>' }`.
- Token: HS256, `iss` = API key, `sub` = identity, `name` = oyuncu adı, `nbf` = `iat` = şimdi, `exp` = şimdi + 7200,
  `video: { room, roomJoin:true, canPublish:true, canSubscribe:true, canPublishData:false, canPublishSources:['microphone'] }`.
- Identity'nin rastgele kısmı soket başına sabit: aynı soket tekrar token isterse aynı identity gelir, LiveKit eski katılımcıyı düşürür (çift görünmez).

### accountId
- `room:create` / `room:join` / `room:quickPlay` yükündeki `accountId`, yoksa `handshake.auth.accountId`. UUID biçimi değilse yok sayılır, küçük harfe çevrilir.
  v1 soketten hiç alınmaz. Doğrulanmamıştır (oyun sunucusu hesap sunucusuna sormuyor), sadece şikâyet/engel hedefi.
- RoomInfo'da yalnız insan koltuklarında ve değer varsa; botlarda yok; v1'e gitmez. Kopan oyuncu aynı adla geri gelince yeni gönderdiği değer yazılır.

### Hesap sunucusu
| Uç | Sonuç |
|---|---|
| `POST /v1/reports` | 204. Hatalı gövde / kendini şikâyet 400 `bad_request`; hedef hesap yok 404 `not_found`; son 24 saatte 20 şikâyet yazmışsa 429 `rate_limited` |
| `GET /v1/blocks` | `{ blocked: string[] }` (engellenme sırasıyla) |
| `PUT /v1/blocks/:accountId` | 204 (zaten varsa da 204). Geçersiz kimlik / kendisi 400; 500 dolu ise 409 `limit_reached` |
| `DELETE /v1/blocks/:accountId` | 204 (yoksa da 204); geçersiz kimlik 400 |
| `GET /admin/v1/reports?status=open\|closed` | admin; son 7 günün şikâyetleri hedef başına: `count`, `reporters`, `reasons`, `contexts`, `lastAt`, `displayName`, `voiceBannedUntil` |
| `POST /admin/v1/reports/:accountId/close` | admin; hedefin açık şikâyetlerini kapatır ve ses yasağını kaldırır: `{ accountId, closed }` |

- Ses yasağı: 7 gün içinde **3 farklı kişiden açık** şikâyet → `voiceBannedUntil = şimdi + 24 sa`. Sadece **yeni** bir şikâyetçi yasağı başlatır ya da uzatır;
  aynı kişinin tekrar şikâyeti değiştirmez. `Me.voiceBannedUntil` süresi geçince `null`.
- `/admin?tab=reports` sayfası: hedef listesi ve "Kapat (yasağı kaldır)" düğmesi. Foto sekmesindeki güvenlik modeli aynı (token sadece sessionStorage'da,
  her kullanıcı metni kaçışlı, CSP nonce).
- Hesap silinince: yazdığı ve hakkındaki şikâyetler, ses yasağı, kendi engel listesi ve başkalarının listesindeki kaydı silinir.

## Sözleşmeden sapmalar ve küçük eklemeler (uygulama tarafı için)
1. `table:say` hata dizgileri: `'not_seated' | 'invalid' | 'rate_limited'` (`TableSayError`). Sözleşmede yalnız `Ack` yazıyordu; tip ondan dar, uyumlu.
2. Token'a `canPublishSources: ['microphone']` eklendi: değiştirilmiş bir istemci masada kamera/ekran yayınlayamaz. Uygulama mikrofonu
   `setMicrophoneEnabled` ile açtığı sürece etkisi yok. Başka kaynakla (ör. `Track.Source.Unknown`) yayın yaparsa LiveKit reddeder.
3. Sesli masa varsayılanı, sözleşmede tanımlı olmayan iki durum için: kodla girilen listelenmemiş masa açık, hızlı oyun kapalı.
   Lobideki "Sesli masa" anahtarı her durumda `voice`'u açıkça göndermeli; o zaman varsayılan önemsiz.
4. `accountId` hem yükte hem `handshake.auth`'ta kabul ediliyor (yük kazanır).
5. Hesap sunucusu: blok listesi doluysa 409 `limit_reached` (yeni hata kodu); hedefi olmayan şikâyet 404; "günde 20" kayan 24 saat olarak uygulandı.
   Engelleme hedefin var olmasını istemiyor (biçimi doğru her kimlik).
6. Ek admin ucu `POST /admin/v1/reports/:accountId/close` (status=open'ın bir anlamı olsun diye).

## Testler (paket paket, `corepack pnpm --filter <paket> test`)
| Paket | Önce | Sonra |
|---|---|---|
| `@okey/shared` | 104 | 104 |
| `@okey/server` | 82 | 95 (+11 E2, +1 compat-v1, +1 compat-v2) |
| `@kahve/accounts` | 248 | 283 (+35) |
| `@kahve/catalog` | 86 | 86 |
| `@kahve/core` / `cards` / `batak` / `pisti` / `tavla` | 41 / 36 / 62 / 46 / 50 | aynı |

`tsc --noEmit`: `shared`, `server`, `packages/accounts` temiz. `app` de (salt okunur kontrol) yeni protokol tipleriyle temiz derleniyor.

## Dockerfile
- `node:24-slim`, sadece `express@5.3.0`, `socket.io@4.8.4`, `tsx@4.23.15` npm ile kuruluyor (kilit dosyasındaki sürümler). Çalışma alanı paketleri
  (`@kahve/core`, `cards`, `batak`, `pisti`, `tavla`, `catalog`, `@okey/shared`) `node_modules/@…/` altına kaynak olarak kopyalanıyor, tsx çalıştırıyor.
- Docker bu PC'de yok. Aynı klasör düzeni geçici dizinde kurulup sunucu tsx ile açıldı: `/health` yanıt verdi; v2 soketle pişti masası,
  `voice:token` (sahte ortam değişkenleriyle) ve `table:say` çalıştı. Gerçek imaj derlemesi denenmedi.
- Derleme (repo kökünden): `gcloud builds submit --config server/cloudbuild.yaml --substitutions _IMAGE=<…>/kahve-server .`
  `.gcloudignore` yok → `.gitignore` geçerli (node_modules yüklenmez). Dağıtım Fable'da.

## Açık riskler
- Ses yasağı E2'de sadece bilgi: oyun sunucusu hesabı doğrulamadığı için token vermeyi engellemiyor (sözleşme gereği, E2b).
- `accountId` sahte gönderilebilir: biri başkasının kimliğini taşıyıp şikâyetleri ona yönlendirebilir. Ban için 3 farklı gerçek hesap gerekiyor,
  ama misafir hesap açmak ucuz (IP başına saatte 10). E2b'de oyun sunucusu hesap token'ını doğrulamalı.
- Söz oran sınırı soket başına: yeniden bağlanan istemci sayaçtan kurtulur (yeniden bağlanma maliyetli, kabul edildi).
- LiveKit odasından çıkarma sunucuda yok: masadan kalkan, elindeki token'la (2 saat) odada kalabilir. Gerekirse E2b'de LiveKit RoomService ile `removeParticipant`.
- Cloud Run: socket.io durumu süreç içinde; en fazla 1 kopya ve oturum yakınlığı (session affinity) gerekli. Masalar kopya kapanınca kaybolur.
- Oda adı = masa kimliği (5 harf). Aynı LiveKit projesi başka ortamla paylaşılırsa çakışabilir. Test için ayrı proje önerilir.
