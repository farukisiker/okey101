# Demli Kahve: Yerel Geliştirme Prompt'u

> Bu dosyayı yerel makinende Claude Code'a (veya başka bir kodlama ajanına) olduğu gibi ver.
>
> ```bash
> git fetch origin
> git checkout -b feat/kahve origin/feat/okey101-app
> git show origin/claude/bold-einstein-1e1t49:PROMPT_LOCAL.md > PROMPT_LOCAL.md
> claude
> ```
> Sonra yaz: **"PROMPT_LOCAL.md dosyasını oku. Önce A Aşaması'nı uygula, her adımda test et ve commit at."**

---

## 0. Bağlam: sıfırdan başlamıyoruz

Bu depoda yayında olan bir uygulama var: **Demli Okey** (`feat/okey101-app` dalı).
App Store'da onaylı (v1.0.1), Play Store hazır, Raspberry Pi'de canlı sunucu çalışıyor.
**Hedef:** bu uygulamayı silmeden, onu büyüterek çok oyunlu bir kahvehane uygulamasına dönüştürmek.

### Mevcut yapı (önce bunları oku)

```
shared/   Saf TS kural motoru + Vitest testleri
          tiles.ts melds.ts solver.ts game.ts (101) duz.ts (düz okey) bot.ts clock.ts protocol.ts names.ts
server/   Node + Express + Socket.io, otoriter sunucu: room.ts server.ts bot.ts (+ testler)
app/      Expo 58 + React Native 0.88, yatay ekran
          screens/ Intro Lobby Salon WaitingRoom GameScreen
          components/ Rack TileView TableMelds OpponentPanel RoundResult ...
          net/ useOkey (çevrimiçi) useLocalGame (çevrimdışı, botlara karşı)
          i18n/ 13 dil · ads/ AdMob · purchases/ RevenueCat ("Reklamsız")
docs/     tasarim/TASARIM.md (60+ yaş için ekran tasarımı) · ux-raporu.md · raspberry-pi-kurulum.md
```

İşe başlamadan önce şunları oku: `README.md`, `docs/tasarim/TASARIM.md`, `docs/ux-raporu.md`,
`shared/src/game.ts`, `shared/src/protocol.ts`, `server/src/room.ts`, `app/src/App.tsx`, `app/src/screens/Lobby.tsx`.

### Bozulmaması gerekenler (kırmızı çizgiler)

1. **Okey oynanışı aynen kalacak.** 101 ve Düz Okey kuralları, ıstaka sürükle-bırak, botlar, saat, salon ve şifreli masalar değişmeyecek.
   Mevcut testlerin hepsi her commit'te geçmeli: `pnpm test` ve `pnpm typecheck`.
2. **Canlı sunucuyla geriye uyumluluk.** Mağazadaki v1.0.1 istemcileri `mode: '101' | 'duz'` gönderiyor.
   Sunucu bunu kabul etmeye devam etmeli. Yeni alanlar eklenebilir, eskileri kaldırılamaz.
3. **Kimlikler aynı kalacak.** Paket kimliği `com.farukisiker.okey101`, AdMob ve RevenueCat kimlikleri değişmeyecek.
   Aynı uygulama güncellenecek, yeni uygulama açılmayacak. Mevcut kullanıcılar, yorumlar ve "Reklamsız" satın alımları korunur.
4. **CI'yi tetikleme.** `feat/okey101-app` dalına yapılan her push TestFlight ve APK derlemesi başlatıyor.
   Tüm iş `feat/kahve` dalında yapılacak. Ben onaylamadan `feat/okey101-app`'e merge ve push yok.
5. **Hedef kitle 60+ yaş.** Büyük kontroller, yazı en az 15pt, renk körü işaretleri (●▲■◆), sade akış.
   `TASARIM.md`'deki ilkeler yeni oyunlara da uygulanacak.
6. **Gerçek parayla kumar yok.** Oyun puanı sanaldır; satın alınamaz, jetona ya da paraya çevrilemez.
   Kullanıcı 18.11.2026 onayıyla Faz E'de gerçek parayla jeton ve hediye satılabilir (hediye oyun sonucuna asla bağlanmaz,
   oyunda avantaj sağlamaz; ayrıntı `docs/kahve/arastirma/SOSYAL_HEDIYE_claude.md` §1).

### Çalışma kuralları
- Küçük adımlar at, her adımı test et, sonra commit et. Commit mesajları kısa olsun; mevcut geçmişte olduğu gibi İngilizce olabilir.
- Kural kodu `shared/` altında saf ve arayüzden bağımsız kalacak. Sunucu, botlar ve çevrimdışı oyun aynı kodu kullanır.
- Kahveden kahveye değişen kurallar sabit kodlanmayacak, ayar nesnesiyle yönetilecek. Mevcut `OKEY_TAKEN_PENALTY` gibi ev kurallarını koru.
- Yeni metinler önce `tr` ve `en` olarak eklenecek. Diğer 11 dil İngilizceye düşsün; en sonda toplu çevrilecek.
- Her aşamanın sonunda kısa bir özet yaz: ne yapıldı, nasıl denenir, bilinen eksikler.

---

## 1. Ürün hedefi

**İsim önerisi:** **Demli Kahve: Okey, Tavla, Batak.**
"Demli" markası korunur, kullanıcı tanıdık ikonu ve ismi görür.
İsim değişikliği **son adımda** ve onayımla yapılacak. O zamana kadar uygulama adı "Demli Okey" kalsın.

**Ekran akışı:**
```
Intro: "Kahveye hoş geldin ☕"      (mevcut Intro.tsx güncellenir)
  └─ İsim (mevcut, bir kez sorulur)
       └─ Kahve Salonu (YENİ: masa grupları)
            ├─ 🀄 Okey Masaları   → 101 Okey · Düz Okey          (mevcut, aynen)
            ├─ 🃏 Kağıt Masaları  → Pişti · Batak · (yakında) King, Konken, 51
            ├─ 🎲 Tavla Köşesi    → Tavla                        (C Aşaması)
            └─ ⚫ Dama & Domino   → (yakında)
                 └─ Mevcut akış: "Hemen Oyna" (botlarla, çevrimdışı) | "Arkadaşlarla" (Salon, masalar, şifre)
```
- Yapılmamış oyunlar "Yakında" rozetiyle görünür ama tıklanamaz.
- Son seçilen oyun hatırlansın. Açılışta "Son oynadığın: 101 Okey, Devam" kısayolu olsun; yaşlı kullanıcı her seferinde menüde gezinmesin.
- Okey masası seçilince bugünkü Lobby ekranı (101 / Düz) görünsün. Okey oyuncusu için tek fark, araya giren bir "Okey Masaları" adımı.

**Neden tek uygulama:** Boyutu oyun sayısı değil, görseller ve SDK'lar belirliyor. Taş ve kart motorları ortak.
Çevrimiçi oyuncu havuzu bölünmez. Kart ve tavla görselleri SVG/vektör ile çizilecek; uygulama boyutu bugünkünden en fazla ~10 MB artmalı.

---

## 2. Mimari değişiklik: oyun kataloğu

Bugün her şey okeye bağlı: `GameMode = '101' | 'duz'`, `Room` doğrudan okey `GameState` tutuyor.
Bunu, okey koduna dokunmadan, genel bir oyun arayüzüne bağlayacağız.

### 2.1 Paket yapısı (pnpm workspace)
```
shared/            # @okey/shared: OKEY olarak kalır (dosya taşıma yok, import'lar bozulmasın)
packages/
  game-core/       # @kahve/core: ortak tipler, seed'li RNG, koltuk/sıra, GameDefinition arayüzü
  cards/           # @kahve/cards: 52'lik deste, karıştırma, dağıtma, kart karşılaştırma
  pisti/           # @kahve/pisti
  batak/           # @kahve/batak
  tavla/           # @kahve/tavla    (C Aşaması)
  catalog/         # @kahve/catalog: tüm oyunların kaydı (okey dahil, adaptörle)
```
`tiles.ts` içindeki `Rng`/`seededRng`/`shuffle` ortak çekirdeğe taşınacaksa, okeyde yeniden dışa aktarılarak taşınsın; okey import'ları değişmesin.

### 2.2 Ortak arayüz
```ts
// @kahve/core
export type GameId = 'okey101' | 'okeyDuz' | 'pisti' | 'batak' | 'tavla' | /* yakında */ 'king' | 'konken' | 'elli1';
export type TableGroup = 'okey' | 'kagit' | 'tavla' | 'dama';

export interface GameDefinition<S, A, V, Opts = unknown> {
  id: GameId;
  group: TableGroup;
  seats: number;                       // pişti 2 veya 4, batak 4, tavla 2
  status: 'active' | 'soon';
  defaultOptions: Opts;
  create(opts: Opts, names: string[], rng: Rng): S;
  apply(state: S, seat: number, action: A): { ok: true; state: S } | { ok: false; error: string };
  viewFor(state: S, seat: number): V;  // gizli bilgiyi (rakip eli) asla göndermez
  botMove(state: S, seat: number, level: BotLevel, rng: Rng): A;
  quickMove(state: S, seat: number): A; // süre dolunca otomatik hamle
  roundOver(state: S): boolean;
  scoreRound(state: S): number[];
  matchOver(totals: number[], round: number, opts: Opts): boolean;
}
```
- Okey için `okeyAdapter`: mevcut `createGame`, `applyAction`, `viewFor`, `botStep`, `quickMove`, `matchOver` fonksiyonlarını sarar. **Okey kural koduna dokunulmaz.**
- `server/src/room.ts`: `Room<S,A,V>` genel hale gelir ve `GameDefinition` ile çalışır. Koltuk sayısı oyuna göre değişir (`SEATS` sabiti yerine `def.seats`).
- `useLocalGame` da aynı tanım üzerinden çalışır. Böylece her yeni oyun hem çevrimdışı hem çevrimiçi bedavaya gelir.

### 2.3 Protokol (geriye uyumlu)
- `room:create`, `room:join`, `room:quickPlay` mesajlarına **isteğe bağlı** `game?: GameId` eklenir.
  `game` yoksa eski `mode` alanına bakılır: `'101'` → `okey101`, `'duz'` → `okeyDuz`.
- `RoomInfo` ve `TableSummary` içine `game: GameId` eklenir. `mode` alanı okey masalarında eski istemciler için gönderilmeye devam eder.
- Eski istemciler salon listesinde sadece okey masalarını görmeli. Bu yüzden `salon:watch` isteğinde `games?: GameId[]` filtresi olsun; filtre yoksa sadece okey masaları dönsün.
- `game:view` yükü oyuna özel olsun: `{ game: GameId, view: V }`. Eski okey istemcisine eski biçim gönderilmeye devam etsin; istemci sürümünü `handshake.auth.v` ile bildirsin.
- Bu uyumluluk için sunucu testleri yaz: "eski istemci 101 masası açar ve oynar" testi geçmeli.

### 2.4 Uygulama tarafı
- `screens/KahveSalonu.tsx` (yeni): 4 büyük masa grubu kartı, en az 2×2 ızgara, 60+ için dev dokunma alanları.
- `screens/OyunSecimi.tsx` (yeni): grup içindeki oyunlar. Okey için mevcut Lobby'deki 101/Düz düğmeleri buraya taşınabilir.
- `GameScreen` okeye özel kalır, adı `OkeyGameScreen` olabilir. Her oyunun kendi ekranı olur (`PistiScreen`, `BatakScreen`, `TavlaScreen`).
  Ortak kabuk `GameShell` içinde: Çık, Ses, rakip panelleri, durum satırı, el sonu ekranı (mevcut `OpponentPanel` ve `RoundResult`'tan türetilir).
- `App.tsx` ekran seçimi: `intro → isim → kahveSalonu → oyunSecimi → (bekleme) → oyun ekranı[game]`. Android geri tuşu her adımda bir geri gitsin.
- Reklam kapısı (`adGate.onHandCompleted`) tüm oyunlarda el sonunda çalışsın. "Reklamsız" satın alımı tüm oyunları kapsar.

---

## 3. Aşamalar

### A Aşaması: Kahve kabuğu ve genel mimari (oynanış değişmez)
1. `packages/game-core` + `GameDefinition` + okey adaptörü. Adaptör üzerinden çalışan okey testleri, mevcut testlerle aynı sonucu vermeli.
2. `Room` ve `useLocalGame`'i genelleştir. Tüm mevcut sunucu testleri geçmeli.
3. Protokole `game` alanını geriye uyumlu ekle, uyumluluk testlerini yaz.
4. `Intro`'ya "Kahveye hoş geldin" metnini ekle, `KahveSalonu` ve `OyunSecimi` ekranlarını yaz. Kart ve tavla şimdilik "Yakında".
5. Elle dene: 101 ve Düz Okey çevrimdışı ve yerel sunucuyla eskisi gibi oynanıyor (`EXPO_PUBLIC_SERVER_URL=http://<bilgisayar-ip>:3001`).

**A bitti sayılır:** `pnpm test` ve `pnpm typecheck` yeşil. Okey oyuncusu için tek fark araya giren "Okey Masaları" adımı.

### B Aşaması: Kart motoru, Pişti ve Batak
**Kart görselleri:** SVG ile çizilsin. Büyük köşe harfi ve büyük takım simgesi kullanılsın; ♥♦ kırmızı, ♠♣ siyah, renk körü için takım şekli zaten ayırt edici.
Kartlar en az okey taşı kadar büyük ve okunaklı olsun. Ele dokununca kart yukarı kalksın, ikinci dokunuşta oynansın. Sürükle-bırak da olsun ama zorunlu olmasın.

**Pişti (önce bu, en basiti; genel mimariyi doğrular).** Varsayılanlar, hepsi ayarlanabilir:
- 2 veya 4 oyuncu, 52 kart. Ortaya 4 kart açılır, ilk üçü kapalı ve en üstü açık. Herkese 4 kart dağıtılır, eller bitince yeniden 4'er dağıtılır.
- Ortadaki en üst kartla aynı değerde kart atan veya **Vale** atan ortadaki tüm kartları alır.
- **Pişti:** ortada tek kart varken onu aynı değerle almak 10 puan. Vale ile valeye pişti 20 puan.
- Puanlar: her As 1, her Vale 1, ♣2 2, ♦10 3 puan. En çok kartı toplayan 3 puan.
- Son eldeki kartlar ortadaki son alan oyuncuya gider. Oyun 151 puana kadar oynanır (ayar: 51/101/151).
- 4 kişide eşli oyun ayarı da olsun.
- Bot: Acemi rastgele oynar. Usta düşen kartları sayar, pişti fırsatı kollar, rakibe pişti verecek kartı atmaz, valeyi doğru anda kullanır.

**Batak (ihaleli, tekli).** Varsayılanlar, hepsi ayarlanabilir:
- 4 oyuncu, 13'er kart. İhale 5'ten başlar (ayar: 4). En yüksek ihaleyi alan kozu seçer ve ilk kartı açar.
- Renge uymak zorunlu. Renk yoksa koz atmak zorunlu (ayar). Koz yoksa herhangi bir kart atılır.
- Masadaki en yüksek kartı geçebiliyorsan geçmek zorunlu (ayar, varsayılan açık).
- Koz, ilk koz düşmeden açılamaz (ayar).
- Puan: ihaleyi tutturan aldığı el sayısı kadar puan yazar; tutturamayan ihale kadar eksi yazar. Diğerleri aldığı el kadar yazar; hiç el almayan ihale kadar eksi (ayar).
- Varyant ayarları: Koz Maça (ihalesiz, koz hep maça), Eşli Batak. İlk sürümde ihaleli tekli yeterli, varyantları ayar olarak hazırla.
- Bot: ihale için elindeki güçlü kartları ve kozları sayan sezgisel değerlendirme. Usta bot düşen kartları takip eder.

**B bitti sayılır:**
- Kurallar için kapsamlı testler (en az %85 kapsam).
- 1000 seed'li bot-bot simülasyonunda hiç geçersiz hamle olmaması.
- Pişti ve Batak hem çevrimdışı hem arkadaşlarla (salon, şifreli masa) oynanıyor.

### C Aşaması: Tavla
- Klasik tavla: 15 pul, zar, kırık pul, kapı, toplama. Mars (2) ve çifte mars / konçina (3, ayar).
- Oyun 3 veya 5 sayıya kadar oynanır (ayar). İlk sürümde çift zarlama küpü yok.
- Etkileşim: pula dokununca gidebileceği haneler parlasın, hedefe dokununca oynansın. Sürükleme isteğe bağlı.
- "Geri al" düğmesi olsun: zar bitene kadar hamle geri alınabilsin.
- Zar animasyonu ve sesi olsun. Zarlar sunucuda seed'li RNG ile atılsın; istemci zar üretmesin.
- Bot: tüm geçerli hamle dizilerini üretip basit bir pozisyon değerlendirmesiyle seçsin (açık pul cezası, kapı ödülü, yarış farkı). Usta seviye 1 zar derinliğinde beklenen değer hesaplasın.
- Testler: geçerli hamle üretimi (zorunlu büyük zar, kırık pul önceliği, toplama kuralları) için kapsamlı test.

### D Aşaması: Yayına hazırlık (onayımla)
- 11 dile çeviri (mevcut `scripts/` ve `docs/store/` düzenine uygun).
- Uygulama adı "Demli Kahve", yeni ikon (okey taşı + kart + zar), mağaza metinleri ve ekran görüntüleri (`app/scripts/make-store-art.py` kullanılarak).
- `app.json` sürümü 1.1.0 olur. Pi sunucusu önce güncellenir; eski istemcilerle uyumluluk canlıda kontrol edilir.
- Ancak bundan sonra `feat/okey101-app` dalına merge edilir; CI derlemeleri o zaman başlar.

### Sonra (şimdi yapma, mimariyi hazır tut)
King, Konken, 51, Papaz Kaçtı, Eşli 101, Türk Daması, Domino.
Masa sohbeti ve hazır mesajlar ("Hayırlı olsun", "Çay söyle!"). Arkadaş listesi.

---

## 4. Teknik notlar
- Paket yöneticisi **pnpm** (`packageManager` alanındaki sürüm). `node-linker=hoisted` ayarını koru.
- Komutlar:
  ```bash
  pnpm install
  pnpm test        # shared + server (+ yeni paketleri bu script'e ekle)
  pnpm typecheck
  pnpm server      # :3001
  pnpm app         # Expo
  ```
- Yeni paketleri `pnpm-workspace.yaml` dosyasına ekle ve root `test` script'ine dahil et.
- Yeni native modül ekleme. Gerekiyorsa önce sor; App Store incelemesi ve EAS/CI derlemesi etkilenir.
  Mevcut `react-native-reanimated`, `gesture-handler` ve `expo-audio` yeterli olmalı.
- SVG için `react-native-svg` gerekiyorsa ekle; Expo'da hazır gelir.
- Sesler mevcut `feedback.ts` üzerinden çalsın. Yeni sesler (kart atma, kart toplama, zar) küçük `.wav` dosyaları olsun, her biri 50 KB'tan küçük.
- `docs/` altına `oyunlar/pisti.md`, `oyunlar/batak.md`, `oyunlar/tavla.md` yaz: uygulanan kurallar ve ayarlar. README'deki "Kurallar" bölümü bunlara link versin.

---

## 5. İlk yapacakların (sırayla)

1. Yukarıdaki dosyaları oku. Mevcut mimariyi ve planı 10 maddede özetle; bana göstermeden koda başlama.
2. `feat/kahve` dalında olduğunu doğrula. `pnpm install && pnpm test && pnpm typecheck` ile başlangıçta her şeyin yeşil olduğunu gör.
3. A Aşaması 1. adım → test → commit. Sonra 2, 3, 4, 5.
4. A bitince dur ve özet ver. B'ye ben "devam" deyince geç.
