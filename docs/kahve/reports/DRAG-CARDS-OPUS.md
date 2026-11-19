# DRAG-CARDS: Pişti ve Batak'ta sürükle-bırak (dokunmaya ek olarak)

Branch `feat/kahve` (worktree `kahve`), Claude Opus, 19.11.2026. Commit yok.

## İstek

"Sürükle bırak hepsinde ek olarak olsun." Bu raporun kapsamı kart oyunları: Pişti ve Batak.
Tavla'yı başka bir ajan yapıyor; Okey'e dokunulmadı.

## Ne yapıldı

- **Pişti:** elden bir kart ortadaki yığına sürüklenip bırakılınca oynanır. Bu, kartı seçip
  "Kartı Oyna"ya basmakla aynı işlemdir (`handlePlayCard`).
- **Batak:** elden bir kart ortadaki el (trick) alanına bırakılınca oynanır.
- Dokunarak seçme, ikinci dokunuşla oynama, "Kartı Oyna" düğmesi ve yığına dokunma eskisi gibi
  çalışıyor. Ekran okuyucu da yine dokunma + düğme yolunu kullanıyor: her kart hâlâ
  `accessibilityRole="button"` olan bir `Pressable`.

## Nasıl çalışıyor

1. **Kim sürüklenebilir:** yalnızca sıra bendeyken, yalnızca oynanabilir kartlar. Liste, elin
   kartları soluklaştırmak için kullandığı listeyle aynı: Pişti'de `view.playableCardIds`, Batak'ta
   `view.legalCardIds` (renk uyma kuralı motordan gelir). Batak'ta ihale ve koz seçimi sırasında
   sürükleme kapalı. Bu kural saf `canDragCard` fonksiyonunda.
2. **Dokunma dokunma olarak kalır:** pan hareketi yukarı doğru 10 dp'de, diğer yönlerde 28 dp'de
   başlar (`activeOffsetY [-10, 28]`, `activeOffsetX [-28, 28]`). Kısa bir dokunuş ya da yana kayan
   titrek bir parmak (Batak yelpazesinde de) sürükleme sayılmaz. Pan başladığında
   gesture-handler `Pressable`'ı iptal eder (`cancelsJSResponder`, varsayılan açık), yani bir
   sürükleme aynı anda dokunma da sayılmaz.
3. **Sürüklerken:** kart parmağın 28 dp üstünde gider, %15 büyür, yelpaze eğimi düzleşir ve diğer
   kartların üstüne çıkar (zIndex 100). Bırakma alanı kesik çizgili bir çerçeve gösterir. Kart
   alanın üstüne gelince çerçeve 6 dp kalın ve düz olur, hafif parlar, alan %4 büyür ve üstte
   yuvarlak bir "▼" ok belirir. Sadece renk değişmiyor, şekil de değişiyor. Bunların hepsi UI
   thread'de shared value ile çalışır, sürükleme sırasında React yeniden çizim yapmaz.
4. **İsabet testi:** alan, pencere koordinatlarında `measureInWindow` ile ölçülür. Ölçüm hem
   `onLayout`'ta hem her sürüklemenin başında yapılır, bu yüzden ekran döndürülünce ve compact
   (telefon) / tablet düzeninde doğru kalır. Okey'in rafı da aynı koordinat sistemini kullanıyor
   (gesture'ın `absoluteX/Y` değeri). İsabet, parmağın değil kartın merkezine göre hesaplanır
   (`heldCardCentre`: tutma noktası ve kaldırma payı çıkarılır).
5. **Geniş isabet alanı (`DropPad`):** Pişti yığınında yanlara ve yukarı en az 40 dp (yaklaşık bir
   kart), aşağı sadece 8 dp. Batak trick alanı zaten masanın ortasının tamamı, orada 16 dp yeter.
   Aşağı payın küçük olmasının nedeni şu: el, alanın hemen altında duruyor ve biraz kıpırdatılan bir
   kart yanlışlıkla oynanmamalı.
6. **Bırakma:** kart alanın üstündeyse ekranın `onDropCard` fonksiyonu çağrılır. Bu fonksiyon
   kuralı JS tarafında bir daha kontrol eder (sıra, yasal kart) ve oynar. Kart, yeni görünüm onu
   elden çıkarana kadar bırakıldığı yerde bekler, böylece "gidip geri gelme" olmaz (Okey'deki
   FIX-DRAG dersi). Oynama reddedilirse, ya da 2,5 saniye içinde görünüm gelmezse, kart yerine
   kayarak döner. Alanın dışına bırakılan kart da yerine kayar.

## Dosyalar

- `app/src/components/cards/cardDrag.ts` (yeni, saf): `hitDropZone`, `heldCardCentre`,
  `pistiDropPad`, `trickDropPad`, `canDragCard` ve eşik sabitleri. RN import'u yok, worklet olarak
  da çalışıyor.
- `app/src/components/cards/CardDropZone.tsx` (yeni): `useCardDropTarget(pad)` hook'u (ref, ölçülen
  dikdörtgen, `armed` ve `over` shared value'ları) ve vurguyu çizen `CardDropZone` sarmalayıcısı.
- `app/src/components/cards/Hand.tsx`: her kart artık bir `HandCard`. Bu, `GestureDetector`
  (pan) + `Animated.View` + eski `Pressable`'dan oluşuyor. Yeni opsiyonel prop'lar: `dropTarget` ve
  `onDropCard`. Bu prop'lar verilmezse sürükleme kapalı, davranış eskisiyle aynı. `fanGeometry`
  artık `at(i)` ile yükseklik ve açı veriyor.
- `app/src/components/cards/fakeTypes.ts`: `HandProps` içine `dropTarget` ve `onDropCard` eklendi.
- `app/src/components/cards/index.ts`: yeni dosyalar dışa aktarıldı.
- `app/src/screens/PistiScreen.tsx`: yığın `CardDropZone` ile sarıldı; `handleDropCard` eklendi.
- `app/src/screens/BatakScreen.tsx`: trick alanı `CardDropZone` ile sarıldı; `handleDropCard`
  eklendi.
- `app/test/cardDrag.test.ts` (yeni): 13 test.

Yeni paket yok. `server/`, `shared/`, `packages/`, Okey ve Tavla dosyalarına dokunulmadı.

## Testler

- `test/cardDrag.test.ts`: isabet testi (içerisi, kenarlar, dışarısı, pad'in yanlara/yukarı geniş
  aşağı dar olması, ölçülmemiş alan), kart merkezi hesabı, pad boyutları, sürükleme izni (sıra yok,
  yasal olmayan kart, alan yok, boş liste) ve eşikler. Ayrıca "elde duran kart hiçbir zaman alanın
  üstünde sayılmaz" kontrolü var: 4 ekran boyutunda, 4 ve 13 kartlık el için `computeCardLayout`
  ile hesaplanıyor.
- `corepack pnpm --filter ./app typecheck`: temiz.
- `corepack pnpm --filter ./app test`: kart testleri dahil 15 dosyada 217 test geçiyor. Tam koşuda
  tek kırmızı `test/tavlaDrag.test.ts` ("dropAt: on a target, a near miss, a real miss"). Bu dosya
  paralel çalışan Tavla ajanının, şu an yazılmakta olan işi; bu işle ilgisi yok.

## Riskler / cihazda bakılacaklar

- **Cihazda denenmedi.** Tablette (USB tablet, Kahve Test build) kontrol edilmesi gerekenler:
  kısa dokunuşun hâlâ seçmesi, Batak yelpazesinde üst üste binen kartlarda doğru kartın
  tutulması, yukarı sürüklemenin hemen başlaması, vurgunun görünmesi ve kartın yığına/alana
  bırakılınca oynanması.
- `Pressable` artık bir `Animated.View` sarmalayıcısının içinde. Kartın konumu, genişliği,
  `marginLeft` değeri, zIndex'i ve yelpaze dönüşü sarmalayıcıya taşındı. Görünüm aynı olmalı, ama
  Batak'ta seçili kartın yükselmesi gözle kontrol edilmeli.
- Online oyunda sunucu yanıtı gecikirse, bırakılan kart görünüm gelene kadar yığının üstünde
  bekler. 2,5 saniyeyi aşarsa önce yerine döner, görünüm gelince de kaybolur.
- Android'de `shadow*` özellikleri çizilmez. Orada "parlama" yerine kalın düz çerçeve, açık sarı
  zemin ve ▼ oku görünür.
- Sürüklenen kart `Hand` içinde çiziliyor. `Hand`, masa ortasından sonra geldiği için kart
  yığının/alanın üstünde görünür. Üst başlığa (GameShell header) doğru sürüklenirse başlığın
  altında kalabilir, ama bu bırakma alanının dışında.
