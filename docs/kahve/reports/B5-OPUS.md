# B5-OPUS raporu: kart oyunları entegrasyonu (Pişti)

DURUM: TAMAM, tablet denemesi bekliyor (2026-11-16). Dal feat/kahve-b5, push yok. types.ts / protocol.ts / package.json / lockfile değişmedi.
Batak: B3 birleşince aynı yoldan ikinci tur (ayrı kısa onay).

## Commit'ler (sırayla)
- `9ee9a77` plan, `2c6fd37` plan onayı (4 kişide varsayılan tekli)
- `90fa471` (b) `app/src/net/localHost.ts`: cihazdaki masa (Room'un saat / bildirim dondurma / seed / toplam mantığının kopyası) + `server/test/local-host-equivalence.test.ts`
- `6f98882` (b2) Room ve LocalHost, `clock` taşıyıp `turnMsLeft` taşımayan görünümlere (kart oyunları) sunucu saatiyle `turnMsLeft` ekler (cihaz saati kaymasına karşı). Okey görünümleri aynen.
- `1636be0` (c) `useKahveGame`, `cardSummary`, `TableClient`
- `0285c54` (e) `GameLobby`, kart salonu (özel masa, kodla katıl), i18n
- `2ff240b` feat/kahve birleşimi (B2 + B4); i18n çakışması iki tarafın anahtarları korunarak çözüldü, 13 dil dosyası eşit (311 anahtar)
- `3e60327` (a) catalog: pisti aktif, tip yeniden ihracı, testler
- `feffbc1` (d) sunucu uçtan uca testi (gerçek pişti masası, socket üzerinden)
- `54af6bd` (f) PistiScreen gerçek PistiView'a bağlandı
- `045eb56` (g) App.tsx yönlendirme, geri tuşu, son oynadığın
- `2b54336` LocalHost = Room eşdeğerliği pişti için de (2, 4 tekli, 4 eşli, maç sonuna kadar)

## Ne yapıldı
- **catalog**: `packages/catalog/src/pisti.ts` → `pistiDef` + `PistiView/PistiAction/PistiOptions/Capture/PublicAction` tipleri. App tipleri buradan alır (app package.json'a dokunmadan).
- **LocalHost** (saf TS, React/zamanlayıcı yok): `start/act/runDue/nextRound/view/matchOver/due`. Eşdeğerlik testi Room ile yan yana koşar ve her adımda durum, iki koltuğun görünümü, saat, toplamlar, tur, maç sonu ve log'u karşılaştırır: stub (2/4), bildirimli stub (dondurma), 101 ve düz okey, pişti 2 / 4 tekli / 4 eşli maç sonuna kadar, replay. Bilerek bozulan iki kopya (bot tuzu, bildirimde bot beklemesi) testi düşürdü.
- **useKahveGame(gameId, serverUrl)**: çevrimdışı LocalHost (tek zamanlayıcı `due`, bildirim bitince yeniden çizim); çevrimiçi protokol v2, kendi socket'i yalnız kart lobisi/oyunu açıkken (useOkey değişmedi), `room:create/join/quickPlay` `game` ile, zarfta yalnız kendi oyununun görünümü, `salon:watch(true,{games:[id]})`, yeniden bağlanınca koltuk geri alma, eski sunucuya karşı `serverUpdating`.
  Dönüş: `view, viewAt, room, seat, session, act, nextRound, leave, matchOver, summary, humanCount, busy, error, playOffline, createRoom, joinRoom, quickPlay, start, salon, watchSalon, connected, mode`.
- **RoundSummary**: `cardSummary` (saf). Eşli pişti [A,B,A,B] → iki takım satırı ("Sen & Ayşe"), kazanan takımın iki koltuğu kazanır; maç bitince toplamlara göre. Hook el başına TEK özet nesnesi üretir (görünümün kendi `round`'u + masa id anahtarı), bu yüzden geç gelen room:state ya da yeni dağıtımın önden gelen room:state'i GameShell'in reklam sayacını iki kez saydırmaz. Sayma yalnız GameShell'de; App'teki okey sayacı kart görünümünü görmez.
- **GameLobby**: Hemen Oyna (botlarla, internetsiz; 2/4 kişi, 4'te Tekli varsayılan, Eşli anahtar; son seçim `kahve.setup.<oyun>` ile hatırlanır) + Arkadaşlarla (o oyuna filtreli Salon). Salon/WaitingRoom `TableClient` alır; kart oyununda okey mod düğmeleri gizli, "Özel masa" ve "Kodla katıl" eklenir (şifreli masa kodu girilince şifre kutusu açılır). Okey akışı aynen.
- **PistiScreen bağlama** (düzen aynen): props `view (PistiView & HostTimes), viewAt, room, seat, summary, humanCount, onAction, onNextRound, onLeave`. Toplam/bağlantı/bot RoomInfo'dan; geri sayım `turnMsLeft`'ten saniyede bir; pişti durumu ve ses/titreşim yalnız son kartla olan yakalamada ve bir kez (görünümler her seferinde yeni nesne); ses yalnız `cardSfx` üzerinden (ses dosyası kaydı yokken sessiz). Android geri → çıkış onayı. Önizleme mock'ları gerçek görünüme çevrildi.
- **fakeTypes**: Card/Suit/Rank artık `@kahve/cards`; pişti tipleri silindi; Batak tipleri B3'e kadar kalıyor.
- **App.tsx**: Kağıt Masaları → OyunSecimi → GameLobby(pisti) → (çevrimiçi) WaitingRoom → PistiScreen. Geri: oyun→onay→lobi, bekleme→masadan kalk→lobi, salon listesi→lobi, lobi→oyun listesi, liste→salon. "Son oynadığın" her oynanabilir oyunu hatırlar, kart oyununda doğrudan lobisini açar.
- **Sunucu testi** `server/test/cards-e2e.test.ts`: iki kişi create→join→(dolunca kendiliğinden başlar)→tam el→toplam = el puanı→nextRound; 4 eşli 1 kişi + 3 bot: toplamlar [A,B,A,B], takımlar [0,1,0,1]; v1 istemci pişti masasını salonda görmez, join `ERR_UPDATE_APP`. 3 kez üst üste yeşil.

## Değişen mevcut testler (pişti artık "Yakında" değil)
- `packages/catalog/test/catalog.test.ts`: aktif liste `['okey101','okeyDuz','pisti']`, `getDefinition('pisti') === pistiDef`.
- `server/test/room-generic.test.ts` G3 ve `server/test/server-generic.test.ts` "Yakında" örneği: `pisti` → `batak`.

## Kabul
Kökte `pnpm test` (son koşu, 2b54336):
```
packages/game-core test:       Tests  41 passed (41)
packages/cards test:       Tests  36 passed (36)
shared test:       Tests  104 passed (104)
packages/pisti test:       Tests  46 passed (46)
packages/catalog test:       Tests  66 passed (66)
app test:       Tests  30 passed (30)
server test:       Tests  75 passed (75)
```
Toplam 398 (B5 öncesi 328 + B2'nin 46'sı = 374; B5 +24). `pnpm typecheck`: tüm paketler `Done`.
`npx expo export --platform android`: `index-*.hbc` **5.5 MB**, 1482 modül, 7 ses varlığı (okey), 28,7 s.

## Tablette deneme adımları (koordinatör)
Test yapısı: memory'deki "Kahve Test" tarifi, bu dalın son commit'inden.
1. **Pişti 2 kişi botlarla**: Salon → Kağıt Masaları → Pişti → "2 kişi" → Hemen Oyna. İlk tur saat 60 sn, sonra 30 sn sayar; süre biterse kart kendiliğinden atılır. Eşleşen/vale kartları yeşil çerçeveli; pişti olunca üst satırda "PİŞTİ! (+10)" ve titreşim (ses yok, dosya yok). El bitince özet: Sen/rakip, bu el, toplam; "Sonraki el". 51/101/151'e ulaşınca "Yeni maç" ve toplamlar sıfırlanır. Reklam yalnız GameShell'in mola kuralıyla, el başına bir sayım.
2. **Pişti 4 kişi botlarla**: lobide "4 kişi" (Tekli seçili gelir) → Hemen Oyna: 3 rakip paneli, özet 4 satır. Sonra "Eşli" → Hemen Oyna: özette 2 takım satırı ("Sen & …"), ortak puan, takımca kazanma. Lobiye dönünce son seçim (4 kişi, eşli) hatırlanmış olmalı (uygulamayı kapatıp açınca da).
3. **Geri tuşu**: oyunda → çıkış sorusu (ikinci basış kapatır), "Ayrıl" → lobi; lobide → oyun listesi; listede → salon. Salona dönünce "Son oynadığın: Pişti · Devam" → doğrudan Pişti lobisi.
4. **Yerel sunucuda iki cihaz**: PC'de bu dalda `corepack pnpm server` (3001). Geliştirme yapısında salon ekranındaki sunucu adresi alanına `http://<PC-IP>:3001` (ya da yapıyı `EXPO_PUBLIC_SERVER_URL` ile). Cihaz A: Pişti → (2 kişi) → Arkadaşlarla → Masa aç → bekleme odası. Cihaz B: Pişti → Arkadaşlarla → masa listede → Otur → masa dolunca kendiliğinden başlar. Bir el oynayın, "Sonraki el". Ayrıca: Şifreli masa (6 hane, B listede kilitli görür, şifreyle oturur); Özel masa (listede yok, A'nın ekranındaki 5 harfli kodu B "Kodla katıl"a yazar); B'nin uygulamasını kapatıp açmak → bot oynar, B geri gelince koltuğu geri alır. Okey salonunda (101/Düz) pişti masası görünmemeli.
5. **Okey regresyonu**: 101 ve Düz Hemen Oyna, okey salonu ve bekleme odası eskisi gibi.

## Açık noktalar
- Çevrimiçi pişti için Raspberry Pi sunucusunun bu dalla güncellenmesi gerekir; eski sunucu `serverUpdating` döner (beklenen davranış).
- GameShell sayacı ekran içinde: PistiScreen özet açıkken yeniden mount olursa el iki kez sayılabilir. Aynı masada key = masa id olduğundan beklemiyorum; tablette özet açıkken arka plana alıp dönmek kontrol edilebilir.
- useKahveGame'in React katmanı birim testli değil (uygulamada render test aracı yok); mantık LocalHost eşdeğerlik testi, cardSummary/msLeftNow/tableSetup testleri ve sunucu e2e ile kapsandı.
- Yeni 12 i18n anahtarı 11 dilde İngilizce (çeviri bekliyor). B4'ün anahtarları kendi durumunda.
- Kart sesleri: `registerCardAudioSource` ile .wav kaydı yapılınca çalar; şu an sessiz.
- `cards-preview` ekranı uygulamaya bağlı değil (yalnız geliştirici önizlemesi), derleniyor.
- Expo export boyutu önceki sürümle karşılaştırılmadı (yalnız bu dalın değeri).

---

# İkinci tur: Batak (2026-11-16)

DURUM: TAMAM, tablet denemesi bekliyor. feat/kahve (80537c6: B5, ed2d3eb: B3) birleştirildi, çakışma yok.

## Commit'ler
- `a9e7973` host (Room + LocalHost), kendi `turnMsLeft`'i olmayan HER görünüme sunucu saatiyle `turnMsLeft` ekler (Batak görünümünde `clock` alanı hiç yok). Okey görünümleri aynen; mevcut testler yeşil.
- `862da37` (a) catalog: `batakDef` aktif, `packages/catalog/src/batak.ts` tip ihracı (`BatakView/BatakAction/BatakOptions/BatakPhase/BatakPlayerPublic/TrickCard/CompletedTrick`), `batak-catalog.test.ts`. "Yakında" örneği testleri `batak` → `tavla` (catalog.test, room-generic G3, server-generic).
- `da05785` (d) `cards-e2e.test.ts`'e Batak: 1 kişi + 3 bot dört koltuğu doldurur, ihale (kişi pas geçer; zorla ihale ona kalırsa maça seçer), 13 löve, toplam = el puanı, `turnMsLeft` alanı, sonraki el `bidding` ile başlar. LocalHost = Room eşdeğerliği Batak için iki maç sonuna kadar + replay.
- `093a08d` (f)(g) BatakScreen gerçek BatakView'a bağlandı, fakeTypes'tan Batak görünüm tipleri silindi (yalnız UI yardımcıları ve bileşen prop'ları kaldı; TrickArea tipleri catalog'dan). App Batak'ı aynı GameLobby'den geçirir.

## Bağlama ayrıntıları (B3 raporundaki farklar)
- `turn` null olabilir; toplam/bağlantı/bot RoomInfo'dan; `result` yalnız `{scores}` → özet hook'tan (`cardSummary`, koltuk başına satır).
- İhaleci rozeti `view.declarer ?? view.highestBidder`.
- Löve tamamlanınca `currentTrick` boşalıyor: sıradaki kart açılana kadar masada `lastTrick` gösteriliyor (aksi halde dördüncü kart hiç görünmezdi). Yalnız son löve görünür (KURALLAR §7).
- Löve sesi/titreşimi löve sayısı artınca bir kez (`cardSfx`, ses dosyası yokken sessiz). Android geri → çıkış onayı. Geri sayım `turnMsLeft`'ten.
- GameLobby: Batak `seatChoices [4]` → koltuk seçici ve eşli anahtarı görünmez; Hemen Oyna / Arkadaşlarla aynen.

## Kabul
```
packages/game-core test:       Tests  41 passed (41)
packages/cards test:       Tests  36 passed (36)
shared test:       Tests  104 passed (104)
packages/pisti test:       Tests  46 passed (46)
packages/batak test:       Tests  60 passed (60)
packages/catalog test:       Tests  75 passed (75)
app test:       Tests  30 passed (30)
server test:       Tests  77 passed (77)
```
Toplam 469; tüm paketlerde typecheck `Done`. `npx expo export --platform android`: hbc **5.5 MB**, 1493 modül.

## Tablette Batak adımları
1. Salon → Kağıt Masaları → Batak → lobi (koltuk seçici yok) → Hemen Oyna: 3 bot rakip. Sıra sende gelince ihale kutusu (en az 5, pas); ihaleyi alırsan koz kutusu. Oyun: yalnız yasal kartlar oynanabilir (renge uy, büyüt, koz kuralları); dördüncü kart atılınca löve masada kalır, kazanan açınca kalkar.
2. El sonu özet 4 satır (bu el / toplam); 5 el sonunda (varsayılan hedef) "Yeni maç". Geri tuşu: oyunda onay → lobi → oyun listesi → salon; "Son oynadığın: Batak" lobiye götürür.
3. İki cihaz yerel sunucuda: A Batak → Arkadaşlarla → Masa aç; B listede görür → Otur; A "Botlarla başlat" (dört koltuk iki botla dolar). Bir el oynayın. Pişti salonunda Batak masası görünmemeli.
4. Pişti ve okey regresyonu (ilk turdaki adımlar).

## Açık noktalar (ek)
- Batak varyantları (Koz Maça, Eşli, Gömmeli) motor kapsamı dışında; lobide ayar yok, `ihaleli` sabit.
- Ses dosyaları yokken kart sesleri sessiz.
- Pi sunucusu güncellenmeden çevrimiçi Batak `serverUpdating` döner.
