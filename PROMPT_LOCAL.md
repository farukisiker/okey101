# Mahalle Kahvesi: Yerel Geliştirme Prompt'u

> Bu dosyayı yerel makinende Claude Code'a (veya başka bir kodlama ajanına) olduğu gibi ver.
> Kullanım: depo klasöründe `claude` çalıştır ve şunu yaz:
> **"PROMPT_LOCAL.md dosyasını oku ve 1. Aşama'yı baştan sona uygula."**

---

## 0. Rolün ve çalışma şeklin

Sen bu projenin baş geliştiricisisin. Türkçe arayüzlü, kahvehane temalı bir oyun uygulaması geliştireceksin.

Çalışma kuralları:
- Her alt adımı bitirince **çalıştır, test et, sonra commit et**. Küçük ve anlamlı commit'ler at; mesajlar Türkçe olabilir.
- Bir şeyi bitti saymadan önce `npm run test` ve `npm run build` hatasız geçmeli.
- Oyun kuralları **saf TypeScript** olarak, arayüzden bağımsız yazılmalı (sonradan sunucuda da çalışacak).
- Kural varyantları kod içine sabitlenmemeli, `KuralAyarlari` nesnesiyle yönetilmeli. Kahvehaneden kahvehaneye kurallar değişiyor.
- Emin olmadığın bir kural olursa varsayılanı bu dokümandan al, ayarı da açık bırak.
- Her aşamanın sonunda kısa bir özet yaz: ne yapıldı, nasıl çalıştırılır, bilinen eksikler.

---

## 1. Ürün özeti

**İsim:** Mahalle Kahvesi: Okey, Tavla ve Kağıt Oyunları

**Fikir:** Kullanıcı sanal bir mahalle kahvesine girer, bir masa grubu seçer, oyun türünü seçer ve masaya oturur.

**Ekran akışı:**
```
Açılış ekranı: "Kahveye hoş geldin ☕"  (kısa animasyon: buharı tüten çay bardağı)
  └─ Kahve Salonu (lobi)
       ├─ 🀄 Okey Masaları   → 101 Okey · Klasik Okey · (yakında: Eşli 101)
       ├─ 🃏 Kağıt Masaları  → (yakında) Batak · King · Pişti · Konken · 51 · Papaz Kaçtı
       ├─ 🎲 Tavla Köşesi    → (yakında) Klasik Tavla
       └─ ⚫ Dama & Domino   → (yakında)
            └─ Masa listesi (Acemi / Usta / Özel masa)
                 └─ Oyun ekranı
```
Henüz yapılmamış oyunlar lobide **"Yakında"** rozetiyle görünsün ama tıklanamasın.

**Mimari kararı (araştırma sonucu):** Tüm oyunlar **tek uygulamada** olacak.
- Boyutu oyun sayısı değil, görseller belirliyor.
- Taş motoru (101 + Klasik) ve 52'lik deste motoru (Batak, King, Pişti...) ortak kullanılacak.
- Hedef boyut: tüm paket 30–60 MB altı. İlk aşamada web paketi 2 MB altı (gzip).
- Görseller mümkün olduğunca **SVG/CSS** ile çizilsin, büyük PNG kullanma.

---

## 2. Teknoloji

| Katman | Seçim |
|---|---|
| Dil | TypeScript (strict) |
| Arayüz | React 18 + Vite |
| Stil | CSS Modules veya Tailwind (birini seç, tutarlı kal) |
| Durum | Zustand |
| Animasyon | Framer Motion (taş/kart hareketleri, sürükle-bırak) |
| Test | Vitest (+ oyun mantığı için kapsamlı birim testleri) |
| Lint/format | ESLint + Prettier |
| Paketleme | PWA (vite-plugin-pwa): telefona "Ana ekrana ekle". İleride Capacitor ile Android/iOS. |
| Ses | Kısa efektler (taş çekme, taş atma, zar), ayarlardan kapatılabilir |

Node 20+ varsay. Komutlar:
```bash
npm install
npm run dev      # geliştirme sunucusu
npm run test     # birim testleri
npm run build    # üretim paketi
```

---

## 3. Klasör yapısı

```
src/
  app/                 # yönlendirme, ana layout, tema
  screens/
    Acilis/            # "Kahveye hoş geldin"
    Salon/             # lobi: masa grupları
    MasaListesi/       # seçilen oyunun masaları
    Oyun/              # oyun ekranı kabuğu
    Ayarlar/
  engine/
    core/              # ortak tipler, RNG (seed'li), oyuncu, sıra yönetimi
    tiles/             # okey taşları: deste, karıştırma, gösterge/okey hesabı, per doğrulama
    cards/             # 52'lik deste (2. aşamada)
  games/
    okey101/           # kurallar, puanlama, bot
    okeyKlasik/        # kurallar, puanlama, bot
    registry.ts        # oyun kataloğu (lobi bu listeden beslenir)
  components/          # Tas, Istaka, Kart, Masa, Avatar, Buton, Modal...
  assets/              # svg, ses
  i18n/tr.ts           # tüm metinler burada
tests/                 # engine ve oyun kuralları testleri
```

**Oyun kataloğu (`games/registry.ts`):** Her oyun şu arayüzü uygular. Yeni oyun eklemek = yeni bir klasör + kayıt.
```ts
interface OyunTanimi {
  id: string;                 // 'okey101'
  ad: string;                 // '101 Okey'
  grup: 'okey' | 'kagit' | 'tavla' | 'dama';
  oyuncuSayisi: number[];     // [4]
  durum: 'aktif' | 'yakinda';
  varsayilanAyarlar: KuralAyarlari;
  yeniOyun(ayar, seed): OyunDurumu;
  gecerliHamleler(durum, oyuncu): Hamle[];
  hamleUygula(durum, hamle): OyunDurumu;   // saf fonksiyon, durumu değiştirmez
  bot(durum, oyuncu, seviye): Hamle;
}
```

---

## 4. 1. Aşama: kapsam (bu oturumda yapılacak)

### 4.1 Açılış ve Salon
- Açılış: koyu ahşap/bordo zemin, sıcak sarı ışık, "Kahveye hoş geldin" yazısı. 2 saniye sonra veya dokununca Salon'a geçsin.
- Salon: 4 masa grubu kartı (yukarıdaki liste). Okey aktif, diğerleri "Yakında".
- Okey'e tıklayınca: **101 Okey** / **Klasik Okey** seçimi.
- Masa listesi: "Acemi Masası" (kolay bot), "Usta Masası" (zor bot), "Özel Masa" (kuralları kullanıcı ayarlar).
- Üst barda: kullanıcı adı (yerelde saklanan takma ad), sanal çay/jeton sayacı (şimdilik süs), ayarlar.

### 4.2 Taş motoru (`engine/tiles`)
- 106 taş: 4 renk (kırmızı, sarı, mavi, siyah) × 1–13 × 2 adet + 2 sahte okey.
- Seed'li karıştırma (testlerde tekrar üretilebilir sonuç için).
- Gösterge seçimi ve okey hesabı: göstergenin aynı renkte bir üstü okeydir, 13'ün üstü 1'dir.
- Sahte okey, okey taşının gerçek değerini temsil eder.
- **Per doğrulama:**
  - *Küt (grup):* aynı sayı, farklı renk, 3 veya 4 taş.
  - *Seri (sıralı):* aynı renk, ardışık, en az 3 taş. 12-13-1 geçerli, 13-1-2 geçersiz (ayarlanabilir).
  - *Çift:* aynı renk ve aynı sayıdan 2 taş.
  - Okey her taşın yerine geçebilir.
- **Otomatik dizme:** elindeki taşları "seri diz" ve "çift diz" diye iki düğmeyle en iyi şekilde gruplayan algoritma. Okeyleri en çok puan getirecek yere koysun.
- Testler: her kural için olumlu ve olumsuz örnekler, okeyli kenar durumları.

### 4.3 101 Okey kuralları (varsayılanlar)
- 4 oyuncu. Başlayan oyuncuya 22, diğerlerine 21 taş. Başlayan bir taş atarak başlar.
- Sıra saat yönünün tersine. Oyuncu ya ortadan ya da solundakinin attığı taşı çeker, sonra bir taş atar.
- **Açma:**
  - Seri açma: perlerin toplam değeri **en az 101**. Okeyin değeri, yerine geçtiği taşın değeridir.
  - Çift açma: **en az 5 çift**.
  - Ayar (varsayılan kapalı): sonraki açanlar öncekinden yüksek açmak zorunda. Biri çiften açtıysa, çiften açacak sonraki oyuncu en az bir çift fazla açmalı.
- **Yandan taş alma:** soldan alınan taş o el kullanılmalı ve oyuncu açmamışsa o el açmalı. Açamazsa taş geri verilir, ceza yazılır (+101).
- **İşleme:** sadece açmış oyuncu masadaki perlere taş ekleyebilir. Seri açan seri perlere, çift açan sadece çiftlere işler (ayar).
- **Cezalar (+101):** işlek taş atmak (masadaki bir pere uyan taşı atmak), okey atmak, yandan alıp kullanmamak.
- **El sonu:** biri elindeki tüm taşları bitirip son taşı atınca el biter. Orta deste biterse el berabere biter, herkes elindekini yazar.
- **Puanlama (bir el):**
  - Bitiren: **−101**. Okey atarak bitirirse **−202**.
  - Hiç açmamış oyuncu: **+202**.
  - Açmış oyuncu: elindeki taşların toplamı. Elinde okey varsa +101.
  - Çiften açmış oyuncu: el toplamının 2 katı.
  - Elden bitme (hiç açmadan tek seferde bitirme): bitiren −202, diğerlerinin cezası 2 katı (ayar).
- **Oyun:** varsayılan 9 el (ayar: 5/7/9/11). En düşük toplam kazanır.

### 4.4 Klasik Okey kuralları (varsayılanlar)
- 4 oyuncu. Başlayana 15, diğerlerine 14 taş.
- Kazanmak: 14 taşın tamamı geçerli perlerde (veya 7 çift) olacak şekilde 15. taşı ortaya atarak bitirmek.
- Puan: her oyuncu 20 puanla başlar (ayar).
  - Normal bitiş: diğerleri −2.
  - Okey atarak bitiş veya çiftten bitiş: diğerleri −4.
  - Gösterge taşını ilk turda gösteren oyuncu: diğerleri −1.
  - Puanı 0'a düşen oyuncu oyunu kaybeder, oyun biter.
- Yanında biten taşı "sürükle-bırak ile ortaya at" etkileşimi olmalı.

### 4.5 Botlar
- 3 seviye: **Acemi, Orta, Usta**.
  - Acemi: rastgeleye yakın, sadece bariz perleri yapar.
  - Orta: kendi elini optimize eder (per/çift potansiyeli puanlaması).
  - Usta: rakiplerin aldığı/attığı taşları takip eder, işlek taş atmaz, rakibe yarayacak taşı tutar.
- Bot hamleleri 600–1200 ms gecikmeyle oynansın, "düşünüyor..." göstergesi olsun.
- Bot isimleri kahve havasında olsun: Hüseyin Abi, Cemal Usta, Rıza Dayı, Nuri Emmi, Kâzım Bey...

### 4.6 Oyun ekranı
- Yeşil çuha masa, ahşap kenarlar. Alt kısımda kullanıcının 2 sıralı ıstakası.
- Taşlar sürükle-bırak ile dizilebilsin. "Seri diz" ve "Çift diz" düğmeleri olsun.
- Ortada kapalı deste, gösterge taşı, her oyuncunun önünde attığı taşlar.
- 101'de "Aç" düğmesi: seçili perlerin toplamını canlı göstersin (ör. "87 / 101"). Yetersizse pasif olsun.
- Masadaki açılmış perler görünür olsun, işlemek için sürükle-bırak.
- Puan tablosu modalı: el el puanlar, toplam.
- El sonu ve oyun sonu ekranları: kazanan, puanlar, "Yeni oyun", "Salona dön".
- Mobil öncelikli: 360 px genişlikte yatay ve dikey düzgün çalışsın. Yatay mod tercih edilir, dikeyde "telefonu yan çevir" önerisi gösterilsin.

### 4.7 Ayarlar ve kalıcılık
- Ses aç/kapa, animasyon hızı, takma ad, tema (koyu/açık ahşap).
- Yarım kalan oyun `localStorage`'da saklansın, açılışta "Devam et" sunulsun.
- İstatistikler: oynanan/kazanılan oyun, en iyi 101 skoru.

---

## 5. Görsel kimlik

- Renkler: koyu ahşap `#3b2416`, bordo `#6d1f1f`, çuha yeşili `#1f5a3a`, sıcak sarı `#e8b44a`, krem `#f4ead5`.
- Yazı tipi: başlıklarda karakterli bir serif (ör. "Playfair Display"), metinde okunaklı bir sans (ör. "Inter").
- Taşlar: krem zemin, kalın renkli rakam, altında küçük nokta. Sahte okeyde yonca simgesi. SVG ile çiz.
- Ufak detaylar: salonda çay bardağı, duvarda saat, arka planda hafif kahve uğultusu (kapatılabilir).
- **Gerçek bir markanın (Zynga, Okey Plus vb.) görselini, logosunu veya adını kullanma.** Her şey özgün olsun.

---

## 6. Kabul kriterleri (1. Aşama bitti sayılması için)

- [ ] `npm run dev` ile açılış → salon → okey → 101 → acemi masa akışı çalışıyor.
- [ ] 101 Okey'de 3 bota karşı 9 el baştan sona oynanabiliyor, puanlar doğru yazılıyor.
- [ ] Klasik Okey'de 3 bota karşı oyun 0 puana kadar oynanabiliyor.
- [ ] Per doğrulama, açma eşiği, okey değeri, işleme ve cezalar için birim testleri var ve geçiyor (hedef: `engine` ve `games` için %85+ kapsam).
- [ ] Bot hiçbir zaman geçersiz hamle yapmıyor (1000 rastgele seed'li bot-bot simülasyonuyla test et).
- [ ] 360×640 ve 1920×1080'de düzen bozulmuyor.
- [ ] `npm run build` başarılı, gzip'li paket 2 MB altında.
- [ ] PWA olarak telefona eklenebiliyor ve internetsiz açılıyor.
- [ ] README güncel: nasıl kurulur, nasıl çalıştırılır, klasör yapısı, kural ayarları.

---

## 7. Sonraki aşamalar (şimdi yapma, mimariyi bunlara hazır tut)

1. **Kağıt motoru:** 52'lik deste + Batak (ihaleli, koz maça, eşli), Pişti, King.
2. **Tavla:** klasik tavla, mars/çifte mars, zar animasyonu, bot.
3. **Çevrimiçi:** Node.js + WebSocket (veya Colyseus) sunucusu. `engine` ve `games` kodları sunucuda aynen kullanılacak. Hesap, arkadaş daveti, masa sohbeti, hazır mesajlar ("Hayırlı olsun", "Çay söyle!").
4. Konken, 51, Papaz Kaçtı, Eşli 101, Türk Daması, Domino.
5. Capacitor ile Android/iOS paketleri. Görseller büyürse Android'de nadir oynanan oyunlar için Play Asset Delivery (on-demand).

> Not: Gerçek parayla kumar özelliği **olmayacak**. Jetonlar sadece sanal ve eğlence amaçlı.

---

## 8. Başlarken yapacağın ilk adımlar

1. Vite + React + TS projesini kur, ESLint/Prettier/Vitest'i yapılandır, commit et.
2. `engine/core` ve `engine/tiles` modüllerini testleriyle yaz, commit et.
3. `games/okey101` kurallar + puanlama + testler, commit et.
4. `games/okeyKlasik` kurallar + puanlama + testler, commit et.
5. Botlar ve bot-bot simülasyon testi, commit et.
6. Ekranlar: Açılış → Salon → Masa Listesi → Oyun, commit et.
7. Ayarlar, kalıcılık, PWA, commit et.
8. README ve özet.

Her adımın sonunda neyin çalıştığını bana kısaca bildir, sonra bir sonrakine geç.
