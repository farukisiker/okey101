GÖREV: E1a — Hesap + profil fotoğrafı (misafir hesap, foto yükleme, 2 katmanlı moderasyon, yönetim kuyruğu, hesap silme)
FAZ: E1 (kullanıcı 18.11.2026 "İlk 2'yi yap": gerçek para kuralı değişikliği + expo-image-picker/manipulator + LiveKit onaylandı)
KIRMIZI ÇİZGİ: push yok, Pi'ye/VPS'e/mağazaya yükleme yok, `C:/Users/mfaru/okey101/okey101` dokunulmaz, API anahtarı/parola hiçbir dosyaya ve
prompta yazılmaz (sadece ortam değişkeni adı). Onaylı native modüller dışında yeni native modül yok (Apple/Google giriş modülleri ONAYLI DEĞİL).
Commit Fable'ın.

KAPSAM DIŞI (E1b ve sonrası): Apple/Google girişi istemci tarafı, fotoğrafın masada rakip panelinde görünmesi (oyun sunucusu entegrasyonu),
R2 saklama, algısal hash, Postgres. Bunlar için sadece arayüz/yer bırak.

## Sözleşme (iki taraf da buna uyar, değiştirmek Fable'a sorulur)
Taban: `ACCOUNTS_URL` (uygulamada `EXPO_PUBLIC_ACCOUNTS_URL`). JSON gövdeler. Kimlik: `Authorization: Bearer <token>`.
Hata gövdesi: `{ "error": "<kod>" }` kodlar: unauthorized, bad_request, too_large, bad_image, rate_limited, consent_required, not_found.

| Yöntem ve yol | Gövde | Yanıt |
|---|---|---|
| POST /v1/accounts/guest | `{}` | 201 `{ accountId, token }` (IP başına saatte 10) |
| GET /v1/me | – | 200 `Me` |
| PATCH /v1/me | `{ displayName?: string }` (2–16 karakter, kırpılır) | 200 `Me` |
| POST /v1/me/consent | `{ kind: "photo", version: 1 }` | 200 `Me` |
| POST /v1/me/photo | ham JPEG, `Content-Type: image/jpeg`, ≤ 150 KB, ≤ 512×512 | 202 `Me` (photo.status = "pending"); rıza yoksa 403 consent_required; günde 3 yükleme, aşılırsa 429 rate_limited |
| DELETE /v1/me/photo | – | 200 `Me` |
| DELETE /v1/me | – | 204 (hesap, oturumlar, foto, rıza kayıtları silinir) |
| GET /v1/photos/:accountId.jpg | – | 200 image/jpeg sadece onaylıysa, yoksa 404. `Cache-Control: public, max-age=300` |
| GET /admin | – (Bearer ADMIN_TOKEN) | sade HTML inceleme sayfası |
| GET /admin/v1/photos?status=review | Bearer ADMIN_TOKEN | `[{ accountId, displayName, status, reasons, uploadedAt }]` |
| GET /admin/v1/photos/:accountId/image | Bearer ADMIN_TOKEN | image/jpeg (her durumda) |
| POST /admin/v1/photos/:accountId/decision | `{ decision: "approve" \| "reject", reason?: ReasonCode }` | 200 |

```ts
type PhotoStatus = 'none' | 'pending' | 'review' | 'approved' | 'rejected';
type ReasonCode = 'nudity' | 'violence' | 'hate' | 'selfHarm' | 'text' | 'symbol' | 'child' | 'otherPerson' | 'document' | 'other';
interface Me {
  accountId: string; displayName: string | null; photoConsent: boolean; uploadsLeftToday: number;
  photo: { status: PhotoStatus; reasons: ReasonCode[]; url: string | null }; // url sadece approved iken (/v1/photos/<id>.jpg?v=<sürüm>)
}
```
`review` kullanıcıya "inceleniyor" olarak `pending` ile aynı gösterilir. Onaylı eski foto, yenisi incelenirken yayında kalır mı? HAYIR: yeni yükleme eskisini hemen yayından kaldırır (basit).

## Opus (sunucu): `packages/accounts` (`@kahve/accounts`, yeni workspace paketi, sadece sunucu)
- `createAccountsApp({ store, moderation, adminToken, now? })` → express app; `src/main.ts` tek başına çalıştırır (PORT, ACCOUNTS_DB, ADMIN_TOKEN,
  OPENAI_API_KEY, ANTHROPIC_API_KEY ortam değişkenleri). Bağımlılık: express (zaten var). **Yeni npm paketi yok**: SQLite için `node:sqlite`
  (Node 24), JWT/kripto için `node:crypto`.
- `AccountStore` arayüzü + `MemoryStore` + `SqliteStore` (aynı test takımı ikisinde de koşar). Foto BLOB olarak DB'de (256 px ≈ 20 KB).
  Şema dosyası taşınabilir SQL olsun (ileride Postgres).
- Token: 32 bayt rastgele, base64url; DB'de sadece sha256'sı. Admin token karşılaştırması `timingSafeEqual`.
- JPEG doğrulama: FFD8 başlangıç, SOF'tan en/boy, APP1–APP15 ve COM segmentleri sökülür (EXIF/GPS kalmaz). Bozuk veya JPEG değilse 400 bad_image.
- Moderasyon: `ModerationLayer { name; check(jpeg: Buffer): Promise<{ verdict: 'ok' | 'reject' | 'review'; reasons: ReasonCode[] }> }`.
  Katman 1 `openaiModeration` (omni-moderation-latest, görsel data URL; sexual/violence/hate/self-harm → ReasonCode). Katman 2 `claudeVision`
  (Messages API, model `claude-haiku-5-5`, JSON yanıtlı politika sorusu: yazı/URL/telefon/QR/reklam → text, siyasi/aşırı sembol → symbol,
  tek başına çocuk → child, ünlü veya başkasının fotoğrafı gibi → otherPerson, kimlik/fatura/ekran görüntüsü → document; çiçek, manzara, kedi gibi
  zararsız fotoğraflar UYGUN). Birleştirme: herhangi reject → rejected; herhangi review → review; hepsi ok → approved.
  **Anahtar yoksa, ağ hatası, zaman aşımı (10 sn) veya bozuk JSON → review (asla otomatik onay yok).** Moderasyon arka planda; yükleme 202 döner.
  Testler sahte katmanla; gerçek API'ye test içinde istek atılmaz (fetch enjekte edilir).
- Reddedilen JPEG'in sha256'sı engel listesine; aynı dosya tekrar gelirse doğrudan rejected.
- Günlük 3 yükleme sayacı DB'de (UTC gün). Gövde sınırı express.raw({ limit: '150kb' }) / json 4 KB.
- Hesap silme Apple token iptali için yer: `onAccountDeleted` kancası (şimdilik no-op).
- Test (vitest, supertest YOK: `app.listen(0)` + fetch): sözleşmedeki her yol, yetkisiz erişim, başkasının fotosu onaysızken 404, EXIF sökülmesi,
  rıza yoksa 403, 4. yükleme 429, moderasyon birleştirme tablosu, anahtarsız → review, hesap silince token geçersiz ve foto 404, admin onay/ret akışı.
- Rapor: docs/kahve/reports/E1-OPUS.md (dosyalar, nasıl çalıştırılır, açık riskler).

## Sonnet (uygulama): profil ekranı + foto akışı
- `npx expo install expo-image-picker expo-image-manipulator` (app klasöründe, SDK 58 sürümleri). app.json plugin: expo-image-picker
  (photosPermission, cameraPermission İngilizce sade metin; mikrofon izni İSTEME: `microphonePermission: false`).
- `app/src/net/accountsClient.ts`: sözleşmedeki istemci tarafı (guest oluşturma + token AsyncStorage'da `accounts.token`, getMe, setName,
  giveConsent, uploadPhoto(uri), deletePhoto, deleteAccount). `EXPO_PUBLIC_ACCOUNTS_URL` yoksa özellik kapalı (`accountsEnabled()` false).
  401 gelirse token silinir, yeni misafir hesap açılır (bir kez).
- Foto hazırlama: picker `allowsEditing: true, aspect: [1,1], quality: 1` → manipulator resize 256×256, JPEG compress 0.8 → upload.
  Kamera ve galeri iki ayrı büyük düğme.
- `ProfileScreen`: isim, yuvarlak foto (yoksa baş harfli renkli daire), durum yazısı (İnceleniyor / Onaylandı / Reddedildi: sebep),
  "Galeriden seç", "Fotoğraf çek", "Fotoğrafı kaldır", "Hesabımı sil" (onay penceresi). İlk yüklemeden önce rıza penceresi: fotoğrafın
  otomatik incelemeden (yurtdışındaki yapay zekâ servisleri) ve gerekirse insan incelemesinden geçeceği, onaylanınca masadaki oyunculara
  görüneceği, istediği an silinebileceği; "Kabul ediyorum" / "Vazgeç". Durum pending/review iken 5 sn'de bir getMe (ekran açıkken).
  Giriş noktası: Kahve salonunda (KahveSalonu) üstte "Profilim" düğmesi; accountsEnabled() false ise görünmez.
- 60+ kuralları (ORKESTRA §5.11): yazı ≥15 pt, dokunma ≥56 dp, tek ana eylem, sistem yazı büyütmede taşma yok.
- i18n: yeni anahtarlar tr.ts'e (kaynak) ve 12 dile çevrilmiş olarak; ReasonCode başına nazik sebep metni ("Fotoğrafta yazı var, lütfen
  yazısız bir fotoğraf seçin" gibi). UTF-8.
- Test: accountsClient (fetch sahte), durum → metin anahtarı eşlemesi. `corepack pnpm --filter ./app typecheck` ve `test` yeşil.
- Rapor: docs/kahve/reports/E1-SONNET.md.
