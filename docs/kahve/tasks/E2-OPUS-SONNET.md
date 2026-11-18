GÖREV: E2 — Masada sohbet: hazır "Kahve Sözleri" + emoji, sesli masa (LiveKit), şikâyet ve engelleme
FAZ: E2 (kullanıcı 19.11.2026: denemesi Google Cloud'da yapılsın; LiveKit native modülleri 18.11.2026'da onaylandı)
KIRMIZI ÇİZGİ: push yok, Pi'ye dokunma yok (canlı Demli Okey), anahtar/parola dosyaya veya prompta yazılmaz (sadece ortam değişkeni adı),
`C:/Users/mfaru/okey101/okey101` dokunulmaz, v1 istemciler (Demli Okey ≤1.0.1) hiçbir şey fark etmez. Commit Fable'ın.
İLKELER (SOSYAL_HEDIYE §7, §10b): serbest yazı YOK (sadece hazır sözler + emoji); mikrofon masaya oturunca KAPALI, dokun-aç/dokun-kapat;
ses kaydedilmez; sesli masa sadece kurucu açtıysa; yabancılarla açık masada varsayılan sessiz; her rakip tek dokunuşla susturulur.

## Sözleşme (shared/src/protocol.ts, sadece v2 soketler; değiştirmek Fable'a sorulur)
```ts
export const QUICK_SAYINGS = ['hayirliOlsun','cayBenden','eline','gecmisOlsun','kolayGelsin','sansinBol','tebrikler','biraBekle','tesekkurler','hadiBakalim'] as const;
export type QuickSaying = typeof QUICK_SAYINGS[number];
export const QUICK_EMOJI = ['👍','😄','👏','☕','😮','🙏'] as const;
// İstemci → sunucu
'table:say': (msg: { saying?: QuickSaying; emoji?: QuickEmoji }, ack: Ack) => void   // tam olarak biri; seat sahibi insan; 2 sn'de 1, dakikada 15
'voice:token': (ack: (r: { ok: true; url: string; token: string; room: string; identity: string } | { ok: false; error: 'voice_off' | 'not_seated' | 'not_configured' }) => void) => void
// Sunucu → istemci
'table:said': (m: { seat: number; saying?: QuickSaying; emoji?: QuickEmoji; at: number }) => void
```
- Masa seçeneği `voice: boolean` (RoomOptions / setup): kurucu belirler. Varsayılan: şifreli (arkadaş) masa true, açık masa false. RoomInfo'ya `voice` eklenir (v1'e gitmez).
- RoomInfo oyuncu girişine `accountId?: string` (hello/join ile istemcinin gönderdiği, DOĞRULANMAMIŞ; sadece şikâyet/engelleme hedefi için). v1'e gitmez.
- `voice:token`: oda `voice` true, istek atan soket o masada oturan insan, ortam `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` var.
  Token: HS256 JWT (node:crypto, yeni paket yok), iss=API key, sub=identity=`s<seat>-<rastgele>`, name=oyuncu adı, `video: { room: <masaId>, roomJoin: true,
  canPublish: true, canSubscribe: true, canPublishData: false }`, ttl 2 saat. Masadan kalkınca istemci odadan çıkar (sunucu ayrıca bir şey yapmaz; E2 basit).

## Accounts sunucusu ekleri (`packages/accounts`)
| POST /v1/reports | `{ targetAccountId, reason: 'insult'|'harass'|'askGift'|'spam'|'other', context?: 'voice'|'saying'|'photo'|'name' }` | 204; hesap başına günde 20; kendini şikâyet 400 |
| GET /v1/blocks | – | `{ blocked: string[] }` |
| PUT /v1/blocks/:accountId | – | 204 (en fazla 500) |
| DELETE /v1/blocks/:accountId | – | 204 |
| GET /admin/v1/reports?status=open | admin | şikâyet listesi (hedef başına sayı, son 7 gün); admin sayfasına "Şikâyetler" sekmesi |
Aynı hedefe 7 günde 3 farklı kişiden şikâyet → hedefin `voiceBannedUntil` = şimdi+24 sa; `Me`'ye `voiceBannedUntil: number | null`. Bu E2'de sadece bilgi
(istemci kendi mikrofonunu açamaz ve "Sesli sohbet 24 saat kapalı" der); sunucu tarafı zorlaması E2b'ye kalır (oyun sunucusu hesabı doğrulamıyor).
Hesap silinince şikâyetleri (yazan olarak) ve engel listesi silinir; hakkındaki şikâyetler hedef silinince silinir.

## Opus: `shared/`, `server/`, `packages/accounts`
- Yukarıdaki sözleşme + testler: say oran sınırı, yabancı masaya say reddi, v1 soket `table:said` ALMAZ ve RoomInfo'sunda voice/accountId YOK (compat testleri),
  voice:token hata durumları, JWT imzası ve iddiaları (test içinde doğrula), accounts rapor/engel uçları (Memory + Sqlite), admin şikâyet listesi.
- `server/Dockerfile` (Cloud Run testi için; workspace paketlerini içerir) — sadece dosya, dağıtım Fable'da.
- Rapor: docs/kahve/reports/E2-OPUS.md.

## Sonnet: `app/`
- Kurulum: `@livekit/react-native`, `@livekit/react-native-webrtc`, `@livekit/react-native-expo-plugin`, `@config-plugins/react-native-webrtc` (Expo 58 /
  RN 0.88 uyumlu sürümler; `corepack pnpm --filter ./app add`). app.json plugin'leri; mikrofon izni metni (iOS NSMicrophoneUsageDescription, sade İngilizce).
  Uyumsuzluk varsa DUR ve raporla (sürüm uydurma).
- `app/src/net/voice.ts`: token al → LiveKit odasına bağlan (sadece ses), mikrofon varsayılan kapalı, ses modu konuşma (yankı engelleme), oyuncu başına
  susturma, konuşan göstergesi; masadan çıkınca bağlantıyı kapat. Native modül yoksa (Expo Go / test) sessizce kapalı.
- Masa arayüzü (GameShell ortak, tüm oyunlar): sağ altta büyük mikrofon düğmesi (●/✕ şekil + renk, ≥56 dp; masa voice değilse görünmez), ilk kullanımda
  izin öncesi sade açıklama penceresi; "Söz" düğmesi → 10 hazır söz + 6 emoji paneli; gelen söz o oyuncunun panelinin yanında 4 sn balon.
  Rakip paneline uzun basma → menü: Sustur/Aç, Engelle, Şikâyet et (sebep listesi). Engellenenin sözleri ve sesi gösterilmez/çalınmaz.
- Lobi: kurucu için "Sesli masa" anahtarı (şifreli masada varsayılan açık).
- Hazır sözlerin metinleri i18n (tr kaynak + 12 dil), anahtarlar `say` ile başlasın. 60+ kuralları. UTF-8.
- Testler: söz paneli/balon mantığı (saf fonksiyonlar), voice.ts bağlantı durum makinesi (LiveKit mock), engel listesi filtreleri.
- Rapor: docs/kahve/reports/E2-SONNET.md.
