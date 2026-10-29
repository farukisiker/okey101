# Okey 101 — Oyun Ekranı Yeniden Tasarımı

> Hedef kitle 60+. Yatay ekran. Tüm ölçüler **pt** (1x). Geliştirici, `taslak.html` içindeki
> `layout()` fonksiyonunu birebir taşıyabilir; buradaki formüller onunla aynıdır.
> Mevcut `theme.ts` renkleri korunur; iki renk eklenir (bkz. Renk paleti).

## 1. Tasarım fikri

Ekran, kahvedeki masa gibi **üç yatay kata** ayrılır; her kat bir işi yapar ve bir daha yer değiştirmez:

1. **Başlık şeridi (48 pt):** sol → sağ: Çık, Ses, üç rakip (sol · karşı · sağ sırasıyla, masadaki oturuşla aynı), Okey göstergesi. Dokunulması gerekmeyen bilgi en üstte, başparmağın uzağındadır. Çık ekranın en sol üst köşesinde, Aç'ın tam çaprazındadır.
2. **Bölge satırı (94 pt):** solda **Çekme bölgesi** (deste + soldan al, ikisi de çekilen taşlardır, yan yana durur), ortada **masa** (perler + "Tümü"), sağda **Atma bölgesi** ("Buraya at"). Okey'in akışı soldan sağa okunur: *soldan al → masa → sağa at*.
3. **Eylem satırı (54 pt):** Diz · DURUM · At · Aç. Butonlar iki alt köşede, başparmağın altındadır. Durum yazısı ortada, tek ve büyük.
4. **Istaka:** ekranın tüm genişliğinde, alt kenara dayalı; ahşap, ana ekran çubuğunun altına kadar iner (boş bant kalmaz). Taşlar güvenli alanın içindedir.

Mevcut sorunlar böyle çözülür: "taşı buraya" yazısı artık yok (bölge altında tek satır "Buraya at", taş boşken boş çerçeve); atma bölgesi Aç'tan ayrı katta; rakipler ve Çık/Ses tek 48 pt şeride sığdığı için masa alanı 75 → 94 pt'ye çıkar ve ıstaka 46 → 48 pt taş kullanır; yanlarda boşluk kalmaz.

## 2. 812×375 yerleşimi (iPhone X/11; güvenli alan sol/sağ 44, alt 21)

Kullanılabilir genişlik 724 (x = 44…768). Dikey akış: 4 · **48** · 4 · **94** · 4 · **54** · 2 · **ıstaka 165** (21'i ana ekran çubuğu altı).

| Bölge | x | y | G | Y | Not |
|---|---|---|---|---|---|
| Çık | 44 | 4 | 64 | 48 | ikincil buton, onay sorar |
| Ses | 114 | 4 | 48 | 48 | 🔊 / 🔇 |
| Sol rakip | 172 | 4 | 155 | 48 | |
| Karşı rakip | 335 | 4 | 155 | 48 | |
| Sağ rakip | 498 | 4 | 155 | 48 | |
| Okey göstergesi | 664 | 4 | 104 | 48 | küçük taş 28×39 + "Okey / Sarı 4" |
| Çekme bölgesi | 44 | 56 | 160 | 94 | iki hücre 74×94: Deste, Soldan al |
| · Deste taşı | 60 | 60 | 49 | 68 | sırtında kalan sayı |
| · Soldan al taşı | 138 | 60 | 49 | 68 | |
| · Hücre yazıları | — | 130 | 74 | 18 | "Deste", "Soldan al" |
| Masa | 210 | 56 | 442 | 94 | iç kenar 4; per taşı 33×46 |
| · Tümü düğmesi | 592 | 60 | 56 | 86 | sağa yaslı, dikey |
| Atma bölgesi | 658 | 56 | 110 | 94 | taş 49×68 (x 688, y 60), altında "Buraya at" |
| Diz | 44 | 154 | 110 | 54 | ikincil |
| Durum | 162 | 154 | 326 | 54 | ortalı yazı |
| At | 496 | 154 | 100 | 54 | birincil |
| Aç 60/101 | 604 | 154 | 164 | 54 | iki satır |
| Istaka (ahşap) | 0 | 210 | 812 | 165 | kenardan kenara, alt kenara kadar |
| · 1. sıra taşları | 46 + i·48 | 214 | 48 | 66 | i = 0…14 → x 46…766 |
| · 2. sıra taşları | 46 + i·48 | 284 | 48 | 66 | |
| · Raf çizgileri | 46 | 277 / 347 | 720 | 5 | koyu ahşap |

ASCII tel kafes (ölçekli değil):

```
x: 44                                                                    768
   ┌──────┬────┬──────────────┬──────────────┬──────────────┬──────────┐  y 4
   │ Çık  │ 🔊 │ Elif  [AÇTI] │ Melek        │ ▶ Hasan      │ ▢ Okey   │
   │      │    │ 9 taş · 52   │ 21 taş · 16  │ 22 taş · 202 │   Sarı 4 │  48
   ├──────┴────┴──┬───────────┴──────────────┴─────────┬────┴──────────┤  y 56
   │ ▢ 13   ▢ 9   │ [6 6 6]  [6 6 OK]  [13 13 13 13] │🔍│ │    ▢ 7    │
   │              │  Elif·18   Elif·18     Elif·52    │Tü│ │           │
   │ Deste Soldan │                                    │mü│ │ Buraya at │  94
   ├──────────┬───┴────────────────────────────┬──────┴──┴┬───────────┤  y 154
   │   Diz    │   SIRA SENDE · BİR TAŞ AT      │    At    │ Aç 60/101 │
   │          │                                │          │41 sayı daha│  54
═══╧══════════╧════════════════════════════════╧══════════╧═══════════╧═══  y 210
 ▢▢▢▢ ▢▢▢ ▢▢▢ ░░░                                    15 yuva × 48      (ahşap)
 ▢▢▢ ▢▢▢▢ ▢▢▢ ░░░                                                       y 284
═══════════════════════════ ▬▬▬ (ana ekran çubuğu) ═════════════════════  y 375
```

## 3. Ölçeklenme kuralları

Girdi: `W, H`, güvenli alan `insL, insR, insB` (üst 0). Tüm sonuçlar tam sayıya yuvarlanır.

```
s        = clamp(W / 852, 1, 1.6)                 // tablet ölçeği; telefonlarda 1
usable   = W − insL − insR
tileW    = clamp(floor((usable − 4) / 15), 40, 72) // ıstaka taşı
tileH    = round(tileW × 1.38)
rackH    = 2·tileH + 12                           // 4 + taş + 4 + taş + 4
rackTop  = H − insB − rackH                       // ahşap H'ye kadar devam eder
rackX    = insL + 2 + floor((usable − 4 − 15·tileW) / 2)

headH    = 48·s ;  actH = 54·s ;  g = 4
headTop  = g ;  zoneTop = g + headH + g
actTop   = rackTop − 2 − actH
zoneH    = actTop − g − zoneTop

// başlık şeridi (soldan sağa)
cikW = 64·s ; sesW = 48·s ; okW = 104·s
oppW = floor((usable − cikW − sesW − okW − 42·s) / 3)
x: Çık=insL · Ses=+cikW+6s · Rakip_i = Ses sonu + 10s + i·(oppW + 8s) · Okey = insL+usable−okW

// bölge satırı
drawW = 160·s ; discW = 110·s
tableX = insL + drawW + 6 ; tableW = usable − drawW − discW − 12
sideH  = min(zoneH, pileH + 26)                   // tablette yan bölgeler üste yaslanır
pileW  = min(56·s, floor((zoneH − 26) / 1.38)) ; pileH = round(pileW × 1.38)
meldCap = min(40·s, floor((zoneH − 32) / 1.38))
meldTile: meldCap'ten 30'a kadar dene; ilk satıra en çok (≤3) per sığdıran EN BÜYÜK genişlik.
          per genişliği = n·w + 8, per yüksekliği = round(w×1.38) + 6 + 18, aralık 6, iç kenar 4
tümüW = 56·s ; tümüH = min(zoneH − 8, 86·s)

// eylem satırı
dizW = 110·s ; atW = 100·s ; acW = 164·s ; ag = 8·s
statusW = usable − dizW − atW − acW − 3·ag
```

Sonuçlar:

| | 812×375 | 852×393 | 667×375 | 1180×820 |
|---|---|---|---|---|
| s | 1 | 1 | 1 | 1.385 |
| Istaka taşı | 48×66 | 48×66 | 44×61 | 72×99 |
| rackTop | 210 | 228 | 241 | 610 |
| zoneH (masa yüksekliği) | 94 | 112 | 125 | 455 |
| Rakip paneli | 155×48 | 158×48 | 136×48 | 274×66 |
| Masa G | 442 | 452 | 385 | 794 |
| Deste/yer taşı | 49×68 | 56×77 | 56×77 | 78×108 |
| Per taşı (6 perlik örnek) | 33 → 3 per | 34 → 3 per | 40 → 2 per | 55 → 4 satır, 6 per |
| Durum kutusu G | 326 | 336 | 269 | 630 |

667'de (SE) rakip paneli 136 pt olduğundan isim 10 karakterde "…" ile kesilir; "AÇTI" çip olarak isim yanında durur, meta satırı ("21 taş · 202", ≤ 90 pt) hep sığar.

## 4. Tipografi

Sistem fontu (SF / Roboto). Hiçbir yazı 15 pt'nin altına inmez.

| Yazı | pt | Kalınlık | Renk | Satır | Taşarsa |
|---|---|---|---|---|---|
| Rakip adı | 18 | 800 | yazı; sırası gelince vurgu | 1 | 10 karakter + "…" |
| AÇTI çipi | 15 | 800 | #0b3d2e üstünde başarı | 1 | — (sabit) |
| Rakip meta "22 taş · 202" | 15 | 600 | soluk | 1 | taşamaz |
| Okey etiketi "Okey" | 15 | 600 | soluk | 1 | — |
| Okey değeri "Sarı 4" | 17 | 800 | yazı | 1 | — |
| Bölge yazıları "Deste", "Soldan al", "Buraya at" | 15 | 700 | yazı | 1 | sabit metin |
| Deste sayısı | 0.44×taş (49→22) | 900 | #5a4a2a | 1 | — |
| Durum (sıra sende) | 22 | 800 | vurgu | 1 | kutu < 320 → 19; yine sığmazsa 17, 2 satır |
| Durum (başkası oynuyor) | 22 | 800 | yazı | 1 | aynı kural |
| Hata (toast) | 17 | 700 | beyaz, zemin hata | ≤2 | 2 satırda "…" |
| Bilgi (ör. deste karıştırıldı) | 17 | 800 | #0b3d2e, zemin başarı | ≤2 | aynı |
| Buton başlığı (Diz, At, Çık, Aç) | 20 | 800 | #2b1d00 (birincil) / yazı (ikincil) | 1 | sabit metinler |
| Buton alt satırı "41 sayı daha" | 15 | 600 | #2b1d00 / soluk | 1 | — |
| Tümü düğmesi "Tümü (6)" | 15 | 800 | #2b1d00 | 2 | — |
| Istaka taşı rakamı | 0.5×taş (48→24) | 800 | taş rengi | 1 | — |
| Istaka taşı şekli | 0.22×taş (48→11), en az 10 | — | taş rengi | — | simge, yazı değil |
| OK rozeti | 12 | 900 | #3b2a00 üstünde vurgu | 1 | 24×16 kutu |
| + rozeti | 15 | 900 | #0b3d2e üstünde başarı | 1 | 18×18 daire |
| Masa per taşı rakamı | 0.5×taş (33→16.5, en az 15) | 800 | taş rengi | 1 | taş 30'un altına inmez |
| Per sahibi "Elif · 52" | 15 | 600 | soluk | 1 | per genişliğinde "…" |

Kural: kesme (ellipsis) yalnızca **isimlerde**; sabit metinler kutularına göre ölçülmüştür. Durum satırı tek yer olup önce küçülür, sonra iki satıra geçer; hiçbir zaman kesilmez.

## 5. Renk paleti

| Ad | Hex | Kullanım |
|---|---|---|
| zemin | `#082e22` | ekranın en altındaki arka plan (çuhanın altı) |
| çuha | `#0b3d2e` | ana zemin (`colors.felt`) |
| çuha açık | `#145a43` | masa alanı (`colors.feltLight`) |
| panel | `#07301f` | rakip paneli, çekme/atma bölgesi, Okey kutusu (rgba(0,0,0,.25) yerine düz renk) |
| ahşap | `#6d4c2f` | ıstaka |
| ahşap koyu | `#4a321e` | raf çizgileri, ıstaka üst kenarı |
| taş | `#fbf6e9` · kenar `#c9bfa6` · sırt `#e8dcc0` | |
| yazı | `#f4f1e8` | |
| soluk | `#a9c2b6` | ikincil yazı, ikincil buton çerçevesi |
| vurgu | `#f2b632` | birincil buton, sıra vurgusu, seçili taş, Tümü |
| başarı | `#5fd07d` · koyu `#2e8b57` | işlek, uyan per, AÇTI, Aç butonu açılabilirken |
| hata | `#e45858` | toast |
| pasif | zemin rgba(0,0,0,.25), çerçeve rgba(169,194,182,.6), opaklık .75 | |
| taş renkleri | kırmızı `#d0312d` ● · sarı `#b57400` ▲ · mavi `#1f5fbf` ■ · siyah `#1d1d1d` ◆ | değişmedi |
| aktif rakip zemini | `#3a3415` (vurgunun %15'i çuha üstünde) | |

## 6. Bileşen tarifleri

**Rakip paneli** — oppW×48, köşe 12, zemin panel, çerçeve 3 pt saydam, iç boşluk 4/8. Satır 1: `▶ İsim [AÇTI]`; satır 2: `N taş · toplam`. *Sırası gelince:* çerçeve vurgu, zemin #3a3415, isim vurgu renginde, başında ▶. *Koptu:* meta yerine "bağlantı koptu" (soluk). Dokunulmaz.

**Okey göstergesi** — 104×48, köşe 12, zemin panel. Solda gösterge taşı 28×39 (rozetsiz), sağda iki satır "Okey" / "Sarı 4".

**Çekme bölgesi** — 160×94, köşe 12, zemin panel; iki hücre 74×94 (sol 4 pt boşluk, arada 4). Hücre tamamen dokunma hedefidir (74×94), yalnızca taş değil. Deste: taş sırtı + 3 pt kaydırılmış ikinci sırt (yığın hissi), ortasında kalan sayı. Soldan al: sol rakibin son attığı taş; yoksa 49×68 kesik çizgili boş çerçeve (rgba(255,255,255,.35)). *Çekme fazı (sıra sende):* her iki hücre vurgu renginde 3 pt çerçeve + nabız. *Sürükleniyor:* taş parmakla gider (ölçek 1.1, gölge 12), hücrede altındaki taş/sırt görünür, deste sayısı 1 düşer. *Pasif:* opaklık 1 (bilgi değeri var), çerçeve yok.

**Atma bölgesi** — 110×94, köşe 12, zemin panel. Taş 49×68 ortada (y 60), altında "Buraya at". Kendi son attığın taş görünür; boşken kesik çizgili boş çerçeve. *Atma fazı:* 3 pt vurgu çerçeve + 10 pt vurgu parıltı + nabız. *Seçili taş varken dokunma:* seçili taşı atar (At ile aynı). *Üzerine sürüklenirken (hover):* zemin rgba(95,208,125,.25), çerçeve başarı 4 pt. *Pasif:* sade.

**Masa** — 442×94, köşe 12, zemin çuha açık, iç kenar 4. Perler soldan sağa 6 pt aralıkla; sığmayanlar gizlenir, sayı Tümü düğmesinde. Boşken ortada "Açmak için 101 sayı gerekir" (18 pt, yazı). Tüm alan dokununca Tümü'yü açar.

**Masa per kutusu** — genişlik n·w+8, yükseklik taş+24; köşe 8, zemin rgba(0,0,0,.18), çerçeve 2 pt saydam, iç boşluk 2. Taşlar yan yana, altında "Sahibi · puan". *Uyan (seçili taş işlenebilir):* çerçeve başarı, zemin rgba(95,208,125,.25); dokununca taş işlenir. *Üzerine sürüklenirken:* çerçeve 4 pt başarı. *Kendi perin:* sahibi "Sen".

**Tümü düğmesi** — 56×86, köşe 10, sağ üstte; zemin vurgu, "🔍 / Tümü / (6)". Gizli per yoksa zemin rgba(0,0,0,.35) ve yazı "Büyüt". Gizli bir per uyuyorsa zemin başarı, yazı "Uyan per burada" (bu durum olmasın diye uyan perler başa alınır; bkz. §8).

**Durum satırı** — 326×54, yazı ortalı, zemin yok. Üç modu: durum (sarı/beyaz), hata (kırmızı kutu, köşe 8, 3 s), bilgi (yeşil kutu, 4 s). Metin değişince 150 ms çapraz geçiş.

**Butonlar** — yükseklik 54 (başlık 48), köşe 12, çerçeve 2. *Birincil* (At, Aç): zemin vurgu, yazı #2b1d00. *Başarı* (Aç 101'e ulaşınca): zemin başarı. *İkincil* (Diz, Çık, Ses): zemin rgba(0,0,0,.25), çerçeve soluk, yazı yazı rengi. *Pasif:* zemin rgba(0,0,0,.25), çerçeve rgba(169,194,182,.6), opaklık .75; yazı okunur kalır. *Basılı:* opaklık .75, ölçek .97, 80 ms. At yalnızca sıra sende + taş seçiliyken aktif. Aç: "Aç 60/101" + "41 sayı daha"; 101'de yeşil + "Açabilirsin!"; açtıktan sonra "Per İndir" (alt satır yok), ıstakada geçerli per yoksa pasif.

**Istaka** — ahşap zemin x 0…W, y rackTop…H; üst kenar 2 pt ahşap koyu; köşe yok. İki raf çizgisi 5 pt. Yuvalar 48×66, 15×2; taş boşken görünmez. *Taş seçiliyken:* boş yuvalar 2 pt kesik vurgu çerçeveli (dokun-dokun hedefi). *Sürüklerken:* parmağın altındaki yuva 4 pt vurgu çerçeve + rgba(242,182,50,.25) dolgu.

**Taş** — 48×66 (kenar boşluğu 1 → görünür 46×64), köşe 0.12×w ≈ 6, zemin taş, kenar 1 pt taş kenarı, gölge 0 2 2 rgba(0,0,0,.35). Rakam üstte, şekil altında. OK rozeti sağ üst (24×16, vurgu). + rozeti sol üst (18×18, başarı). *Seçili:* 4 pt vurgu çerçeve, 10 pt vurgu parıltı, 8 pt yukarı, ölçek 1.06. *Yeni çekilen:* 4 pt başarı çerçeve 2 s. *Sürükleniyor:* ölçek 1.1, gölge 0 8 12 rgba(0,0,0,.5), en üst katman. *Sönük (overlay'de uymayan):* opaklık .45.

## 7. Etkileşim ipuçları ve animasyon

| Olay | Ne olur | Süre |
|---|---|---|
| Sıra sana geldi | Durum "SIRA SENDE · TAŞ ÇEK" (vurgu); deste ve soldan al hücreleri nabız; çan + titreşim | nabız 700 ms gidiş-dönüş, sürekli; ölçek 1→1.04, çerçeve opaklığı .35→1 |
| Taş çekildi | Taş desteden ıstakaya uçar, boş ilk yuvaya iner; 2 s yeşil çerçeve; durum "SIRA SENDE · BİR TAŞ AT"; atma bölgesi nabıza geçer | uçuş 220 ms ease-out |
| Taş seçildi | 120 ms'de kalkar; boş yuvalar kesik çerçeveli olur; uyan perler yeşil yanar; At aktif | 120 ms |
| Taş yuvaya bırakıldı | 180 ms'de yerine oturur, "tak" sesi | 180 ms |
| Taş atıldı | Taş atma bölgesine uçar, eski taş altında kaybolur | 220 ms |
| Pere taş işlendi | Per 1 kez yeşil parlar | 300 ms |
| 101'e ulaşıldı | Aç yeşile döner + bir kez 1.06 ölçek + başarı titreşimi | 250 ms |
| Rakip hamlesi | İlgili rakip paneli vurgu çerçeveye 250 ms'de geçer; durum "Leyla Mavi 7 attı"; bot hamleleri arası 1.0–1.5 s | 250 ms |
| Hata | Durum kutusu kırmızı; hafif sarsıntı (±4 pt, 2 kez) | 3 s görünür, sarsıntı 300 ms |
| Sürükleme hedefi | Yuva/per/atma bölgesi anında 4 pt çerçeve | 0 (anlık) |
| Çık | Onay diyalogu "Masadan kalkmak istiyor musun?" — Evet, kalk / Hayır, oyna | 150 ms açılış |

Hiçbir animasyon oyunu bloke etmez; "Hareketi azalt" açıkken nabız yerine sabit çerçeve kullanılır.

## 8. Masada 10+ per olduğunda

1. **Sıralama:** perler önce *seçili taşın uyduğu* perler, sonra oyuncunun kendi perleri, sonra sol → karşı → sağ rakip sırasıyla dizilir. Böylece işlenecek per her zaman ilk satırda, görünür durumdadır; 94 pt'lik masada bile oyuncu Tümü'yü açmak zorunda kalmaz.
2. **Sığdırma:** per taşı en çok 40, en az 30 pt; ilk satıra sığan per sayısını en çoklayan en büyük taş seçilir (812'de 3 per × 33 pt). Sığmayan perler **gizlenir, asla kesilmez**; Tümü düğmesi "Tümü (12)" yazar ve vurgu renginde kalır.
3. **Tümü (büyük görünüm):** tam ekran overlay (mevcut `TableOverlay`): başlık "Masadaki perler", "Kapat" 120×56 sağ üstte; perler sahibine göre gruplanmış, taş 56 pt, 2–3 satır, dikey kaydırmalı. Seçili taş varken başlıkta "Seçili taş: ▢ — yeşil pere dokun" ve uymayan perler %45 sönük. Pere dokununca işlenir ve overlay kapanır.
4. **Tablet:** 1180×820'de masa 455 pt; taş 55 pt'de 4 satır, satır başına 4–5 per → 16+ per inline görünür; Tümü yalnızca nadir durumlarda gerekir.
5. **Sürükleme:** taş sürüklenirken gizli bir pere uyuyorsa Tümü düğmesi yeşile döner; taş Tümü'nün üstüne bırakılırsa overlay seçili taşla açılır.
