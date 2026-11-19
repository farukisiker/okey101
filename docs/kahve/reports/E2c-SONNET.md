# E2c (Sonnet): Okey masalarında hazır sözler ve oyuncular paneli

## Karar
Uygulanabilir, yapıldı. Bulgular:
- Online Okey zaten v2 soketle çalışıyor: `useOkey.ts` auth'ta `v: PROTOCOL_VERSION` (=2) gönderiyor. Yani v1 sorunu yok; Okey oyunu (kurallar, görünüm zarfı) değişmedi.
- Sunucu `table:say` / `table:said`'ı oyun ayırt etmeden her v2 oda için işliyor (`server.ts`: `roomOf` + `isV1` kontrolü). Okey odaları da aynı `Room` yolundan geçtiği için ek sunucu değişikliği gerekmedi.
- Masa kartı (tablePass): sunucu `accountOf` ile `room:create/join/quickPlay` yükü ve el sıkışmadaki `tablePass`'i okuyor; Okey odalarında da geçerli. `useOkey` artık bunu `useKahveGame` gibi gönderiyor (hesaplar açıksa; yoksa misafir).

## Dosyalar
- `app/src/net/myTablePass.ts` (yeni): `useKahveGame`'deki yardımcı buraya taşındı, iki hook da kullanıyor.
- `app/src/net/useOkey.ts`: `say`, `subscribeSaid`, `table:said` dinleyicisi; auth ve `room:create/join/quickPlay` + yeniden bağlanmada `room:join` içinde `tablePass`.
- `app/src/net/useKahveGame.ts`: yalnız `myTablePass` içe aktarımı.
- `app/src/net/TableSocial.tsx`: sağlayıcı artık `SocialClient` arayüzü alıyor (`KahveClient` olduğu gibi uyar). `fetchVoiceToken` isteğe bağlı; yoksa ses kapalı.
- `app/src/App.tsx`: `okeySocial` (online.session/room/say/subscribeSaid) sarmalayıcısı; kart masası yoksa sağlayıcıya o verilir.
- `app/src/screens/GameScreen.tsx`: üst şeritte ses düğmesinin yanına 💬 (Söz) ve 👥 (Oyuncular) simge düğmeleri, `social.layer`. Yalnız masada başka insan varsa çizilir; aksi halde (offline, sadece botlar) hiçbir şey değişmez.
- `app/src/components/OpponentPanel.tsx`: isteğe bağlı `seat` ile `SeatBubble` (rakip çipinin altında balon). Kendi sözüm köşe yığınında görünür.
- `app/src/components/TableSocialUI.tsx`: `useSocialSheets` artık `openSay/openPlayers` da döndürüyor.
- `app/src/components/Button.tsx`: isteğe bağlı `accessibilityLabel` (yalnız simge içeren düğmeler için).
Mevcut i18n anahtarları kullanıldı (`sayButton`, `tablePlayers`), yeni anahtar yok.

## Ses / mikrofon
Bilerek dışarıda: Okey istemcisine `fetchVoiceToken` verilmedi, bu yüzden mikrofon düğmesi ve LiveKit bağlantısı Okey masalarında çıkmaz (izin istemi, alt sağ düğme istif/yerleşim riski; ayrı karar). Açmak için `useOkey`'e `voice:token` ack'i ve App sarmalayıcısına `fetchVoiceToken` eklemek yeter. Not: sunucu özel masalarda `voice` varsayılanı true, ama istemci düğmeyi çizmediği için etkisi yok.

## Test
- `corepack pnpm --filter ./app typecheck`: temiz.
- `corepack pnpm --filter ./app test`: 14 dosya, 199 test geçti.
- Cihazda denenmedi (tablet testi yapılmadı).

## Riskler
- Okey üst şeridi: insan olan masalarda 2 simge düğmesi (2 x sesW + boşluk) üç rakip panelinden eşit düşülerek yer açıyor, paneller dar kalıyor (850 pt'de ~174 -> ~138). İsimler tek satır kesilir, meta satırı küçülür. Tablette gözle kontrol gerekir; dar telefonda `oppW` iyice küçülebilir.
- Hesaplar açıkken Okey masasına girmek/oluşturmak `myTablePass` (en çok 1,5 sn) bekler; kart oyunlarındaki gibi.
- Yeniden bağlanmada `room:join` artık async pass beklemesinden sonra gidiyor (kart oyunlarıyla aynı).
- Eski (v1) sunucuda `table:say` olayı yok: ack zaman aşımına düşer, "sunucu yanıt vermedi" benzeri hata gösterilir; ama yeni uygulamada v1 sunucu beklenmez.
- Köşe yığını sağ üstte (top 76) rakip/okey kutusunun üstüne gelebilir; `pointerEvents=none`, kısa süreli.
