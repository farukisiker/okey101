# E1a Sonnet raporu: profil ekranı + fotoğraf akışı

## Dosyalar
Yeni:
- `app/src/net/accountsClient.ts`: sözleşmenin istemci tarafı (`createAccountsClient`, fetch ve depolama enjekte edilir; React Native'e bağımlı değil, Node'da test edilir). Misafir hesap, `accounts.token`, getMe/setName/giveConsent/uploadPhoto/deletePhoto/deleteAccount, 401 olunca token silinip bir kez yeni misafir + yeniden deneme, hata kodları (`network` ve `unknown` dahil).
- `app/src/net/accounts.ts`: uygulamadaki tek örnek (AsyncStorage + `EXPO_PUBLIC_ACCOUNTS_URL`), `accountsEnabled()`.
- `app/src/net/photoPicker.ts`: galeri/kamera, `allowsEditing + aspect [1,1]`, 256x256 JPEG, sıkıştırma 0.8.
- `app/src/net/photoStatus.ts`: durum → metin anahtarı, sebep kodu → metin anahtarı, hata → metin anahtarı.
- `app/src/screens/ProfileScreen.tsx`: isim, yuvarlak foto (yoksa baş harfli renkli daire), durum (✔ / ✖ / ◷ işaretiyle), reddedilince nazik sebep metni, "Galeriden seç", "Fotoğraf çek", "Fotoğrafı kaldır", "Hesabımı sil" (onay penceresi), ilk yüklemeden önce rıza penceresi, pending/review iken ekran açıkken 5 sn'de bir `getMe`.
- `app/test/accountsClient.test.ts`: 14 test (fetch sahte).

Değişen:
- `app/app.json`: yalnız `expo-image-picker` eklentisi (photosPermission, cameraPermission, `microphonePermission: false`).
- `app/package.json`, `pnpm-lock.yaml`: iki paket.
- `app/src/App.tsx`: `profil` ekranı, donanım geri tuşu salona döner. `EXPO_PUBLIC_ACCOUNTS_URL` yoksa hiç açılmaz.
- `app/src/screens/KahveSalonu.tsx`: başlığın altında "Profilim" düğmesi (`onOpenProfile` verilmezse görünmez).
- `app/src/i18n/tr.ts` + 12 dil dosyası.

## i18n
36 yeni anahtar (hepsi `prof` ile başlar, `tavla` ile başlayan yok): 26 genel metin + 10 sebep kodu. tr kaynak, 12 dilde gerçek çeviri (en, de, es, fr, hi, id, it, ja, ko, pt, ru, zh). UTF-8 kontrol edildi (ğşı tr'de, ja/hi okunuyor, bozuk karakter yok). Çeviriler yerli gözle gözden geçirilmedi.

## Kurulan paketler
`npx expo install` pnpm'i PATH'te bulamadığı için çalışmadı (spawn pnpm ENOENT). Aynı sürümlerle `corepack pnpm --filter ./app add expo-image-picker@~58.0.10 expo-image-manipulator@~58.0.16` kullanıldı (expo'nun kendi seçtiği SDK 58 sürümleri). Başka paket yok. Not: pnpm her çalışmada "Packages: -60" yazıyor (hoisted düzenin temizliği); lock dosyası farkı yalnız bu iki paketi içeriyor.

## Testler
`corepack pnpm --filter ./app typecheck` temiz, `corepack pnpm --filter ./app test` 10 dosya / 140 test yeşil.

## Tablette denenecekler
Yeni native modül eklendi: yeni geliştirme/Kahve Test build'i gerekir (Expo Go yetmez). Build `EXPO_PUBLIC_ACCOUNTS_URL` ile alınmalı.
1. Salonda "Profilim" görünüyor mu (URL yokken görünmemeli). Geri tuşu salona dönüyor mu.
2. Rıza penceresi ilk yüklemede çıkıyor mu, "Vazgeç" hiçbir şey yüklemiyor mu.
3. Galeri ve kamera: izin istemi, kare kırpma, 256x256 gidiyor mu (sunucu 150 KB sınırı, ~20 KB beklenir). İzin reddinde mesaj.
4. Durum: İnceleniyor → Onaylandı/Reddedildi kendiliğinden değişiyor mu (5 sn). Onaylı foto dairede görünüyor mu.
5. Reddedilince sebep metni, günde 4. yükleme hata metni, "Fotoğrafı kaldır", "Hesabımı sil" onayı.
6. Sistem yazı boyutu en büyükken taşma, yatay ekranda klavye açıkken isim alanı.

## Açık riskler
- Yükleme gövdesi `fetch(uri).blob()` ile okunuyor; bazı Android sürümlerinde `file://` blob'u RN'de sorun çıkarırsa `expo-file-system` gerekir (yeni paket, onay ister). Tablette ilk bakılacak şey bu.
- Sunucu sözleşmesi dışında bir şey varsaymadım; sunucu ajanının gerçek yanıtlarıyla (özellikle 201 guest, 204 silme, `photo.url` yolu) uçtan uca denenmedi.
- `Me.photo.url` sunucuya göreli yol varsayıldı (mutlak URL gelirse de çalışır).
- Reddedilen fotoğraf için `reasons` boşsa yalnız "Reddedildi" yazar.
- Masada rakip panelinde foto, Apple/Google girişi: kapsam dışı, yer bırakılmadı (yalnız `accountId` var).
- Bundan sonrası: `expo prebuild` ile izin metinlerinin Info.plist/AndroidManifest'e düştüğü doğrulanmadı.
