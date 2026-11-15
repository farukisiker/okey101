# Batak

Batak, tek desteyle oynanan ve "löve" (el) almaya dayanan bir iskambil oyunudur. Bu belge,
uygulamadaki ilk sürümün kurallarını ve ayarlarını anlatır: **4 kişilik ihaleli tekli batak**.

## Genel Bakış

- 52 kartlık deste kullanılır, 4 kişi oynar.
- Her oyuncuya 13 kart dağıtılır; yani bir elde toplam 13 löve oynanır.
- Oyuncular sırayla **ihale** verir: "Bu elde şu kadar löve alırım" der.
- İhaleyi en yüksek söyleyen **koz**u seçer ve oyunu yönetir.
- Amaç, söz verilen löve sayısını tutturmaktır. Tutturan artı puan alır, tutturamayan eksi
  puan alır.
- Koz Maça ve Eşli Batak varyantları hazırlanıyor; ilk sürümde yalnız ihaleli tekli oynanır.

## Kurulum ve Dağıtım

1. 52 kart karıştırılır.
2. Her oyuncuya 13'er kart dağıtılır; artan kart kalmaz.
3. Dağıtan kişi her elde değişir. İhaleye dağıtanın solundaki oyuncu başlar, sıra saat
   yönünde ilerler.
4. Kartların büyüklük sırası (küçükten büyüğe): 2, 3, 4, 5, 6, 7, 8, 9, 10, Vale (J),
   Kız (Q), Papaz (K), As (A).

## İhale

- İhale **5'ten** başlar (ayarla 4).
- Sırası gelen oyuncu ya daha yüksek bir sayı söyler ya da **pas** geçer.
- Pas geçen oyuncu o elde bir daha ihaleye giremez.
- 3 oyuncu pas geçince kalan oyuncu ihaleyi en son söylediği sayıyla alır.
- Herkes pas geçerse sıra dağıtana gelir ve dağıtan **4** löveyi zorunlu olarak alır.

## Koz Seçimi

- İhaleyi alan oyuncu kozu seçer: **Maça (♠), Kupa (♥), Karo (♦) veya Sinek (♣)**.
- Koz, o elde en güçlü renktir: koz atıldığında diğer renklerin büyük kartları onu geçemez.
- Kozu seçen oyuncu ilk kartı oynar.

## Oynanış

- Her lövede oyuncular sırayla **1 kart** oynar. Dört kart yere düşünce löve biter.
- Löveyi şu oyuncu alır:
  - masaya koz atıldıysa **en büyük kozu** atan,
  - koz atılmadıysa **ilk atılan rengin en büyük kartını** atan.
- Löveyi alan oyuncu bir sonraki löveye başlar.
- 13 löve bitince el biter ve puanlar yazılır.

## Yasal Kart Kuralları

1. **Önce renge uymak zorunlu.** Yere bir renk atıldıysa (örneğin Kupa), elinde o renkten kart
   varsa o renkten atmak zorundasın.
2. **Aynı rengi büyütmek zorunlu** (`mustRaise`). Yerdeki kartı geçebiliyorsan, yani daha büyük
   aynı renk kartın varsa, geçmek zorundasın. Birisi koz çaktıysa bu zorunluluk kalkar;
   istediğin küçük kartı atabilirsin.
3. **Koz kırılmadan koz çıkılamaz** (`trumpLeadNeedsBreak`). Yere hiç koz düşmeden kozla löve
   başlatamazsın. Elde yalnız koz kaldıysa koz çıkabilirsin.
4. **Renk yoksa koz atmak zorunlu** (`voidTrump`). Yerdeki renkten hiç kartın yoksa ve elinde
   koz varsa koz atmak zorundasın.
5. **Üstüne çakmak zorunlu.** Bu lövede senden önce biri koz çaktıysa ve daha büyük kozun
   varsa, daha büyük kozu atmak zorundasın. Daha büyük kozun yoksa da küçük kozu atman
   gerekir; "geçemiyorum" diyerek başka renk atamazsın (alttan çakma).
6. **Ne renk ne koz varsa** elindeki herhangi bir kartı atabilirsin.

`voidTrump` ayarı 4. ve 5. maddedeki zorunluluğu değiştirir:

- `'always'` (varsayılan): Renk yoksa koz atmak zorunludur; yerdeki kozu geçemesen de küçük
  kozu atarsın.
- `'ifCanOvertrump'`: Yerdeki kozu geçebiliyorsan geçmek zorundasın; geçemiyorsan başka renk
  atabilirsin.
- `'never'`: Renk yoksa koz atmak zorunlu değildir; istediğin kartı atabilirsin.

Bu değer **genel kabul gören varsayılandır**; kahvehaneden kahvehaneye değiştiği için ayarla
değiştirilebilir.

## Puanlama

| Durum | Puan |
|---|---|
| İhaleyi tutturan (söz verdiği kadar ya da fazla löve alan) | Aldığı löve sayısı kadar **artı** |
| İhaleyi tutturamayan (batan) | İhale sayısı kadar **eksi** |
| Diğer oyuncular | Aldıkları löve sayısı kadar **artı** |
| Hiç löve alamayan | İhale sayısı kadar **eksi** (ayarla değişir) |

- Örnek: 7 ihale alıp 9 löve alan oyuncu **+9** yazar. 8 ihale alıp 7 löve alan oyuncu
  **−8** yazar.
- Hiç löve alamayan oyuncunun cezası `zeroTrickPenalty` ayarıyla belirlenir: ihale sayısı
  kadar eksi (`bid`, varsayılan), sabit −5 (`fixed5`) veya ceza yok (`none`).

## El ve Maç Bitişi

- Bir elde 13 löve oynanır, puanlar yazılır ve yeni el başlar.
- Varsayılan olarak **9 el** oynanır (ayar: 5, 7, 9, 11, 13).
- El sayısı tamamlanınca en yüksek puanlı oyuncu maçı kazanır.
- Puanlar eşitse **1 uzatma eli** oynanır.

## Süre ve Zaman Aşımı

- Her hamle (ihale, koz seçimi ve kart oynama) için **30 saniye** vardır. Oyunun ilk turunda
  süre iki katıdır (60 saniye).
- Süre biterse uygulama oyuncu adına şu hamleyi yapar:
  - ihalede: pas geçer (pas geçemiyorsa en küçük ihaleyi verir),
  - koz seçiminde: elinde en çok kart olan rengi koz seçer,
  - kart oynamada: oynanabilecek en küçük yasal kartı atar.
- Bağlantısı kopan oyuncunun yerine bot oynar; oyuncu dönerse yerini geri alır.

## Ayarlar

| Ayar | Seçenekler | Varsayılan |
|---|---|---|
| `variant` | `'ihaleli'`, `'kozMaca'`, `'esli'` | `'ihaleli'` |
| `targetRounds` | `5`, `7`, `9`, `11`, `13` | `9` |
| `minBid` | `4`, `5` (`'esli'` oyununda `8`) | `5` |
| `forcedDealerBid` | `4` (tekli), `7` (eşli) | `4` |
| `voidTrump` | `'always'`, `'ifCanOvertrump'`, `'never'` | `'always'` |
| `mustRaise` | `true`, `false` | `true` |
| `trumpLeadNeedsBreak` | `true`, `false` | `true` |
| `zeroTrickPenalty` | `'bid'`, `'fixed5'`, `'none'` | `'bid'` |
| `kozMacaOvertrickLimit` | `2`, `3`, `0` (sınırsız) | `2` |
| `partnerDummy` | `false`, `true` | `false` |
| `turnTimeoutMs` | sayı (milisaniye) | `30000` |
| `firstTurnFactor` | sayı (ilk tur süre çarpanı) | `2` |
| `botLevel` | `'easy'`, `'medium'`, `'hard'` | `'medium'` |

Açıklamalar:

- **`variant`** — `'ihaleli'` ihaleli tekli bataktır. `'kozMaca'` (koz her zaman maça) ve
  `'esli'` (eşli batak) **hazırlanıyor**; ilk sürümde yalnız ihaleli tekli oynanır.
- **`minBid` / `forcedDealerBid`** — İhalenin en düşük değeri ve herkes pas geçtiğinde
  dağıtanın zorunlu alacağı ihale.
- **`voidTrump`** — Renk yokken koz atma zorunluluğu; yukarıda "Yasal Kart Kuralları"
  bölümünde üç seçenek tek tek anlatıldı.
- **`mustRaise`** — Aynı rengi büyütme zorunluluğunu açar veya kapatır.
- **`trumpLeadNeedsBreak`** — Koz kırılmadan kozla löve başlatma yasağını açar veya kapatır.
- **`kozMacaOvertrickLimit`** — Koz Maça'da söylenenin kaç fazlasında batılacağı
  (`2` = 3 fazlada batar). **Hazırlanıyor** (ilk sürümde ihaleli tekli).
- **`partnerDummy`** — Eşli batakta ihaleyi alanın ortağının elinin açık serilip
  serilmeyeceği. Varsayılan `false`: ortağın eli kapalı kalır, herkes kendi elini oynar.
  **Hazırlanıyor** (ilk sürümde ihaleli tekli).

`voidTrump` ve `partnerDummy` için yazılan değerler **genel kabul gören varsayılanlardır**;
kahvehaneden kahvehaneye değiştiği için ayarla değiştirilebilir.
