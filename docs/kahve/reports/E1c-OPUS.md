# E1c — Opus (sunucu + uygulama) raporu: Apple nonce, Google azp, sahipsiz misafirler

Tarih: 19.11.2026. Commit ve push yapılmadı. Yeni paket eklenmedi, `pnpm install` çalıştırılmadı. `server/` ve `shared/` klasörlerine dokunulmadı.

## Dosyalar
Sunucu (`packages/accounts`):
- `src/auth.ts`:
  - `NonceStore` eklendi: bellekte tutulur, tek kullanımlıktır, 10 dakika geçerlidir, en fazla 100.000 nonce saklar. TTL sabit olduğu için Map'in ekleme sırası aynı zamanda bitiş sırasıdır; temizlik ilk canlı kayıtta durur.
  - `AuthOptions.appleNonceRequired` eklendi.
  - `verify()` artık token'daki `nonce` talebini de döndürüyor.
  - Google'da `azp` kontrolü eklendi.
- `src/app.ts`:
  - `POST /v1/auth/nonce` eklendi.
  - `/v1/auth/apple` içine nonce kontrolü (`checkAppleNonce`) eklendi.
  - `deleteAccountFully()` eklendi (DELETE /v1/me ile aynı yol). Sahipsiz misafirin silinmesi de bu yolu kullanıyor.
  - Per-IP sınırlayıcı genelleştirildi: `hitAllowed`. Misafir limiti aynı şekilde çalışmaya devam ediyor.
- `src/main.ts`: `APPLE_NONCE_REQUIRED` okunuyor. Değer `1` değilse açılışta uyarı yazılıyor.
- `src/index.ts`: `NonceStore` ve `APPLE_NONCE_TTL_MS` dışa aktarılıyor.
- `test/auth.test.ts`:
  - 7 yeni senaryo eklendi. Her biri 3 store'da çalışıyor (Memory, SQLite bellek, SQLite dosya).
  - `NonceStore` için birim testi eklendi.
  - Mevcut "switch" testi yeni davranışa göre güncellendi: sağlayıcısı olmayan misafir artık siliniyor.
  - Test açılışındaki `googleAudiences` listesine Android client id eklendi. Sahte Google token'ı `azp` = Android id taşıdığı için bu gerekiyordu; gerçek kurulumda da durum aynı (aşağıdaki risklere bakın).

Uygulama (`app/`):
- `src/net/accountsClient.ts`:
  - `appleNonce()` eklendi: `POST /v1/auth/nonce` çağrısı Bearer olmadan yapılıyor ve misafir hesap açmıyor. 404 dönerse (eski sunucu) `null` dönüyor; diğer hatalar fırlatılıyor.
  - `signInApple({ ..., nonce })` gövdeye `nonce` ekliyor.
  - **Ek düzeltme:** giriş isteğinde gelen 401'de misafir token'ı artık yalnızca hata `unauthorized` ise atılıyor ve istek Bearer olmadan tekrarlanıyor. Önceden `invalid_token` gelince de geçerli misafir token'ı siliniyordu. Nonce kontrolüyle `invalid_token` daha sık görülebileceği için (örneğin süresi dolmuş nonce) bu, kullanıcının misafir hesabını kaybetmesine yol açardı.
- `src/net/signIn.ts`: `apple()` akışı şöyle: önce `client.appleNonce()` çağrılıyor, sonra `signInAsync({ requestedScopes, nonce })`, ardından `signInApple({ ..., nonce })`. Nonce alınamazsa Apple penceresi hiç açılmıyor ve hata fırlatılıyor.
- `src/net/signInApp.ts` değişmedi. Bu dosya yalnızca `createSignIn` örneğini kuruyor; asıl akış `signIn.ts` içinde.
- `test/accountsClient.test.ts`, `test/signIn.test.ts`: yeni testler eklendi, mevcut Apple testleri `appleNonce`'u da sağlıyor.

## Apple nonce talebi: ham değer mi, SHA-256 mi?
**Ham değer.** Uygulamanın `signInAsync`'e verdiği dize, Apple identity token'ının `nonce` talebinde aynen yer alır. Sunucu bu yüzden talebin kendi verdiği nonce'a birebir eşit olmasını istiyor. Hash'lenmiş talep (`sha256(nonce)`) reddediliyor; bunun da testi var.

Kanıt:
- `node_modules/expo-apple-authentication` (sürüm 58.0.3), `ios/AppleAuthenticationRequest.swift` satır 37: `request.nonce = options.nonce`. JS'ten gelen dize hiç değiştirilmeden `ASAuthorizationAppleIDRequest.nonce`'a atanıyor. `src/` ve `ios/` altında hiçbir SHA/hash işlemi yok (grep ile kontrol edildi). TS tipindeki açıklama da "arbitrary string" diyor.
- AuthenticationServices, `request.nonce`'a verilen değeri token'ın `nonce` talebine olduğu gibi koyar. Firebase/Supabase örneklerinde istemcinin önce `sha256(raw)` hesaplayıp Apple'a hash'i vermesi, sunucunun da `sha256(raw) == claim` kontrolü yapması bu yüzdendir: Apple kendisi hash almaz, hash'i istemci alır. Biz istemcide hash almadığımız için talep = ham nonce.
- Bu, gerçek bir cihazda doğrulanmadı (aşağıdaki risklere bakın).

## Davranış (sözleşme eki)
- `POST /v1/auth/nonce`:
  - Başarılı yanıt `200 { nonce }`. Nonce 32 rastgele baytın base64url hâlidir (43 karakter). Yanıtta `Cache-Control: no-store` var. Bearer gerekmiyor, gönderilse de yok sayılıyor.
  - Apple yapılandırılmamışsa: 503 `not_configured`.
  - Aynı IP 10 dakikada en fazla 30 nonce alabilir; aşılırsa 429 `rate_limited`.
  - Bellek dolu ve hepsi canlıysa: 503 `unavailable`.
- `POST /v1/auth/apple` artık isteğe bağlı bir `nonce` alanı kabul ediyor:
  - Metin değilse 400 `bad_request`.
  - Şu durumların hepsi 401 `invalid_token` döner: biçimi yanlış, token'daki talep farklı ya da yok, hiç verilmemiş, süresi dolmuş ya da daha önce kullanılmış nonce.
  - Nonce yalnızca token imzası doğrulandıktan ve talep eşleştikten sonra harcanıyor. Böylece JWKS 503'ü ya da talep uyuşmazlığı nonce'u yakmıyor; ama aynı token ikinci kez kullanılamıyor.
  - Gövdede nonce hiç yoksa:
    - `APPLE_NONCE_REQUIRED=1` ise: 401.
    - Değilse giriş kabul ediliyor ve loga uyarı düşülüyor. Bu geçiş modu, eski test build'leri çalışmaya devam etsin diye var.
    - Geçiş modunda bile, token bir `nonce` talebi taşıyorsa gövdede nonce olmadan giriş reddediliyor. Böylece nonce'lu çalınmış bir token, nonce alanını boş bırakarak kontrolü atlayamıyor.
- Google'da `azp` varsa metin olmalı ve `GOOGLE_AUDIENCES` içinde bulunmalı; aksi hâlde 401 `invalid_token`. `azp` yoksa önceki kurallar geçerli.
- Sahipsiz misafir: bir giriş başka bir hesaba geçtiğinde (`switched: true`), Bearer'daki hesaba hiç sağlayıcı bağlı değilse o hesap hemen siliniyor.
  - Silme, DELETE /v1/me ile aynı yoldan yapılıyor: foto, oturumlar, raporlar, engeller ve `onAccountDeleted` kancası.
  - Silme hatası girişi bozmuyor, yalnızca loglanıyor.
  - Kendi sağlayıcısı olan hesaplar (örneğin Apple bağlı bir hesap Google ile başka hesaba geçerse) silinmiyor.
  - Bearer'sız girişte ve aynı hesabın tekrar girişinde hiçbir şey silinmiyor.

## Testler
- `corepack pnpm --filter @kahve/accounts typecheck`: temiz.
- `corepack pnpm --filter @kahve/accounts test`: 9 dosya, **318 test geçti**.
  - Yeni testler: nonce verilmesi, tek kullanım ve tekrar oynatma; uyuşmazlık, hash'li talep, verilmemiş, süresi dolmuş ve biçimi bozuk nonce; uyuşmazlığın nonce'u yakmaması; geçiş modu ve zorunlu mod; token'da nonce varken gövdede olmaması; uç noktada 503 ve IP limiti; Google `azp` için yabancı id, metin olmayan değer, web id, `azp`'siz token ve listede olmayan Android id; sahipsiz misafirin fotoğrafıyla silinmesi ve kancanın çalışması; sağlayıcısı olan misafirin korunması; `NonceStore` birim testi.
- `corepack pnpm --filter ./app typecheck`: temiz.
- `corepack pnpm --filter ./app test`: 14 dosya, **204 test geçti**. Çalışma ağacında başka ajanların yaptığı değişiklikler de vardı; testler onlarla birlikte geçti.

## Riskler / yapılacaklar
1. **Gerçek cihaz doğrulaması yapılmadı.** Nonce'un token'a ham olarak girdiği kaynak koda ve Apple'ın bilinen davranışına dayanıyor. İlk iOS test build'inde loga bakılmalı: `nonce mismatch` görülürse varsayım yanlıştır. Doğrulama tamamlanana kadar `APPLE_NONCE_REQUIRED` açılmamalı.
2. **`GOOGLE_AUDIENCES` artık Android ve iOS client id'lerini mutlaka içermeli.** Android'de token'ın `aud` değeri web client id'si, `azp` değeri ise Android client id'sidir. Android id listede yoksa Android'de Google girişi 401 verir. E1b'de bu "güvenli tarafta kalmak için" önerilmişti; şimdi zorunlu. Play imzalı build'in client id'si farklıysa o da listeye eklenmeli.
3. **Nonce'lar bellekte tutuluyor.** Sunucu yeniden başlarsa bekleyen nonce'lar kaybolur ve kullanıcı bir kez 401 görür, tekrar dener. Birden fazla accounts örneği çalıştırılırsa nonce'lar örnekler arasında paylaşılmaz. Bugün tek örnek ve SQLite kullanıldığı için sorun yok; yatay ölçeklemede store'a taşınmalı.
4. **Geçiş modu açıkken nonce'suz eski build'ler tekrar oynatma korumasından yararlanmaz.** Tüm build'ler nonce gönderdiğinde sunucuda `APPLE_NONCE_REQUIRED=1` ayarlanmalı.
5. **Sahipsiz misafir silme geri alınamaz.** Misafir hesabın adı, fotoğrafı, engel listesi ve raporları, başka hesaba geçildiği anda silinir. İstenen davranış bu; ama arayüzde "bu cihazdaki misafir profil silinecek" uyarısı yoksa (`profSwitched` metni) kullanıcı şaşırabilir. Bu bir arayüz kararı, Sonnet'e not.
6. Nonce uç noktası kimlik doğrulamasız. Kötüye kullanım IP başına 30/10 dk sınırı ve 100.000 kayıtlık bellek tavanıyla sınırlanıyor; tavan dolarsa yeni nonce istekleri 503 alır (bellek taşmaz).
