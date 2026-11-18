GÖREV: E1b — Apple ve Google ile giriş (misafir hesabı bağlama, var olan hesaba dönme, hesap silmede Apple iptali)
FAZ: E1 (kullanıcı 18.11.2026 "Evet ekle": Apple/Google giriş modülleri ONAYLANDI → `expo-apple-authentication`, `@react-native-google-signin/google-signin`)
KIRMIZI ÇİZGİ: E1a ile aynı (push yok, sunucu/mağaza yükleme yok, anahtar/parola dosyaya veya prompta yazılmaz, `C:/Users/mfaru/okey101/okey101` dokunulmaz).
Bu iki modül dışında yeni native modül yok (expo-crypto, expo-auth-session, expo-secure-store YOK). Commit Fable'ın.

## Sözleşme eklemesi (E1a sözleşmesine ek; `Me` genişler)
```ts
type Provider = 'apple' | 'google';
interface Me { /* E1a alanları */ providers: Provider[] }
interface AuthResult { accountId: string; token: string; switched: boolean } // switched: başka (var olan) hesaba geçildi
```
| Yöntem ve yol | Gövde | Yanıt |
|---|---|---|
| POST /v1/auth/apple | `{ identityToken: string, authorizationCode?: string, fullName?: string }` | 200 `AuthResult` |
| POST /v1/auth/google | `{ idToken: string }` | 200 `AuthResult` |
Kimlik başlığı (Bearer misafir token) İSTEĞE BAĞLI:
- Sağlayıcı kimliği (`sub`) hiçbir hesaba bağlı değilse: Bearer varsa o hesaba bağlanır (`switched: false`, aynı token geri döner); Bearer yoksa yeni hesap açılır.
- `sub` başka bir hesaba bağlıysa: o hesaba yeni oturum token'ı verilir (`switched: true`). Mevcut misafir hesap SİLİNMEZ ve birleştirilmez (basit; misafirin
  fotoğrafı/ismi o cihazda kaybolur, uygulama kullanıcıya "Önceki hesabınıza girildi" der).
- Bir hesaba aynı sağlayıcıdan ikinci bir kimlik bağlanamaz (409 `already_linked`). Yeni hata kodları: `invalid_token`, `already_linked`, `not_configured`.
- Sağlayıcı yapılandırılmamışsa (aud ortam değişkeni yok) 503 `not_configured`.
- `fullName` sadece displayName boşsa ve geçerliyse isim olarak kullanılır (Apple adı yalnız ilk girişte verir).

## Opus (sunucu, `packages/accounts`)
- JWT doğrulama `node:crypto` ile (yeni paket yok): RS256, JWKS (`https://appleid.apple.com/auth/keys`, `https://www.googleapis.com/oauth2/v3/certs`),
  `kid` ile anahtar seçimi, JWKS önbelleği (Cache-Control max-age'e göre, en az 1 saat; bilinmeyen `kid` gelince bir kez yeniler, dakikada en fazla 1 kez).
  Kontroller: alg = RS256 (none/HS* reddedilir), iss (Apple: `https://appleid.apple.com`; Google: `accounts.google.com` veya `https://accounts.google.com`),
  aud ∈ izinli liste, exp > şimdi (60 sn tolerans), iat makul, Google için `email_verified` gerekmez (e-posta saklanmaz). Saklanan: sağlayıcı + `sub`.
- Ortam: `APPLE_AUDIENCES` (virgüllü; bundle id `com.farukisiker.okey101` gibi), `GOOGLE_AUDIENCES` (virgüllü web/android/ios client id'leri).
- Hesap silmede Apple iptali: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH` (Sign in with Apple .p8) varsa: girişte `authorizationCode`'u
  `https://appleid.apple.com/auth/token` ile refresh_token'a çevirip sakla (DB'de; düz metin değil, `ACCOUNTS_SECRET` ile AES-256-GCM şifreli;
  ACCOUNTS_SECRET yoksa saklama yapma ve logla), silmede `/auth/revoke`. client_secret = ES256 JWT (node:crypto, `dsaEncoding: 'ieee-p1363'`).
  Yapılandırılmamışsa sessizce atla (log). Hata silmeyi durdurmaz.
- Store: `account_providers(provider, sub, account_id, created_at, apple_refresh_enc?)` UNIQUE(provider, sub) ve UNIQUE(account_id, provider). Hesap silinince satırlar silinir.
- Test: sahte JWKS (test içinde `generateKeyPairSync('rsa')` ile imzalanmış token), fetch enjekte. Kapsam: geçerli token bağlar; yanlış aud/iss/exp/alg/imza → 401
  invalid_token; bilinmeyen kid → JWKS yenilenir; bağlı sub ile başka cihazdan giriş → switched; aynı sağlayıcıdan ikinci kimlik → 409; Bearersiz giriş yeni hesap;
  not_configured; Apple iptal akışı (sahte token/revoke uç noktası, ES256 imzası doğrulanır); şifreli refresh token DB'de düz görünmez; silince bağlantılar gider.
- Rapor: docs/kahve/reports/E1b-OPUS.md (+ kullanıcı adımları: Apple Developer'da App ID'ye "Sign In with Apple" yeteneği ve .p8 anahtarı;
  Google Cloud'da OAuth istemcileri: Web, Android (paket + SHA-1: yükleme ve Play imza anahtarı), iOS).

## Sonnet (uygulama)
- Kurulum: `corepack pnpm --filter ./app add expo-apple-authentication@<SDK58 sürümü> @react-native-google-signin/google-signin@<Expo 58 / RN 0.88 uyumlu son sürüm>`.
- **Derlemeyi bozmamak için** `app/app.config.js` ekle: app.json'u okur, sadece ortam değişkeni varsa ekler:
  - `ENABLE_APPLE_SIGNIN=1` → `ios.usesAppleSignIn: true` + `expo-apple-authentication` plugin (App ID yeteneği açılmadan iOS imzası bozulmasın diye).
  - `GOOGLE_IOS_URL_SCHEME` varsa → `@react-native-google-signin/google-signin` plugin `{ iosUrlScheme }`. Yoksa plugin eklenmez (Android'de plugin şart değilse
    yine de autolink çalışır; kontrol et ve rapora yaz).
  app.json'daki başka hiçbir şey değişmez.
- `accountsClient`: `signInApple({identityToken, authorizationCode, fullName})`, `signInGoogle(idToken)` → AuthResult'taki token'ı kaydeder; `Me.providers`.
- `app/src/net/signIn.ts`: platform ayrımı. iOS: Apple düğmesi (`AppleAuthentication.isAvailableAsync()`) + Google; Android: sadece Google
  (`GoogleSignin.configure({ webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID })`;
  webClientId yoksa Google düğmesi gizli). İptal edilen giriş sessizce kapanır, hata değildir.
- ProfileScreen: providers boşsa "Hesabını koru" kartı: "Uygulamayı silsen de profilin kaybolmasın" + Apple ile giriş (iOS'ta Apple'ın kendi düğmesi
  `AppleAuthenticationButton`, kurallar gereği) ve Google ile giriş. Bağlıysa "Apple ile bağlı ✓" / "Google ile bağlı ✓". switched → bilgi: "Önceki hesabınıza girildi".
  Hesap silmede Google için `GoogleSignin.revokeAccess()` + `signOut()` (hata yutulur).
- 60+ kuralları; i18n tr + 12 dil (anahtarlar `prof` ile başlasın), UTF-8.
- Test: client yeni yöntemleri, switched davranışı, signIn platform/yapılandırma mantığı (native modüller mock).
- `corepack pnpm --filter ./app typecheck` ve `test` yeşil. Rapor: docs/kahve/reports/E1b-SONNET.md (sürümler, app.config.js ortam değişkenleri, tablette deneme için gerekenler).
