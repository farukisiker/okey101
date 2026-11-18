# E2b — Sonnet raporu (app/)

## Yapılanlar
- `app/src/net/accountsClient.ts`: `tablePass()` eklendi. `GET /v1/me/table-pass` (Bearer) çağırır; geçişi `expiresAt`'a 10 dk kalana kadar önbellekte tutar (`TABLE_PASS_REFRESH_MS`), eşzamanlı çağrıları tek isteğe indirir. 503 / ağ hatası / bozuk yanıt / kapalı istemci -> sessizce `null`; hata önbelleğe alınmaz. Hesap değişince (misafir açma, giriş, hesap silme) önbellek atılır. Test için `now?` bağımlılığı eklendi.
- `app/src/net/useKahveGame.ts`: çıplak `accountId` kaldırıldı. `room:create`, `room:join`, `room:quickPlay` ve yeniden bağlanmadaki `room:join` artık `tablePass` gönderir (geçiş yoksa alan hiç yok, misafir gibi oturulur). Soket el sıkışması `auth` bir fonksiyon oldu: her (yeniden) bağlanmada `{ v, tablePass? }` verir. Yeniden bağlanma `room:join`'i geçişi (önbellekten) alıp sonra yollar.
- `voice.ts`: `banned` hata kodu zaten vardı (`fail` -> `error: 'banned'`, arayüzde `voiceBanned` = "Sesli sohbet 24 saat kapalı"); kod değişmedi, test eklendi.

## Testler
- `app/test/accountsClient.test.ts`: önbellek/yenileme sınırı, tek istek paylaşımı, null durumları, hata önbelleklenmez, hesap değişince önbellek düşer.
- `app/test/voice.test.ts`: sunucudan `banned` -> status failed, mikrofon kapalı, error banned.
- `app typecheck` ve `app test` yeşil (199 test).

## Açık riskler
- `shared` protokolünde `tablePass` ve `VoiceTokenResult`'taki `banned` henüz yoktu; yük alanı spread ile eklendi (tip hatası vermez), `banned` testte cast ile. Opus tarafı eklenince cast'ler kaldırılabilir.
- Geçiş alınamazsa (hesap sunucusu kapalı/sır yok, 1,5 sn zaman aşımı) kişi misafir olarak oturur: rapor/engel/ses yasağı kimliği o masada yok.
- Yeniden bağlanmada geçiş süresi dolmuşsa yenisi alınır; ağ yoksa `tablePass` olmadan oturulur.
- Gerçek sunucuyla uçtan uca deneme yapılmadı.
