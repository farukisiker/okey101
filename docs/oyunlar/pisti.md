# Pişti

Pişti, tek desteyle oynanan ve kuralları kolay bir iskambil oyunudur. Bu belge, uygulamada
oynanan Pişti'nin kurallarını ve ayarlarını anlatır.

## Genel Bakış

- 52 kartlık bir deste kullanılır.
- 2 veya 4 kişi oynanır.
- Amaç, yerdeki kartları toplayıp **151 puana** ilk ulaşmaktır (hedef ayarla değişir).
- En çok puan kazandıran hamle **pişti** yapmaktır.
- Kartın büyüklüğü önemli değildir; önemli olan **sayıların (değerlerin) eşleşmesidir**.

## Kurulum

1. 52 kart karıştırılır.
2. Masanın ortasına 4 kart konur: 3 kart kapalı, en üstteki 1 kart açık.
3. Her oyuncuya 4'er kart dağıtılır.
4. Kalan kartlar ortada kapalı bir deste olarak bekler: 2 kişilik oyunda 40 kart,
   4 kişilik oyunda 32 kart.
5. Dağıtan kişi her elde değişir. Oynamaya dağıtanın solundaki oyuncu başlar, sıra
   saat yönünde ilerler.

Her oyuncunun elinde 4 kart olur. Eldeki kartlar bitince herkese yeniden 4'er kart dağıtılır.

## Açılışta Vale Çıkarsa

Açılan en üst kart **Vale (J)** ise, o Vale destenin ortasına sokulur ve yerine yeni bir kart
açılır. Böylece oyun açılışta Vale ile başlamaz.

Bu, genel kabul gören varsayılandır; `openingJack` ayarıyla değiştirilebilir.

## Oynanış

- Sırası gelen oyuncu elinden **1 kart** atar. Atılan kart, yerdeki yığının en üstüne açık
  olarak konur.
- Atılan kart, yerdeki en üst kartla **aynı değerde** ise oyuncu yerdeki bütün kartları alır
  ve kendi kasasına koyar.
- **Vale (J)** her zaman alır: yerde ne olursa olsun, Vale atan oyuncu yerdeki bütün kartları
  alır.
- Yerde hiç kart yoksa (önceki oyuncu hepsini topladıysa) Vale bile o boş yeri alamaz; atılan
  kart yerde tek başına kalır.
- Oyunun başında yerde 4 kart vardır. İlk oyuncu bu 4 kartı toplasa bile **pişti olmaz**,
  çünkü yerde tek kart değil 4 kart vardır.
- Eşleşme yoksa atılan kart yerde kalır ve sıra diğer oyuncuya geçer.
- Herkesin eli bitince kalan desteden herkese yeniden 4'er kart dağıtılır. Yerdeki kartlar
  olduğu gibi kalır.

## Pişti Yapmak

**Pişti**, yerde tek bir kart varken onu aynı değerde bir kartla almaktır. Oyunun en değerli
hamlesidir.

- Yerde tek kart varken aynı değerde kart atmak: **10 puan** (ayar: `pistiPoints`).
- Yerde tek Vale varken Vale atmak (**Vale piştisi**): **20 puan** (ayar: `jackPistiPoints`).
- Yerde tek kart varken Vale atmak pişti **sayılmaz**; Vale yalnızca kartı toplar, pişti puanı
  yazılmaz.
- Pişti yapan iki kartın kendi puanları da ayrıca sayılır. Örneğin iki As ile pişti:
  10 + 1 + 1 = **12 puan**.

## Puanlama

El sonunda her oyuncunun topladığı kartlara bakılır:

| Puan kalemi | Puan |
|---|---|
| Her As (A) | 1 |
| Her Vale (J) | 1 |
| Sinek ikilisi (♣2) | 2 |
| Karo onlusu (♦10) | 3 |
| En çok kartı toplayan | 3 |
| Yapılan her pişti | 10 |
| Vale piştisi | 20 |

- En çok kartı toplayan oyuncu 3 puan alır. Kart sayısı eşitse bu 3 puan **kimseye verilmez**.
- Piştiler dışında destedeki kartların toplam puanı her elde **16**'dır (kart sayısı eşitse 13).
- 4 kişilik eşli oyunda ortaklar kasalarını ve puanlarını paylaşır.

## El ve Oyun Bitişi

- Destede kart kalmayıp bütün eller bitince, yerde kalan kartlar **en son kart toplayan**
  oyuncuya gider. Bu son kartlar pişti sayılmaz.
- Puanlar toplanır ve yeni el başlar.
- Hedef puana (varsayılan 151) ilk ulaşan oyuncu veya takım oyunu kazanır.
- Aynı elde iki taraf da hedefi geçerse **puanı yüksek olan** kazanır.
- Puanlar tam eşitse **1 uzatma eli** oynanır.

## Süre ve Zaman Aşımı

- Her hamle için **30 saniye** vardır. Oyunun ilk turunda süre iki katıdır (60 saniye).
- Süre biterse uygulama oyuncu adına oynar: yerdeki kartı alacak bir kart varsa onu atar;
  yoksa pişti verme riski en düşük, en küçük kartı atar.
- Bağlantısı kopan oyuncunun yerine bot oynar; oyuncu dönerse yerini geri alır.

## Ayarlar

| Ayar | Seçenekler | Varsayılan |
|---|---|---|
| `seats` | `2`, `4` | `2` |
| `partnerMode` | `false`, `true` (yalnız 4 kişide; karşılıklı oturanlar ortak) | `false` |
| `targetScore` | `51`, `101`, `151` | `151` |
| `pistiPoints` | `10` | `10` |
| `jackPistiPoints` | `20` | `20` |
| `hiddenCards` | `'reveal'`, `'secret'` | `'reveal'` |
| `openingJack` | `'redraw'`, `'allow'` | `'redraw'` |
| `turnTimeoutMs` | sayı (milisaniye) | `30000` |
| `firstTurnFactor` | sayı (ilk tur süre çarpanı) | `2` |
| `botLevel` | `'easy'`, `'medium'`, `'hard'` | `'medium'` |

Açıklamalar:

- **`hiddenCards`** — Açılışta yere konan 3 kapalı kart, ilk toplayan oyuncunun kart sayısına
  eklenir ve o anda herkese açık gösterilir (`reveal`). `secret` seçilirse bu kartları kimse
  görmez, yalnızca el sonunda sayılır.
- **`openingJack`** — Açılışta Vale çıkarsa Vale destenin ortasına sokulur ve yeni kart açılır
  (`redraw`). `allow` seçilirse oyun Vale ile başlayabilir.
- **`partnerMode`** — Yalnızca 4 kişilik oyunda çalışır. Açık olduğunda karşılıklı oturan iki
  oyuncu ortak olur; kasa ve puan ortaktır.

`hiddenCards` ve `openingJack` için yazılan değerler **genel kabul gören varsayılanlardır**;
kahvehaneden kahvehaneye değiştiği için ayarla değiştirilebilir.
