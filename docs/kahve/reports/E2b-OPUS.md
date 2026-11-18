# E2b — Opus (sunucu) raporu: masa geçişi, sunucuda ses yasağı, hesap başına söz sınırı

Tarih: 19.11.2026. Commit ve push yapılmadı. Yeni npm paketi yok, `pnpm install` çalıştırılmadı, `app/`'e dokunulmadı (oradaki değişiklikler Sonnet'in).
Gerçek sır yok: testler sahte sırlarla imzalıyor. Bulut kaynağına dokunulmadı.

## Dosyalar
Yeni:
- `server/src/tablePass.ts`: `verifyTablePass(pass, secret, now)` (biçim, sabit zamanlı HMAC karşılaştırması, `v === 1`, `sub` küçük harf UUID,
  `vb`/`iat`/`exp` tam sayı, `exp` + 60 sn > şimdi, `iat` − 60 sn ≤ şimdi, en fazla 1024 karakter), `signTablePass` (testler için), `tablePassSecret` (≥ 32 karakter, değilse null).
- `packages/accounts/src/tablePass.ts`: `signTablePass`, `TABLE_PASS_CONTEXT`, `TABLE_PASS_TTL_MS`, `TABLE_PASS_MIN_SECRET`.
- `server/test/e2b-table-pass.test.ts`: 14 test (6 birim, 8 soket).
- `packages/accounts/test/tablePass.test.ts`: 13 test (1 + 4 × 3 depo).

Değişen:
- `shared/src/protocol.ts`: `HandshakeAuth.accountId` → `tablePass?`; `room:create` / `room:join` / `room:quickPlay` yükünde `accountId?` → `tablePass?`.
  Yeni: `TablePassResponse`, `TABLE_PASS_TTL_MS` (6 sa), `TABLE_PASS_TOLERANCE_MS` (60 sn), `VoiceTokenError` (= eski üç kod + `'banned'`).
  `SeatInfo.accountId` açıklaması güncellendi (alan aynı).
- `server/src/room.ts`: `Seat.voiceBannedUntil`, `SeatAccount`; `join(name, socketId, account: SeatAccount | null)`.
- `server/src/server.ts`: `ServerExtras.tablePassSecret` (yoksa `TABLE_PASS_SECRET` okunur, `null` = kapalı); çıplak `accountId` kodu silindi;
  `voice:token` içinde `banned`; söz sınırı anahtarı; kopunca `sayLimiter.sweep()`.
- `server/src/chat.ts`: `SayLimiter.sweep()` (son dakikada kaydı olmayan anahtarları siler), `size`.
- `packages/accounts/src/app.ts`: `AccountsAppOptions.tablePassSecret`, `GET /v1/me/table-pass`. `main.ts`: `TABLE_PASS_SECRET` okunuyor (yoksa uyarı). `index.ts`: dışa aktarım.
- `server/Dockerfile`: yorumdaki ortam değişkeni listesine `TABLE_PASS_SECRET`.
- Testler: `server/test/e2-chat-voice.test.ts` (sunucular sahte sırla açılıyor; `accountId` yerine imzalı geçiş gönderiliyor, beklentiler aynı),
  `server/test/compat-v2.test.ts` (E2 testi: kurulumda sır, yükte `tablePass`). `compat-v1.test.ts` hiç değişmedi.

## Davranış
### Geçiş biçimi
`pass = base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, "kahve-table-pass.v1." + payloadB64))`,
payload `{ v: 1, sub, vb, iat, exp }` (bu sırayla). **Bütün zamanlar epoch milisaniye** (`vb` zaten `Me.voiceBannedUntil` gibi ms). `exp = iat + 6 sa`.
İki taraftaki kod ayrı dosyada (hesap paketi `@okey/shared`'e bağlı değil, yeni bağımlılık `pnpm install` isterdi); iki test paketi de aynı
"golden vector" dizgisini sabitliyor, biri değişirse diğerinin testi kırılır.

### Hesap sunucusu: `GET /v1/me/table-pass`
| Durum | Yanıt |
|---|---|
| Bearer geçerli, sır ≥ 32 karakter | 200 `{ pass, expiresAt }` (`expiresAt` = `exp`, ms), `Cache-Control: no-store` |
| Sır yok ya da < 32 karakter | 503 `{ error: 'not_configured' }` |
| Token yok / geçersiz | 401 `unauthorized` |
`vb` = o anda süren ses yasağının bitişi, yoksa 0.

### Oyun sunucusu
- Geçiş: yükteki `tablePass` geçerliyse o, değilse `handshake.auth.tablePass`. v1 soketten hiç alınmaz. Sır yoksa hiçbir geçiş kabul edilmez.
- Geçersiz / süresi dolmuş / sahte / v≠1 geçiş oturmaya engel değil: koltuk açılır, `accountId` yok, yasak yok (misafir).
- Çıplak `accountId` (yükte ya da handshake'te) artık tamamen yok sayılıyor.
- Aynı hesap aynı masada ikinci koltuğa oturursa ikinci koltuğa `accountId` verilmez; ama geçişteki ses yasağı o koltukta da geçerli.
- Yeniden bağlanma (aynı adla kopuk koltuğa dönüş): koltuğun `accountId` ve yasağı yeni gönderilen geçişten yazılır (geçiş yoksa boşalır).
- `voice:token` sırası: `not_seated` → `voice_off` → `banned` (koltuğun `voiceBannedUntil` > şimdi) → `not_configured` → token.
- `table:say` sınırı: koltukta `accountId` varsa anahtar `a:<accountId>` (yeniden bağlanınca sıfırlanmaz), yoksa soket kimliği.
  Hesap anahtarları soket kopunca silinmez; her kopuşta son dakikada kaydı olmayanlar süpürülür (bellek büyümez).

## Sözleşmeden sapmalar (uygulama tarafı için, birebir)
1. Zaman birimi sözleşmede yazmıyordu: `iat`, `exp`, `vb` ve `expiresAt` **milisaniye**. (Sonnet'in `accountsClient.tablePass()` önbelleği `expiresAt`'ı
   `Date.now()` ile karşılaştırıyor; uyumlu.)
2. `shared` tiplerinden `accountId` (handshake ve üç yük) **kaldırıldı**, yerine `tablePass?: string`. Uygulama tipleri bununla temiz derleniyor.
3. `VoiceTokenResult` hata tipi artık ayrı ad: `VoiceTokenError = 'voice_off' | 'not_seated' | 'not_configured' | 'banned'`.
4. `banned`, `voice_off`'tan sonra gelir: sesi kapalı masada yasaklıya `voice_off` döner.
5. Ek dışa aktarımlar: `TablePassResponse`, `TABLE_PASS_TTL_MS`, `TABLE_PASS_TOLERANCE_MS` (`@okey/shared`). Uygulama geçişi çözmez, sadece taşır.
6. Yükte geçersiz bir geçiş + handshake'te geçerli bir geçiş varsa handshake'teki kullanılır (yük "kazanır" kuralı yalnız ikisi de geçerliyse).

## Testler (`npx vitest run`, paket paket)
| Paket | Önce | Sonra |
|---|---|---|
| `@okey/shared` | 104 | 104 |
| `@okey/server` | 95 | 109 (+14 E2b) |
| `@kahve/accounts` | 283 | 296 (+13) |
| `catalog` / `core` / `cards` / `batak` / `pisti` / `tavla` | 86 / 41 / 36 / 62 / 46 / 50 | aynı |

Kapsanan: geçerli geçiş → `accountId` (yük, handshake, quickPlay); başka sırla imzalı / kurcalanmış / süresi dolmuş / `v: 2` → koltuk var, `accountId` yok;
çıplak `accountId` yok sayılıyor; sırrı olmayan sunucu geçerli geçişi de yok sayıyor; yasaklı geçişle `voice:token` = `banned`, bitmiş yasakla token geliyor;
söz sınırı yeniden bağlanmada korunuyor (misafirde soket başına); aynı hesabın ikinci koltuğu; v1 soket `accountId` görmüyor; hesap ucu 200/401/503 ve `vb`.
v1 uyumluluk testleri (`compat-v1.test.ts`) değişmeden yeşil.
`tsc --noEmit`: `shared`, `server`, `packages/accounts` temiz; `app` (salt okunur kontrol, Sonnet'in değişiklikleriyle) temiz.

Not: tam sunucu paketinin bir koşusunda Vitest işçisi `e2-chat-voice.test.ts` sırasında Windows çıkış kodu 0xC0000409 ile düştü (test hatası değil, süreç çöktü).
Dosya tek başına 3 kez, tüm paket 3 kez daha yeşil geçti; paralel çalışan diğer ajanın yüküyle ilgili bir çevre sorunu olduğunu düşünüyorum.

## Dağıtım için
- İki sunucuya aynı `TABLE_PASS_SECRET` (≥ 32 karakter, ör. `openssl rand -base64 48`). Değer Fable/kullanıcıda; repoya yazılmadı.
- Sır yalnız bir tarafta olursa: hesap tarafı yoksa uygulama 503 alır ve misafir oturur; oyun tarafı yoksa geçişler yok sayılır. İkisi de sessizce misafire düşer.

## Açık riskler
- Yasak geçişin içinde: yasak geçiş alındıktan **sonra** başlarsa, uygulama yeni geçiş alana kadar (önbellek: bitişe 10 dk kalana dek, en fazla ~5 sa 50 dk)
  sunucu yasağı bilmez. Daha sıkı istenirse geçiş ömrü kısaltılır (ör. 30 dk) ya da yasak anında uygulama önbelleği silinir.
- Geçiş göndermeyen (değiştirilmiş) istemci misafir olarak hâlâ ses token'ı alabilir: yasak, geçişi gönderen resmî uygulamada işler.
  Kapatmak için sesli masada geçerli geçiş zorunlu yapılabilir (yeni hata kodu, uygulama değişikliği gerekir); sözleşmede yok, yapılmadı.
- Geçiş 6 saat boyunca yeniden kullanılabilir ve iptal edilemez (hesap silinse de). Çalınması için hesap token'ı ya da cihaz gerekir; etkisi sadece kimlik göstermek.
- Sır döndürme (rotation) yok: değişince eski geçişler hemen geçersiz olur, oyuncular bir sonraki geçişe kadar misafir görünür.
- E2'den kalanlar aynen: LiveKit odasından sunucu çıkarmıyor (2 sa token), Cloud Run'da tek kopya + oturum yakınlığı gerekli.
