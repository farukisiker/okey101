# E1a — Opus (sunucu) raporu: `@kahve/accounts`

Tarih: 18.11.2026. Commit/push yok. Sadece `packages/accounts/` ve bu rapor yazıldı.

## Dosyalar
- `packages/accounts/package.json`, `tsconfig.json`: paket şablonu (`@kahve/tavla` gibi). Yeni npm paketi yok. Kullanılanlar: express (zaten var), `node:sqlite`, `node:crypto`.
- `src/types.ts`: sözleşme tipleri (`Me`, `PhotoStatus`, `ReasonCode`, hata kodları).
- `src/store.ts`: `AccountStore` arayüzü (async, ileride Postgres'e uygun).
- `src/memoryStore.ts`, `src/sqliteStore.ts`: iki uygulama. Foto, DB'de BLOB olarak duruyor.
- `src/schema.sql`: taşınabilir şema (Postgres'e geçerken sadece BLOB → BYTEA).
- `src/jpeg.ts`: yapısal JPEG doğrulama. FFD8 kontrolü, SOF'tan en/boy, APP1–APP15 + COM sökülür (taramalar arasındakiler de), EOI sonrası atılır.
- `src/moderation.ts`: `runModeration` birleştirme, `openaiModeration` (omni-moderation-latest), `claudeVision` (claude-haiku-5-5, ham fetch, `output_config.format` json_schema, effort low). Anahtar yok, ağ hatası, 10 sn zaman aşımı, HTTP hatası, bozuk JSON veya refusal → `review`.
- `src/admin.ts`: sade, sunucuda üretilen inceleme sayfası. Kullanıcı metinleri escape ediliyor; CSP nonce kullanılıyor.
- `src/app.ts`: `createAccountsApp({ store, moderation, adminToken, now?, moderationTimeoutMs?, trustProxy?, onAccountDeleted?, log? })` → express app + `whenIdle()`.
- `src/main.ts`: tek başına sunucu. `src/index.ts`: dışa aktarımlar.
- `test/helpers.ts`, `test/jpeg.test.ts`, `test/moderation.test.ts`, `test/store.test.ts`, `test/app.test.ts`.

## Çalıştırma
```
cd packages/accounts
ADMIN_TOKEN=<en az 16 karakter> ACCOUNTS_DB=./accounts.db PORT=3100 npx tsx src/main.ts
```
Testler: `npx tsc --noEmit -p .` ve `npx vitest run` (paket klasöründen) ya da `corepack pnpm --filter @kahve/accounts typecheck|test`.

## Ortam değişkenleri
- `PORT` (varsayılan 3100)
- `ACCOUNTS_DB` (varsayılan `./accounts.db`; `:memory:` geçici çalıştırma için)
- `ADMIN_TOKEN` (yoksa veya 16 karakterden kısaysa admin kapalı, her istek 401)
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` (yoksa o katman her fotoyu `review`'a atar)
- `TRUST_PROXY` (isteğe bağlı; ters vekil arkasında IP limiti için, örn. `1`)

## Güvenlik notları
- Token: 32 bayt, base64url. DB'de sadece sha256'sı tutuluyor. Admin token karşılaştırması iki tarafın sha256'sı üzerinde `timingSafeEqual` ile yapılıyor.
- Gövde sınırları: JSON 4 KB, foto 150 KB (413 too_large). Boyut 512×512'yi aşarsa 400 bad_image.
- Rıza (403) ve günlük 3 yükleme (429) kontrolleri gövde okunmadan önce yapılıyor. Sayaç DB'de, UTC güne göre tutuluyor; artırma, yarış durumuna karşı ayrıca kontrol ediliyor.
- Misafir hesap: IP başına saatte 10 (bellekte; sunucu yeniden başlarsa sıfırlanır).
- Reddedilen JPEG'in sha256'sı (EXIF sökülmüş hali) engel listesine giriyor. Admin onayı bu kaydı kaldırıyor.
- Moderasyon sonucu sürüm korumalı: eski yüklemenin geç gelen sonucu yeni fotoğrafın üstüne yazılmıyor.
- `review` sırasında sebepler kullanıcıya gösterilmiyor; sadece `rejected` iken gösteriliyor.
- Admin sayfası: tokensiz istek 401 + veri içermeyen kabuk döner. Token sadece sessionStorage'da tutulur ve fetch başlığı ile gider; URL'ye hiç girmez. Liste sunucuda escape edilerek üretilir, DOMParser ile alınır. Görseller fetch + blob: URL ile yüklenir. CSP: nonce'lu script/style, `img-src blob:`, `frame-ancestors 'none'`.

## Testler
4 dosya, **160 test, hepsi yeşil**. Store ve HTTP takımları MemoryStore, SqliteStore(:memory:) ve SqliteStore(geçici dosya) üzerinde aynen koşuyor. Kapsananlar: sözleşmedeki her yol, yetkisiz erişim, onaysız foto 404, EXIF sökülmesi, rıza yoksa 403, 4. yükleme 429 (yeniden başlatmadan sonra da), moderasyon birleştirme tablosu, anahtarsız → review, zaman aşımı → review, engel listesi, hesap silince token geçersiz + foto 404 + kanca, admin onay/ret, admin HTML'de XSS escape ve token sızmaması. Gerçek API çağrısı yok (fetch enjekte ediliyor).

## Açık riskler / notlar
- `Me.photo.url` göreli (`/v1/photos/<id>.jpg?v=N`). Uygulama başına `EXPO_PUBLIC_ACCOUNTS_URL` eklemeli.
- JPEG doğrulama yapısal; pikseller çözülmüyor. Bozuk ama yapısı doğru bir dosya moderasyonda hata verir ve `review`'a düşer (fail closed).
- APP2 (ICC renk profili) de sökülüyor; renkler çok az değişebilir.
- Moderasyon işleri bellekte. Sunucu tam o sırada çökerse foto `pending` kalır. Admin `?status=pending` sekmesinden görebilir, otomatik yeniden deneme yok.
- Misafir IP limiti bellekte ve tek süreç için geçerli. Birden fazla süreç olursa DB/Redis'e taşınmalı.
- Hesap silme Apple/Google token iptali için `onAccountDeleted` kancası şimdilik no-op.
- `corepack pnpm --filter ... typecheck` ilk çalıştırmada pnpm 12'nin "çalıştırmadan önce bağımlılık doğrula" adımını tetikledi ("resolved 597, added 0"). pnpm-lock.yaml'a `packages/accounts` girdisi bundan gelmiş olabilir; lock dosyasında Sonnet'in expo değişiklikleri de olduğu için geri alınmadı. Fable'ın son `install`'ı bunu zaten doğrular.
- Gerçek OpenAI/Anthropic yanıt biçimleri sadece sahte fetch ile test edildi. Anahtarlar verildikten sonra bir kez gerçek bir fotoğrafla elle denenmeli.
