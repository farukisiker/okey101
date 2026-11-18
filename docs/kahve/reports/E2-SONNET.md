# E2-SONNET raporu: masada sohbet (Kahve Sözleri, sesli masa, şikâyet ve engelleme), app/

Tarih: 19.11.2026. Commit/push yok. `shared/`, `server/`, `packages/accounts` ve `C:/Users/mfaru/okey101/okey101` dokunulmadı.
Sonuç: `corepack pnpm --filter ./app typecheck` yeşil, `corepack pnpm --filter ./app test` yeşil (14 dosya, 193 test; shared tiplerine geçişten sonra tekrar koşuldu).

## 1. Paketler (sürümler peerDependencies okunarak seçildi)

| Paket | Sürüm | Uyum |
|---|---|---|
| `@livekit/react-native` | 3.2.0 | peer: react/react-native `*`, `livekit-client ^2.20.0`, `@livekit/react-native-webrtc ^150.2.0` |
| `@livekit/react-native-webrtc` | 150.2.0 | peer: react-native `>=0.60.0` |
| `@livekit/react-native-expo-plugin` | 1.2.0 | peer: expo `*`, react-native `*`, yukarıdaki ikisi |
| `@config-plugins/react-native-webrtc` | 15.0.2 | peer: expo `>=56` (Expo 58 uygun) |
| `livekit-client` | 2.24.1 | **görevde listelenmeyen ama zorunlu peer**: `@livekit/react-native` onu ister (^2.20.0 sağlanıyor). Başka paket eklenmedi. |

Uyumsuzluk çıkmadı, sürümler sabitlendi (`^`/`~` yok). `npx expo config --type prebuild` hatasız çözüyor.
Not: `pnpm add` kilit dosyasında 120 paket ekledi ve ilgisiz 60 eski isteğe bağlı kaydı (`@noxcturnal/*` platform ikilileri) düşürdü; `pnpm-lock.yaml` Fable'ın incelemesine açık.

## 2. app.json

- Plugin: `@livekit/react-native-expo-plugin`, `@config-plugins/react-native-webrtc` (`microphonePermission`: sade İngilizce metin, "kullanılır sadece masadakilerle konuşmak için, sen açınca, ses kaydedilmez"; `cameraPermission`: image-picker ile aynı metin, böylece sıra ne olursa olsun çakışmaz).
- `RECORD_AUDIO` yalnız webrtc plugin'inden gelir; image-picker ve expo-audio `microphonePermission: false` olarak kaldı (prebuild config çıktısında RECORD_AUDIO listede bir kez).
- **Ek (sayfada istenmeyen, gerekçeli):** `android.blockedPermissions: ["android.permission.SYSTEM_ALERT_WINDOW"]`. webrtc plugin'i ses işi için gereksiz `SYSTEM_ALERT_WINDOW` (ve yalnız ses uygulamasında `CAMERA`) ekliyor. SYSTEM_ALERT_WINDOW Play incelemesinde sorun çıkarır, o yüzden engellendi. `CAMERA` zaten profil fotoğrafı için image-picker'da vardı. Bundle id, sürüm, reklam kimlikleri değişmedi.

## 3. Yeni ve değişen dosyalar

Yeni:
- `app/src/net/social.ts` — saf mantık: sözler/emoji (yerel kopya, aşağıya bak), `parseSaid`, bekleme süresi (2 sn), balon (4 sn, koltuk başına 1), koltuk listesi (`tableSeats`, `otherPeople`), engelli/susturulmuş koltuklar, ses kimliğinden koltuk (`s<seat>-...`), `voiceDefault`.
- `app/src/net/blocks.ts` — engel listesi sınıfı (cihaz kopyası + sunucu birleştirme, en fazla 500, sunucu hatasında yerel engel kalır).
- `app/src/net/blockStore.ts` — uygulamadaki tek örnek (AsyncStorage + accounts).
- `app/src/net/voice.ts` — `VoiceController` durum makinesi (unavailable/idle/connecting/connected/failed), `loadLiveKit()` (native yoksa `null`).
- `app/src/net/TableSocial.tsx` — `TableSocialProvider` + `useTableSocial` + `voiceAvailable()`.
- `app/src/components/TableSocialUI.tsx` — üst çubuk düğmeleri, balonlar, mikrofon düğmesi, Söz paneli, Oyuncular paneli, şikâyet sebebi listesi, izin açıklama penceresi.
- Testler: `test/social.test.ts`, `test/blocks.test.ts`, `test/voice.test.ts`; `test/accountsClient.test.ts` sonuna E2 bloku.

Değişen:
- `app/src/net/useKahveGame.ts` — `table:said` dinleme, `say`, `subscribeSaid`, `fetchVoiceToken`; `room:create/join/quickPlay` isteklerine `accountId` (accounts açıksa, 1,5 sn'de vazgeçer), `room:create`'e `voice`.
- `app/src/net/tableClient.ts` — `createRoom(..., extra?: { voice?: boolean })`.
- `app/src/net/accountsClient.ts` — `report`, `getBlocks`, `blockAccount`, `unblockAccount`, `myAccountId`; `Me.voiceBannedUntil?`.
- `app/src/components/GameShell.tsx` — çubuğa Söz ve Oyuncular düğmeleri, üstte sosyal katman (ortak, tüm oyunlar).
- `app/src/App.tsx` — ekranlar `TableSocialProvider` içine alındı.
- `app/src/screens/Salon.tsx` — kart masalarında "Sesli masa" anahtarı.
- `app/src/i18n/tr.ts` + 12 dil dosyası: 52 yeni anahtar (gerçek çeviri; sözler `say...` ile başlar). UTF-8, dosyaların CRLF yapısı korundu.

## 4. Davranış

- **Söz paneli:** 💬 Söz → 10 hazır söz + 6 emoji; başarıda kapanır, 2 sn dolmadan gri ve "Biraz bekleyin"; sunucu hatası kısa bildirimle gösterilir. Kendi sözün kendi ekranında balon olmaz.
- **Balon:** gelen söz 4 sn görünür, sağ üstte "ad + söz" kartı. Engelli oyuncunun sözü hiç gösterilmez, engellenince eldeki balonu da silinir.
- **Mikrofon:** sağ altta 64 dp daire. Kapalı: koyu daire + kırmızı çerçeve + ✕; açık: yeşil daire + ● ; yanında yazılı "Mikrofon açık/kapalı". Masaya girince kapalı. Masa sesli değilse veya native modül yoksa hiç görünmez. İlk açışta izin öncesi sade açıklama penceresi (bir kez, AsyncStorage). Konuşan, "🔊 Ali konuşuyor" kartıyla gösterilir. Şikâyetle kapanmışsa (`Me.voiceBannedUntil`) düğme gri ve "Sesli sohbet 24 saat kapalı"; açık mikrofon da kapatılır.
- **Ses modu:** konuşma (echo/gürültü/otomatik kazanç açık; Android `communication`, iOS `playAndRecord`/`voiceChat`, hoparlör varsayılan). Kayıt yok. Masadan çıkınca oda ve ses oturumu kapanır.
- **Oyuncular paneli (👥):** her insan rakip için Sustur/Sesi aç (sadece sesli masada), Engelle/Engeli kaldır, Şikâyet et (5 sebep). Engelli: "⛔ Engelli", susturulmuş: "✕ Sessiz" (renk + şekil). Susturma kişiye bağlı (hesap veya ad), koltuğa değil: yerine biri otururken biter. Engellenen kişinin sesi de kapatılır.
- **Lobi:** Salon'da kart oyunları için "Sesli masa" anahtarı. Dokunulmazsa şifreli ve özel (kodlu) masa açık, açık masa kapalı; dokunulursa seçim geçerli.
- **Native yok:** `loadLiveKit()` içindeki `require` hata verirse `null`; Provider sesi kapatır, Salon anahtarı gizlenir. Söz/engel/şikâyet native'e bağlı değil, çalışır.

## 5. Fable'ın bilmesi gerekenler (sözleşme boşlukları, varsayımlar)

1. **Tipler shared'dan:** sunucu ajanının `shared/src/protocol.ts` eklemeleri (`QUICK_SAYINGS`, `QUICK_EMOJI`, `TableSaid`, `VoiceTokenResult`, `RoomInfo.voice`, `SeatInfo.accountId`, `room:create/join/quickPlay` yükünde `accountId`, create'te `voice`, `table:say`, `voice:token`, `table:said`) artık doğrudan import ediliyor; yerel kopya ve `as never` dönüşümleri kaldırıldı. `app/src/net/social.ts` bunları yeniden dışa veriyor.
2. **Alan adları:** `accountId` ve `voice` istemciden `room:create` / `room:join` / `room:quickPlay` yükünün üst düzey alanı olarak gidiyor (protokolle birebir uyumlu; yeniden bağlanmadaki `room:join` da `accountId` taşır). Handshake `auth.accountId` kullanılmıyor.
3. **RoomInfo:** `room.voice` ve `room.seats[i].accountId` okunur, yoksa (eski sunucu) sesli masa kapalı sayılır, şikâyet/engel hedefi bulunamaz ("Bu oyuncuya bu işlem yapılamıyor").
4. **Hata kodu:** accounts `bad_request` (kendini şikâyet vb.) "yapılamıyor", diğerleri "tekrar deneyin" gösterir.

## 6. Açık riskler

- **Cihazda denenmedi.** Native modüller yalnızca prebuild/EAS geliştirme derlemesinde çalışır; ses akışı, izin penceresi, yankı, Bluetooth yönlendirme, iOS `NSMicrophoneUsageDescription` çıktısı ve Android manifestinin son hali tabletle (Kahve Test build) doğrulanmalı. Test edilenler: durum makinesi (LiveKit sahte), saf mantık, accounts istemcisi.
- **Düzen:** Söz ve Oyuncular düğmeleri üst çubukta (sağ altta değil), sadece mikrofon sağ altta. Gerekçe: sağ alt elin/rafın üstünü örter, çubukta yer var. Sağ alttaki mikrofon dar telefonda raf/el kartlarının sağ ucunu örtebilir; tablette kontrol edin. Üst çubuk dar telefonda kalabalık (Çık, durum, saat, Söz, Oyuncular, ses); "Oyuncular" yazısı küçülebilir.
- **Uzun basma yok:** rakip paneline uzun basma menüsü yapılmadı; panel bileşenleri (`CardOpponentPanel`, tavla `PlayerBar`) Antigravity'nin dosyaları. Yerine 👥 Oyuncular paneli var. Balon da oyuncunun panelinin yanında değil, sağ üstte ad etiketiyle çıkıyor. İsterseniz paneller `useTableSocial()` ile bağlanıp ikisi de yapılabilir (küçük iş).
- **Okey ekranı** (`GameScreen`) `GameShell` kullanmıyor ve kendi istemcisini kullanıyor: sohbet/ses yalnız kart ve tavla masalarında. Okey masalarında yok.
- **Sesli masa katılımı:** oyun başlayınca (`room.started`) bağlanılır, bekleme odasında bağlanılmaz. Sunucu tarafı zorlaması (yasaklı hesap) E2b'de; şimdilik sadece istemci mikrofon kilidi.
- **Offline (botlu) masalar** sosyal katmanı hiç göstermez.
- Otomatik yeniden bağlanma: LiveKit kendi içinde dener; bağlantı koparsa durum "idle" olur, mikrofon düğmesine dokunmak yeniden bağlar. Daha fazlası E2'de yok.
- `sayWait` metni hem panel başlığı hem sunucu 2 sn kuralı içindir; sunucu dakikada 15 sınırı için ayrı yerel sayaç yok (sunucu hata döner, bildirim gösterilir).
