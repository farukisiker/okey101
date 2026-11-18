# E1b — Opus (sunucu) raporu: Apple / Google ile giriş

Tarih: 18.11.2026. Commit ve push yapılmadı. Yalnızca `packages/accounts/` değişti ve bu rapor yazıldı. Yeni npm paketi eklenmedi; `pnpm install` çalıştırılmadı, lockfile'a dokunulmadı.

## Dosyalar
Yeni:
- `src/jwt.ts`: `node:crypto` ile RS256 kimlik token'ı doğrulama ve `JwksCache`.
- `src/secretBox.ts`: AES-256-GCM. Anahtar, `ACCOUNTS_SECRET`'tan HKDF-SHA256 ile türetiliyor. Biçim: `v1.` + base64url(iv | tag | şifreli metin). AAD olarak `apple:<sub>` kullanılıyor, böylece şifreli değer başka bir satıra taşınamıyor.
- `src/apple.ts`: ES256 `client_secret` (`dsaEncoding: 'ieee-p1363'`), `/auth/token` ile kod değişimi, `/auth/revoke`.
- `src/auth.ts`: `AuthService` (doğrulayıcılar, Apple istemcisi, şifreleme) ve `parseList`.
- `test/idp.ts`: sahte Apple/Google. RSA anahtarları test içinde üretiliyor, fetch enjekte ediliyor, ağ yok.
- `test/jwt.test.ts`, `test/secrets.test.ts`, `test/auth.test.ts`.

Değişen:
- `src/types.ts`: `Provider`, `PROVIDERS`, `AuthResult` eklendi; `Me.providers` eklendi. Yeni hata kodları: `invalid_token`, `already_linked`, `not_configured`, `unavailable`.
- `src/store.ts`: yeni metotlar `addSession`, `accountByProvider`, `linkProvider` (`'ok' | 'sub_taken' | 'provider_taken'` döner), `listProviderLinks`, `setAppleRefresh`. `deleteAccount` artık bağlantıları da siliyor.
- `src/memoryStore.ts`, `src/sqliteStore.ts`: bu metotların iki uygulaması.
- `src/schema.sql`: `account_providers` tablosu eklendi: `(provider, sub, account_id, created_at, apple_refresh_enc)`, PK(provider, sub), UNIQUE(account_id, provider). `CREATE TABLE IF NOT EXISTS` ile eklendi; E1a DB dosyası açılışta tabloyu kendiliğinden alıyor (testi var).
- `src/app.ts`: `POST /v1/auth/apple` ve `POST /v1/auth/google` eklendi, `Me.providers` dolduruluyor, hesap silinince Apple iptali yapılıyor. Yeni seçenek: `auth?: AuthOptions`.
- `src/main.ts`: yeni ortam değişkenleri okunuyor. `src/index.ts`: yeni dışa aktarımlar.
- `test/app.test.ts`: tek satır değişti. "fresh Me" beklentisine `providers: []` eklendi (sözleşme gereği).
- `test/store.test.ts`: sağlayıcı sözleşme testleri (MemoryStore, SqliteStore bellek ve dosya) ve E1a DB dosyası geçiş testi eklendi.

## Davranış (sözleşme)
- Sağlayıcının audience listesi boşsa: 503 `not_configured`. Bu kontrol ağa hiç çıkmadan yapılıyor.
- Gövde hatalıysa 400 `bad_request`:
  - Apple için `identityToken`, Google için `idToken` zorunlu.
  - `authorizationCode` 512 karakteri geçemez ve güvenli karakter kümesinde olmalı.
  - `fullName` metin olmalı.
- Bearer isteğe bağlı. Gönderilmişse geçerli olmak zorunda; değilse 401 `unauthorized` döner, sessizce yeni hesap açılmaz.
- Token geçersizse 401 `invalid_token`. Hiç anahtar yoksa ve JWKS'e ulaşılamıyorsa 503 `unavailable` döner. **Sonnet'e not:** bu, sözleşmeye eklenen dördüncü yeni kod; istemci bunu genel hata gibi gösterebilir.
- `sub` hiçbir hesaba bağlı değilse:
  - Bearer varsa o hesaba bağlanır. Yanıt: `switched:false`, aynı token geri döner.
  - Hesapta aynı sağlayıcıdan başka bir kimlik zaten bağlıysa: 409 `already_linked`.
  - Bearer yoksa yeni hesap açılır. Bu yol misafir hesapla aynı IP limitini kullanır (saatte 10).
- `sub` başka bir hesaba bağlıysa: o hesap için yeni bir oturum token'ı verilir (`switched:true`). Misafir hesap silinmez, birleştirilmez. Eski cihazdaki oturum da çalışmaya devam eder.
- Aynı hesap kendi Bearer'ıyla tekrar girerse: `switched:false`, aynı token.
- Yarış durumu: aynı kimlikle eşzamanlı iki ilk giriş olursa, kaybeden taraf açtığı boş hesabı siler ve kazanan hesaba geçer.
- `fullName` yalnızca hesabın adı boşsa ve geçerliyse (2–16 karakter, E1a kuralı) ad olarak yazılır.
- Yanıtlarda `Cache-Control: no-store` var.

## Güvenlik
- alg tam olarak `RS256` olmalı. `none`, `HS256` (anahtar karışıklığı saldırısı), `ES256` ve küçük harfli `rs256` reddediliyor. alg kontrolü anahtar aramasından önce yapılıyor. `crit` başlığı varsa token reddediliyor. `kid` zorunlu.
- Talepler (claims):
  - `iss`: Apple için `https://appleid.apple.com`; Google için `accounts.google.com` veya `https://accounts.google.com`.
  - `aud` izinli listede olmalı (dizi biçimindeki aud de destekleniyor).
  - `exp` ve `iat` için 60 sn tolerans var; `iat` 24 saatten eski olamaz; `nbf` de kontrol ediliyor.
  - `sub` boş olmayan bir metin olmalı (en fazla 255 karakter).
  - Google'da `email_verified` istenmiyor. E-posta saklanmıyor; saklanan yalnızca sağlayıcı + `sub`.
- JWKS:
  - Önbellek süresi `Cache-Control: max-age`'e göre, 1 ile 24 saat arasına sıkıştırılıyor.
  - Bilinmeyen `kid` gelince JWKS bir kez yeniden çekiliyor; en fazla dakikada bir.
  - Eşzamanlı istekler tek bir çekimi paylaşıyor.
  - Yenileme başarısız olursa önceki anahtarlarla devam ediliyor.
  - 2048 bitten kısa RSA anahtarları, RSA olmayan anahtarlar ve `use:'enc'` anahtarları yok sayılıyor.
- Apple refresh token:
  - Saklama koşulları: `authorizationCode` gelmeli, Apple anahtarı yapılandırılmış olmalı ve `ACCOUNTS_SECRET` en az 32 karakter olmalı.
  - Akış: kod arka planda değiştiriliyor (girişi yavaşlatmıyor, hata girişi bozmuyor). Apple'ın döndürdüğü `id_token`'daki `sub` girişteki `sub` ile karşılaştırılıyor; uyuşmazsa token saklanmıyor. Eşleşirse şifrelenip DB'ye yazılıyor.
  - Eksik yapılandırmada saklama atlanıyor ve loglanıyor.
  - Değişim sürerken hesap silinirse, yeni alınan token hemen iptal ediliyor.
  - Hesap silinince iptal arka planda yapılıyor. Hata, şifre çözülememesi ya da eksik anahtar silmeyi durdurmuyor; yalnızca log düşülüyor.
  - Silinen sağlayıcı bağlantısı varsa bile DB'de token düz metin olarak yer almıyor (testi var).
- Loglara hiçbir zaman token, kod ya da refresh token yazılmıyor; yalnızca neden ve HTTP durumu yazılıyor. Test, logların `RT-`, kod ve `eyJ` içermediğini kontrol ediyor.

## Testler
- Komutlar: `npx tsc --noEmit -p .` temiz geçiyor. `npx vitest run` sonucu: **248 test** (E1a'dan 160 ve 88 yeni), 6 dosya.
- Kapsam:
  - Geçerli token hesaba bağlanıyor (Apple ve Google).
  - Yanlış aud / iss / exp / alg (none, HS256, ES256) / imza / başka anahtar → 401 `invalid_token`.
  - Bilinmeyen kid → JWKS yenileniyor; yenileme dakikada en fazla bir kez.
  - Önbellek max-age'e uyuyor ve en az 1 saat tutuluyor.
  - Bağlı sub başka cihazdan girince `switched`.
  - Aynı sağlayıcıdan ikinci kimlik → 409.
  - Bearer'sız giriş → yeni hesap.
  - `not_configured`, `unavailable`, `rate_limited`.
  - `fullName` kuralları.
  - Apple: kod değişimi, ES256 imzası public key ile doğrulanıyor, revoke formu, sub uyuşmazlığı, secret/anahtar yokken atlama, hatalar silmeyi durdurmuyor, silme ile değişim arasındaki yarış, secret değişince atlama.
  - Şifreli refresh token DB'de düz görünmüyor.
  - Silinince bağlantılar gidiyor.
  - E1a DB dosyası açılışta yeni tabloyu alıyor.
  - HTTP ve store testleri MemoryStore, SqliteStore(:memory:) ve SqliteStore(dosya) üzerinde çalışıyor.

## Ortam değişkenleri (yeni)
| Değişken | Ne işe yarar |
|---|---|
| `APPLE_AUDIENCES` | Virgülle ayrılır; iOS bundle id (ör. `com.farukisiker.okey101`). Yoksa Apple girişi 503 döner. |
| `GOOGLE_AUDIENCES` | Virgülle ayrılır; Web, Android ve iOS OAuth client id'leri. Yoksa Google girişi 503 döner. |
| `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH` | Sign in with Apple .p8 anahtarı. Yoksa iptal kapalı olur (loglanır). |
| `ACCOUNTS_SECRET` | En az 32 karakter rastgele değer, ör. `openssl rand -base64 48`. Yoksa refresh token saklanmaz. **Değiştirilirse saklı token'lar çözülemez.** |

## Kullanıcı adımları (anahtarlar sizde kalır, dosyaya veya prompta yazılmaz)
1. **Apple Developer → Identifiers → App ID (`com.farukisiker.okey101`)**: "Sign In with Apple" yeteneğini açın ("Enable as a primary App ID").
2. **Apple Developer → Keys → +**: "Sign in with Apple" işaretli bir anahtar oluşturun, primary App ID'yi seçin ve `.p8` dosyasını indirin (bir kez indirilebilir). Key ID ve Team ID'yi not alın. `.p8` dosyasını yalnızca sunucuya koyun ve yolunu `APPLE_PRIVATE_KEY_PATH` ile verin. Repoya koymayın.
3. Yetenek açıldıktan sonra iOS provisioning profili yenilenmeli. Uygulama tarafında `ENABLE_APPLE_SIGNIN=1` ile derlenir (Sonnet'in `app.config.js` dosyası).
4. **Google Cloud Console → APIs & Services → Credentials** (OAuth onay ekranı yapılandırılmış olmalı):
   - **Web application** client: id'si uygulamada `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` olur. Android'de ID token'ın `aud` değeri bu id'dir.
   - **Android** client'lar: paket `com.farukisiker.okey101` ile SHA-1 parmak izleri: (a) yükleme anahtarı (`keytool -list -v -keystore <upload.jks>`), (b) **Play App Signing** anahtarı (Play Console → Kurulum → Uygulama bütünlüğü → Uygulama imzalama; mağazadan indirilen sürüm bununla imzalanır), (c) gerekirse debug anahtarı. Her SHA-1 için ayrı bir Android client gerekebilir.
   - **iOS** client: bundle id ile. Id'si `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`; ters çevrilmiş hali `GOOGLE_IOS_URL_SCHEME` olur.
   - Sunucuda `GOOGLE_AUDIENCES` = Web, iOS ve (güvenli tarafta kalmak için) Android client id'leri, virgülle ayrılmış.
5. Sunucuya `ACCOUNTS_SECRET` üretip koyun ve yedekleyin.

## Açık riskler
- **Daha önce de var olan, ara sıra görülen çökme:** SqliteStore(**dosya**) üzerindeki HTTP testlerinde vitest worker'ı arada bir 0xC0000409 koduyla çöküyor (yaklaşık her 3–5 çalıştırmada bir; test başarısız olmuyor, worker düşüyor). E1a HEAD kopyasında da aynı şekilde görüldü (6 çalıştırmada 2); yani E1b'nin getirdiği bir sorun değil.
  - **Fable düzeltmesi:** Çökme SQLite'tan değil; sadece MemoryStore ile de oluyor (8 çalıştırmada 2). Sebep, Windows'ta vitest'in `forks` worker'ı. `packages/accounts/vitest.config.ts` ile `pool: 'threads'` yapıldı; tam takım 8/8 temiz, 248 test.
  - Elenen nedenler: WAL, `close()`, `rmSync`, prepared statement önbelleği. Bellek ve MemoryStore yollarında hiç görülmedi.
  - Büyük olasılıkla Windows'ta Node 24.15'in `node:sqlite` tarafında yerel bir hata. Yeniden çalıştırınca geçiyor.
  - Önerim: CI'da bu dosyayı `--retry`/yeniden çalıştırma ile koşmak; üretimde Linux'ta izlemek; ileride Postgres'e geçmek.
- Apple `nonce` doğrulanmıyor (sayfada istenmedi). Çalınan bir identity token, 10 dakikalık ömrü içinde tekrar kullanılabilir. Gerekirse uygulama SHA256(nonce) gönderir, sunucu da karşılaştırır.
- Google'da `azp` kontrol edilmiyor; `aud` izinli listede olması yeterli sayılıyor (Google'ın tavsiyesi bu).
- Hesaba geçişte (switched) misafir hesap sunucuda sahipsiz kalıyor (sözleşme gereği). İleride eski misafir hesapları temizleyen bir iş gerekebilir.
- Refresh token yalnızca ilk bağlantıda ya da saklı token yoksa alınıyor. Kullanıcı Apple ayarlarından erişimi kaldırıp yeniden girerse eski token geçersiz kalabilir; o durumda iptal Apple'da hata verir, loglanır ve silme yine tamamlanır.
- `ACCOUNTS_SECRET` kaybolursa veya değiştirilirse eski hesaplarda Apple iptali yapılamaz.
- Misafir/yeni hesap IP limiti bellekte tutuluyor (E1a'daki gibi); sunucu yeniden başlarsa sıfırlanıyor.
