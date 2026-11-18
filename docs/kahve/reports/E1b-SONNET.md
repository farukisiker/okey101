# E1b Sonnet raporu: Apple / Google ile giriş (uygulama tarafı)

## Kurulan paketler
`corepack pnpm --filter ./app add expo-apple-authentication@~58 @react-native-google-signin/google-signin`
- `expo-apple-authentication` **~58.0.3** (SDK 58 sürümü).
- `@react-native-google-signin/google-signin` **^17.0.0** (kurulu 17.0.0). Peer bağımlılıkları: `expo >=52.0.40` (isteğe bağlı), `react *`, `react-native *`; yani Expo 58 / RN 0.88 ile uyumlu. Başka paket eklenmedi.
- Google v17 notları: `signIn()` iptalde hata atmaz, `{type:'cancelled'}` döner (yine de hata kodu `SIGN_IN_CANCELLED`/`12501` gelirse de sessiz kapanır). Config plugin'i yalnız iOS URL şemasını ekler (`iosUrlScheme` zorunlu, `com.googleusercontent.apps.` ile başlamalı); Android için plugin gerekmez, autolink yeter. Android'de SHA-1 + paket adıyla Google Cloud OAuth istemcisi gerekir (kodda değil).

## app.config.js
`app/app.config.js` app.json'un `expo` nesnesini `config` olarak alır, yalnız ekleme yapar; app.json'a dokunulmadı (bundle id, sürüm, reklam kimlikleri aynı).

| Ortam değişkeni | Etki |
|---|---|
| `ENABLE_APPLE_SIGNIN=1` | `ios.usesAppleSignIn: true` + `expo-apple-authentication` plugin |
| `GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<id>` | `@react-native-google-signin/google-signin` plugin `{ iosUrlScheme }` |

`npx expo config --type public` (app/ içinden):
- Değişkensiz: plugin listesinde ikisi de YOK, `ios.usesAppleSignIn` YOK (çıktı app.json ile aynı, 159 satır).
- `ENABLE_APPLE_SIGNIN=1 GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.123-abc` ile iki çıktı arasındaki fark tam şu: plugins'e `'expo-apple-authentication'` ve `['@react-native-google-signin/google-signin', { iosUrlScheme: 'com.googleusercontent.apps.123-abc' }]` eklenir, `ios.usesAppleSignIn: true` eklenir. Başka fark yok.

Uyarı: plugin'i olan paket kurulu olduğu için değişkensiz derleme de çalışır; iOS'ta Apple düğmesi `isAvailableAsync()` yetenek yoksa false döner, düğme gizli kalır. Ama yetenek (entitlement) olmadan Apple ile giriş denemesi çalışmaz; bu yüzden değişkeni yalnız App ID'de "Sign In with Apple" açıldıktan sonra verin.

## Dosyalar
Yeni:
- `app/app.config.js`
- `app/src/net/signIn.ts`: `createSignIn(env, native?)` (React Native import'u yok, Node'da test edilir; yerel modüller tembel `require` ile yüklenir, modül yoksa düğme gizlenir). `available()` → `{apple, google}`: Apple yalnız iOS + `isAvailableAsync()`; Google için `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` şart (yoksa gizli). `apple(client)`, `google(client)` → `{kind:'done', result}` ya da `{kind:'cancelled'}` (iptal hata değil). `googleForget()` = `revokeAccess()` + `signOut()`, hatalar yutulur. Google `configure` bir kez, `webClientId` + `iosClientId` ile.
- `app/src/net/signInApp.ts`: uygulama örneği (Platform.OS + `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` / `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`).
- `app/test/signIn.test.ts`: 12 test.

Değişen:
- `app/src/net/accountsClient.ts`: `Provider`, `AuthResult`, `Me.providers`; yeni hata kodları `invalid_token`, `already_linked`, `not_configured`; `signInApple({identityToken, authorizationCode?, fullName?})`, `signInGoogle(idToken)`. Bearer varsa gönderilir (yoksa göndermez, sırf giriş için misafir hesap AÇMAZ); Bearer 401 verirse token silinir ve bir kez Bearer'sız denenir. Dönen token saklanır (switched=true ise artık o hesabın token'ı kullanılır). Token'sız yanıt `unknown` hata.
- `app/src/net/photoStatus.ts`: yeni hata kodları metin anahtarına eşlendi.
- `app/src/screens/ProfileScreen.tsx`: providers boşsa ve en az bir yöntem varsa "Hesabınızı koruyun" kartı (iOS'ta Apple'ın kendi `AppleAuthenticationButton`'ı, SIGN_IN tipi, beyaz; yanında Google düğmesi). Bağlıysa "Apple ile bağlı ✓" / "Google ile bağlı ✓". `switched` ise "Önceki hesabınıza girildi" bilgisi (isim/foto yeni hesaptan yüklenir). Hesap silmede Google bağlıysa silme sonrası `googleForget()`. Giriş hataları mevcut hata satırında (`already_linked`, `invalid_token`, `not_configured` için ayrı metin; yerel modül hatası genel bağlantı metnine düşer).
- `app/test/accountsClient.test.ts`: `providers` alanı + 6 yeni test (Bearer'lı bağlama ve alan temizliği, switched token'ı, Bearer'sız giriş misafir açmaz, bayat token yeniden deneme, yeni hata kodları ve token korunması, token'sız yanıt) + errorKey eşlemeleri.
- `app/package.json`, `pnpm-lock.yaml`.
- i18n: `tr.ts` + 12 dil, 9 yeni anahtar (hepsi `prof` ile başlar): `profKeepTitle`, `profKeepBody`, `profGoogle`, `profLinkedApple`, `profLinkedGoogle`, `profSwitched`, `profErrLinked`, `profErrToken`, `profErrSignInOff`. Hitap "siz" biçiminde (60+). UTF-8 doğrulandı (bozuk karakter yok). Çeviriler yerli gözle gözden geçirilmedi.

## Test sonucu
`corepack pnpm --filter ./app typecheck` temiz; `corepack pnpm --filter ./app test` 11 dosya / 157 test yeşil (E1a'da 140 idi).

## Tablette / cihazda denemek için gerekenler
Yeni native modül iki tane: yeni Kahve Test build'i şart (Expo Go yetmez).
- Android: build ortamında `EXPO_PUBLIC_ACCOUNTS_URL` ve `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (Web OAuth istemcisi, sunucudaki `GOOGLE_AUDIENCES` listesinde de olmalı). Google Cloud'da Android OAuth istemcisi (paket `com.farukisiker.okey101` + yükleme anahtarı SHA-1; Play'den dağıtılan build için Play imza SHA-1'i de). Cihazda Google Play hizmetleri ve bir Google hesabı. Apple düğmesi Android'de çıkmaz (beklenen).
- iOS: `ENABLE_APPLE_SIGNIN=1` (Apple Developer'da App ID'ye "Sign In with Apple" yeteneği açıldıktan sonra, yoksa imza bozulur), Google için `GOOGLE_IOS_URL_SCHEME` + `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` + `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`. Gerçek iPhone'da denenmeli (simülatörde Apple giriş sınırlı).
- Denenecekler: (1) sağlayıcısız hesapta kart görünüyor; bağlayınca "… ile bağlı ✓". (2) Aynı hesapla ikinci cihaz/temiz kurulumda giriş: "Önceki hesabınıza girildi", isim/foto eski hesaptan geliyor. (3) Giriş penceresini kapatma: hata yok. (4) Hesabı sil → Google izni kalkıyor, tekrar girişte hesap seçici çıkıyor. (5) Sunucuda sağlayıcı yapılandırılmamışsa "şu an kullanılamıyor" metni.

## Açık riskler
- `Me.providers` sunucu E1b'de gelecek; eski sunucu alanı göndermezse ekran `providers ?? []` ile boş sayar (kart çıkar), çökmez. Sunucu ajanının gerçek yanıtlarıyla (`switched`, 409/503 gövdeleri) uçtan uca denenmedi.
- Apple adı yalnız ilk girişte gelir: istemci `givenName familyName` birleştirip gönderir; ilk girişte ağ hatası olursa ad bir daha gelmez (sunucu displayName boşsa kullanır; kullanıcı Profil'den ismi elle girebilir).
- Google v17 iOS'ta `iosClientId` verilmezse yerel yapılandırmaya (GoogleService-Info yok) bağlı kalır; iOS için ortam değişkeni ve URL şeması ikilisi birlikte verilmeli.
- `AppleAuthenticationButton` düğmesi ve genel görünüm gerçek cihazda görülmedi (yatay ekran, büyük yazı boyutunda kart taşması). Apple, düğme stilini/yazısını değiştirmeyi sınırlar; yazı cihaz dilinden gelir.
- Google'ın `switched` sonrası eski misafir hesap sunucuda yetim kalır (sheet böyle istedi).
- `expo prebuild` ile plugin çıktılarının (Info.plist URL şeması, entitlements) gerçek derlemede doğrulanması yapılmadı; yalnız `expo config` düzeyinde kontrol edildi.
