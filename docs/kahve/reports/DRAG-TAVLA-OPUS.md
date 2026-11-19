# Tavla: sürükle-bırak (dokunarak oynamaya ek olarak)

Kullanıcı isteği: "Sürükle bırak hepsinde ek olarak olsun". Bu rapor Tavla kısmı (kart oyunları ayrı ajanda).
Commit/push yapılmadı. server/, shared/, packages/, Okey ve kart dosyalarına dokunulmadı. Yeni paket yok.

## Değişen / eklenen dosyalar

| Dosya | Ne |
|---|---|
| `app/src/components/tavla/dragHit.ts` (yeni) | Saf isabet hesabı: `placeAt`, `placeRect`, `pickAt`, `dropAt`, `dragPlan`; yer anahtarları (`1..24`, `PLACE_OFF`=25, `PLACE_BAR`=26, `PLACE_NONE`=0). Fonksiyonlar `'worklet'`: sürükleme sırasında UI thread'de çalışır. |
| `app/src/components/tavla/CheckerDrag.tsx` (yeni) | Tahtanın iç alanını saran tek `usePanGesture`; parmağı izleyen pul kopyası, altındaki hedefin güçlü çerçevesi, geri kayma / hedefe oturma animasyonu. |
| `app/src/components/tavla/Board.tsx` | `CheckerDrag` ile sarıldı; yeni isteğe bağlı prop'lar `drag`, `onDragStart`, `onDrop`; sürüklenen pul yerinde gizlenir (`lifted`). |
| `app/src/components/tavla/index.ts` | `dragHit` dışa aktarıldı. |
| `app/src/screens/TavlaScreen.tsx` | `drag = dragPlan(...)` (useMemo), `onDragStart`, `onDrop`; `boardEl` useMemo bağımlılıklarına `drag` eklendi. |
| `app/test/tavlaDrag.test.ts` (yeni) | 15 test. |

## Nasıl çalışıyor

- **Sürükleme kaynağı:** Sıra bendeyken ve pul oynatılabilirken (`canPlay && !busy`, ekranın zaten hesapladığı `view.moves` → `movableFroms`) oynatılabilir bir hanenin yarım sütununun herhangi bir yerinden ya da kendi bar yarımdan başlayan parmak, o hanenin en üstteki pulunu alır.
- **Dokunma aynen kalır:** Hareket `onTouchesDown`'da isabet hesabıyla kontrol edilir; oynatılabilir bir yer değilse jest hemen `GestureStateManager.fail` ile bırakılır ve alttaki `Pressable`'lar eskisi gibi çalışır. Jest ancak 10 dp hareketten sonra devreye girer (Okey ıstakasıyla aynı eşik), yani kısa dokunuş hep dokunuştur. Jest devreye girince RNGH, `Pressable`'ın dokunuşunu iptal eder (`cancelsJSResponder` varsayılanı), çift tetikleme olmaz. Geri al / Tamam / Pas değişmedi.
- **Sürüklerken:** Pul kopyası parmağın biraz üstünde (`max(16, 0.6·d)` dp; parmak pulu kapatmasın) %18 büyük çizilir. Pul kalkınca ekran `setSelected(from)` yapar: dokunarak seçmedeki gibi yasal hedefler altın çerçeve + dolgu ve zar etiketleriyle ("8 (3+5)") yanar. Pulun altındaki yasal hedef ayrıca kalın beyaz çerçeve + koyu altın dolguyla vurgulanır (şekil + renk).
- **Bırakma:** Hedef, görünen pulun merkezine göre seçilir (parmağa değil). Yasal hedefe tam düşerse ya da bir hedefin alanına 0,4 sütun genişliği kadar yakınsa (titreyen eller için) o hedef. Ekran `targetsFor(view.moves, from).get(to)` ile hamleyi bulur ve dokunma akışının aynı `playMove`'unu çağırır: aynı `step` aksiyonları, aynı zar seçimi (iki zar aynı yere gidiyorsa `targetsFor`'un seçtiği, en az zarlı / ilk eşit olan). Pul hedefteki iniş yerine kayar ve tahta değişene (adımın görünümü gelene) kadar orada bekler; en fazla 2,5 sn.
- **Yasal olmayan yere bırakma / iptal:** Pul 170 ms'de kendi yerine kayar, sonra gerçek pul tekrar görünür. Seçim açık kalır (hedefler yanmaya devam eder, oyuncu istersen dokunarak hedef seçebilir).
- **Geometri:** İsabet hesabı `TavlaGeom`'dan (colW, barW, trayW, boardH) yapılır; telefonda (compact), tablette ve dar 'stack' düzende aynı. Siyah için ters tahta `pointCell` ile aynı kuralla çözülür. Her hane kendi yarım sütununa sahip (iki sıra arasındaki boşluk ortadan bölünür); bar sadece alt (kendi) yarıda; toplama kutusu tüm sütun; tahtanın kenarından yarım sütun dışarısı da kenar sayılır.
- **Rakip animasyonu ve memo:** `anim.flying` dokunulmadı (sürükleme yalnız `canPlay` iken açık, `canPlay` replay sırasında kapalı). `drag` useMemo `[canPlay, geom, viewer, board, seat, view.moves]`; `boardEl` bağımlılıklarına `drag` eklendi. Saniyelik saat tick'i tahtayı yeniden çizmez.
- **Erişilebilirlik:** Ekran okuyucu dokunuşları kısa olduğundan jest devreye girmez; `Pressable` etiketleri aynen. Kopya pul ve vurgu çerçevesi ekran okuyucudan gizli (`importantForAccessibility="no-hide-descendants"`, `accessibilityElementsHidden`), dokunuş almaz.

## Testler

`app/test/tavlaDrag.test.ts` (15 test):
- 24 hanenin çizilen alanı (merkez + 4 köşe + en üst pulun merkezi) iki koltuk için doğru haneye dönüyor: telefon (800×380, compact), tablet (1280×800), dar (600×900).
- Ters tahta: aynı ekran noktası beyaz için 1, siyah için 24.
- Bar: sadece alt yarı; toplama kutusu: tüm sütun + sağ kenarın biraz dışı; sıra arası boşluk ortadan bölünüyor; uzak dış alan hiçbir şey.
- `placeRect` ↔ `placeAt` tutarlı; `pickAt` yalnız oynatılabilir yerde; `dropAt`: tam isabet, yakın ıska (komşu hane, bar üstü), gerçek ıska, toplama, ters tahta.
- `dragPlan`: hedefler `targetsFor` ile birebir, başlangıç en üst pulun yuvası, iniş yuvası (kendi yığını / boş hane / bar girişi / toplama, siyah).

`corepack pnpm --filter ./app typecheck` temiz, `corepack pnpm --filter ./app test` 16 dosya / 232 test geçti (paralel ajanın kart testleri dahil).

## Riskler / cihazda bakılacaklar

- Cihazda denenmedi (tablet USB testi yapılmadı). Özellikle bakılması gerekenler: kısa dokunuşların hâlâ tek seferde seçtiği; sürükleme başlayınca `Pressable`'ın tetiklenmediği (iOS ve Android); kopya pulun parmak altında akıcı gittiği.
- `onTouchesDown` içinde `GestureStateManager.fail` (RNGH 3.3 v3 API) ilk kez bu projede kullanılıyor; çalışmazsa sonuç sadece şu olur: oynatılamaz bir yerden 10 dp'den fazla kayan parmağın dokunuşu iptal olur (eskiden kayarak dokunma yine sayılıyordu).
- Çevrimiçi masada sunucu yanıtı gecikirse pul hedefte 2,5 sn'ye kadar bekler; adım reddedilirse bu sürenin sonunda gerçek pul eski yerinde tekrar görünür (dokunma akışındaki `busy` zaman aşımıyla aynı süre).
- 5'ten yüksek yığında üstteki pul sayıyı da taşıdığı için sürüklerken sayı bir an görünmez.
- Başarısız bırakmadan sonra seçim açık kalıyor (bilinçli); istenmezse `onDrop` false dönünce `setSelected(null)` eklemek yeterli.
