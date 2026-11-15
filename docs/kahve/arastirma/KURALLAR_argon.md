> **Claude ön incelemesi (15.11.2026), okumadan önce:**
> - Bölüm 0'daki kod okumaları kontrol edildi ve **doğru**: `handPenalty`, `elden` koşulu, `okeySwap`'te uç okey kısıtı, `matchOver` (101'de hep false), işlek atma cezasının olmaması.
> - Ama "YANLIŞ UYGULANMIŞ" denenlerin çoğu **hata değil, bilinçli seçilmiş ev kuralı**. `game.ts`'teki yorumda yazılı:
>   - Elden: sadece başka kimse açmamışken
>   - Elde okey: değeri + düz 101
>   - Bunlar kullanıcıya sorulacak **ayarlar** olarak ele alınmalı. Kullanıcı karar vermeden okey davranışı değişmez (PROMPT_LOCAL kırmızı çizgi 1).
> - Gerçek eksik adayları: uç okeyin alınması, 101'de maç sonu seçeneği, işlek atma cezası (ayar), eşli mod, Acemi bot, `viewFor`'da tüm ıskarta geçmişi (bilinçli olabilir; masada kronoloji göstermek için kullanılıyor mu kontrol edilmeli).
> - Diğer oyunların kuralları web kaynaklıdır. "Doğrulanmalı" işaretliler ve Bölüm 3'teki bölgesel kurallar kullanıcıya sorulmadan varsayılan yapılmaz.

# Demli Kahve — Tüm Oyunlar İçin Eksiksiz Kurallar, Mimari ve Test Şartnamesi

> **Doküman Kimliği:** `DEMLI-KAHVE-KURAL-SARTNAMESI v1.0`  
> **Hazırlayan:** Gemini Argon (Görsel/Etkileşim Lideri & Kural/Doğrulama Mimarı)  
> **Kapsam:** Mevcut Okey motoru (`@okey/shared`) denetimi + 11 oyun (ve alt varyantları) için yazılım ekibinin doğrudan kodlayabileceği deterministik kural, durum makinesi (`apply`), gizli bilgi (`viewFor`), bot (`botMove`/`quickMove`), ev kuralları (`Opts`), 60+ UX ve 275+ somut test senaryosu şartnamesi.  
> **Kırmızı Çizgi:** Mevcut kodda veya dosyalarda hiçbir değişiklik yapılmamıştır.

---

## BÖLÜM 0: Mevcut Okey Kodu Analizi (`@okey/shared`)

İncelenen dosyalar:
- [game.ts](../../../shared/src/game.ts)
- [duz.ts](../../../shared/src/duz.ts)
- [melds.ts](../../../shared/src/melds.ts)
- [solver.ts](../../../shared/src/solver.ts)
- [bot.ts](../../../shared/src/bot.ts)
- [clock.ts](../../../shared/src/clock.ts)
- [tiles.ts](../../../shared/src/tiles.ts)
- [protocol.ts](../../../shared/src/protocol.ts)
- [game.test.ts](../../../shared/test/game.test.ts), [duz.test.ts](../../../shared/test/duz.test.ts), [melds.test.ts](../../../shared/test/melds.test.ts), [pairs.test.ts](../../../shared/test/pairs.test.ts), [clock.test.ts](../../../shared/test/clock.test.ts)
- [PROMPT_LOCAL.md](../../../PROMPT_LOCAL.md), [ORKESTRA.md](../../../docs/kahve/ORKESTRA.md), [types.ts](../../../packages/game-core/src/types.ts)

### 0.1 Mevcut Kodda Olan / Eksik / Yanlış Uygulanmış Kurallar Tablosu

| Kategori / Kural | Durum | Dosya & Satır Referansı | Teknik Açıklama ve Olması Gereken |
| :--- | :--- | :--- | :--- |
| **106 Taş & Dağıtım** | **OLAN (Doğru)** | [tiles.ts](../../../shared/src/tiles.ts#L27-L40), [game.ts](../../../shared/src/game.ts#L157-L177) | 4 renk × 1..13 × 2 + 2 sahte okey = 106 taş. 101'de 22/21/21/21 (+1 gösterge, 20 orta); Düz'de 15/14/14/14 (+1 gösterge, 48 orta) dağıtılıyor. |
| **Okey ve Sahte Okey Tanımı** | **OLAN (Doğru)** | [tiles.ts](../../../shared/src/tiles.ts#L62-L80) | Göstergenin aynı renkte bir üstü (`13 → 1`) gerçek okeydir (`isJoker`). Sahte okey (`kind: 'fake'`) her zaman gerçek okeyin kendi sayı/renk değerini (`faceOf`) taşır. |
| **101 Barajı ve 5 Çift Açma** | **OLAN (Doğru)** | [game.ts](../../../shared/src/game.ts#L238-L272), [melds.ts](../../../shared/src/melds.ts#L171-L185) | Seri/grup açılışında `>= 101`, çift açılışında `>= 5` çift zorunlu. Çift ve seri aynı açılışta karıştırılamaz. Çiftten açan sonradan yeni per açamaz ama çift indirebilir ve mevcut seri/set perlerine taş işleyebilir. |
| **4 Kişi Çift Açarsa İptal** | **OLAN (Doğru)** | [game.ts](../../../shared/src/game.ts#L270), [game.ts](../../../shared/src/game.ts#L504-L508) | 4 oyuncunun tamamı çiftten açarsa el anında iptal olur (`cancelled: true`), o el alınan cezalar dahil herkes `0` puan alır. |
| **Orta Deste Bitince Karıştırma** | **OLAN (Doğru)** | [game.ts](../../../shared/src/game.ts#L394-L407) | 101'de orta deste bitince, son atılan taş hariç tüm ıskartalar `seed + reshuffles` ile deterministik karıştırılıp yeni orta deste yapılır (varsayılan `DEFAULT_RESHUFFLES = 3`). |
| **Alınan Iskartanın Altını Gizleme** | **OLAN (Doğru)** | [game.ts](../../../shared/src/game.ts#L225), [game.ts](../../../shared/src/game.ts#L568-L570) | Soldaki oyuncunun en üst taşı alındığında `topTaken = true` olur ve o oyuncu yeni taş atana kadar önceki turda attığı alttaki taş görünmez (`visibleDiscard` `undefined` döner). |
| **Tur Saati ve Tek Seferlik Dolum** | **OLAN (Doğru)** | [clock.ts](../../../shared/src/clock.ts#L15-L36) | İlk tur 60 sn (`turnNumber === 0`), sonraki turlar 30 sn. Her turda ilk `open`, `meld` veya `addToMeld` hamlesi saati bir kez 30 sn'ye doldurur (`refilled: true`). |
| **Seri Uçlarındaki Okeyi Alma (`okeySwap`)** | **YANLIŞ UYGULANMIŞ** | [melds.ts](../../../shared/src/melds.ts#L136-L144) | `!realValues.some((v) => v < face.value) \|\| !realValues.some((v) => v > face.value)` koşulu yüzünden yalnızca serinin *ortasındaki* okey alınabiliyor. Oysa **`Mavi 11 - Mavi 12 - Okey`** perinde 14 sayısı olmadığı için Okey kesin olarak `Mavi 13`'tür ve **`Okey - Mavi 2 - Mavi 3`** perinde 0 sayısı olmadığı için Okey kesin olarak `Mavi 1`'dir; bu uçtaki okeylerin gerçek taşı (`Mavi 13` veya `Mavi 1`) işlendiğinde okeyin oyuncuya geçmesi gerekirken mevcut kod okeyi vermiyor! Ayrıca `Okey - Mavi 5 - Mavi 6` gibi iki yöne de uzayabilen bir perin iki ucu (`Mavi 4` ve `Mavi 7`) tamamlandığında da okey boşa çıkmalıdır. |
| **Elde Kalan Gerçek Okeyin Cezası** | **YANLIŞ UYGULANMIŞ** | [tiles.ts](../../../shared/src/tiles.ts#L90-L100), [game.ts](../../../shared/src/game.ts#L471-L472) | `handPenalty` fonksiyonu elde kalan gerçek okey için hem `okeys++` (`+101` ceza) yapıyor **hem de** `sum += okey.value` diyerek okeyin sayı değerini de ekliyor (`(okey.value * multiplier) + 101`). Oysa kahvehane ve resmi 101 kuralında elde kalan **gerçek okey** kendi rakam değerini yazmaz, sadece sabit **101** (veya katlamalıda 202) ceza yazar; yalnızca **sahte okey** elde kalırsa okeyin rakam değerini yazar. |
| **101'de "Elden Bitme" Tanımı** | **YANLIŞ UYGULANMIŞ** | [game.ts](../../../shared/src/game.ts#L462-L463) | Kodda `elden`, sadece *masadaki diğer 3 oyuncunun hiçbiri el açmamışsa* (`state.players.every((p) => p.seat === winner \|\| !p.opened)`) `true` oluyor. Oysa 101 kuralında "elden bitme", **biten oyuncunun kendi elini daha önce hiç açmamışken tek turda açıp bitirmesidir**. Başka bir oyuncu daha önce açmış olsa dahi, ilk kez açtığı turda biten oyuncu "elden bitmiş" sayılır; açmamışlar `404`, açmışlar ise `el_toplamı × 2` ceza yer. |
| **101'de Yandan Taş Alma Zorunluluğu** | **YANLIŞ / EKSİK** | [game.ts](../../../shared/src/game.ts#L222-L228), [game.ts](../../../shared/src/game.ts#L363-L366) | Mevcut kodda elini açmamış bir oyuncu soldan taş alıp **hiç açmadan** başka bir taş atabiliyor ve taşı elinde tutup `+101` ceza yazılıyor. Gerçek 101'de: (1) Henüz açmamış oyuncu yandan aldığı taşı **o tur açacağı perlerde/çiftlerde kullanmak zorundadır**, açamıyorsa yandan taş çekmesi engellenmeli (veya taş geri iade edilip `+101` ceza yazılarak desteden çektirilmeli). (2) Açmış oyuncu da yandan aldığı taşı o tur masaya indirmek veya işlemek zorundadır. |
| **Düz Okey Gösterge Puanı Hesabı** | **YANLIŞ UYGULANMIŞ** | [game.ts](../../../shared/src/game.ts#L484-L491) | `scoreDuz` içinde gösterge cezası el sonunda hesaplanıyor ve **eli kazanan oyuncuya bile** o el gösterge yapıldıysa `+1` puan kaybı yazılıyor (`scores: [1, 5, 4, 5]`). Gösterge puanı el içinde anlık düşülmeli veya el sonunda gösterge yapan dışındaki oyunculardan düşülürken ayar ile kontrol edilmelidir. Ayrıca gösterge sadece taş çekmeden önce (`turnPhase === 'draw'`) yapılabiliyor; birçok kahvehanede ilk turda taş çektikten sonra (taş atmadan önce) de gösterge yapılabilir. |
| **101'de İşlek Taş Atma Cezası** | **EKSİK** | [game.ts](../../../shared/src/game.ts#L357-L386) | Masadaki açık perlere işlenebilen (`addableTiles` içinde yer alan) bir taşı yere (ıskartaya) atmanın `+101` puan cezası (`islekAtmaCezasi`) kodda hiç uygulanmamış. |
| **Katlamalı 101 (Artan Baraj)** | **EKSİK** | [game.ts](../../../shared/src/game.ts#L19), [melds.ts](../../../shared/src/melds.ts#L171) | Baraj sabit `101` ve `5` çift. Katlamalı 101'de masada son açan oyuncunun açtığı sayının `+1` fazlası (örn. 112 ile açıldıysa 113) ve son çift açanın `+1` fazlası (5 → 6 → 7 çift) baraj olmalıdır. |
| **Eşli 101 ve Eşli Düz Okey** | **EKSİK** | [game.ts](../../../shared/src/game.ts#L459-L493) | Karşılıklı koltukların `(0-2, 1-3)` takım olduğu Eşli mod hiç yok (bir eş bitince diğer eşin ceza yememesi, eşin okeyini alınca ceza yazılmaması, takım puanı toplamı). |
| **Yere Atılan Okeyin Alınamaması** | **EKSİK** | [game.ts](../../../shared/src/game.ts#L221-L228) | Bir oyuncu (101'de ceza yiyerek veya Düz Okey'de) yere gerçek okey atarsa, sağındaki oyuncunun bu okeyi yandan alıp alamayacağı kontrol edilmiyor (standart kuralda yere atılan okey yandan alınamaz). |
| **101 Okey Maç Bitişi (`matchOver`)** | **EKSİK** | [game.ts](../../../shared/src/game.ts#L495-L497) | `matchOver` 101 modunda her zaman `false` dönüyor. Belirli el sayısı (`5 / 7 / 11 el`) veya ceza barajı (`501 / 1001 puan`) ile maç bitirme seçeneği yok. |
| **Acemi (`easy`) Bot Seviyesi** | **EKSİK** | [bot.ts](../../../shared/src/bot.ts#L7) | `@kahve/core` `BotLevel = 'easy' \| 'medium' \| 'hard'` beklerken `shared/src/bot.ts` sadece `'medium' \| 'hard'` tanımlıyor. |
| **ViewFor İçinde Tüm Iskarta Geçmişi** | **GİZLİ BİLGİ UYARISI** | [game.ts](../../../shared/src/game.ts#L585) | `viewFor` içinde `discards: p.discards` olarak oyuncunun o ana kadar attığı tüm taşların tam dizisi istemciye gönderiliyor. Fiziksel masada yalnızca en üstteki taş görünür; hafıza hilesini önlemek için `viewFor` sadece görünür üst taşı (`topDiscard: Tile \| null`) göndermeli veya "hafıza yardımı" ayarına bağlamalıdır. |

---

## BÖLÜM 1: Tüm Oyunlar İçin Ortak Terimler Sözlüğü

| Terim | Tanım |
| :--- | :--- |
| **Masa (Room / Table)** | Oyuncuların ve/veya botların oturduğu, ortak oyun durumunu (`GameState`) ve tur saatini (`TurnClock`) barındıran sanal kahvehane birimi. |
| **Koltuk (Seat)** | `0` ile `seats - 1` arasındaki tam sayı indeks. 4 kişilik oyunlarda saat yönünün tersine (sağdan sola): `0` (Güney/Oyuncu), `1` (Doğu/Sağ), `2` (Kuzey/Karşı - Eşli oyunda 0'ın ortağı), `3` (Batı/Sol). 2 kişilik oyunlarda `0` ve `1`. |
| **Tur Yönü (Turn Order)** | Türk kahvehane geleneğine uygun olarak tüm taş ve kağıt oyunlarında sıra **saat yönünün tersine** (`nextSeat = (seat + 1) % seats`, yani sağdaki koltuğa) ilerler. |
| **El / Tur (Round / Hand)** | Taşların/kartların/pulların dağıtılmasından o elin puanlarının (`scoreRound`) yazılıp bitmesine kadar geçen tek oyun döngüsü. |
| **Parti / Maç (Match)** | `matchOver(totals, rounds, opts)` koşulu sağlanana kadar oynanan eller bütünü. |
| **Istaka (Rack)** | Okey, 101, Domino gibi taş oyunlarında oyuncunun kendi taşlarını dizdiği iki veya tek katlı özel alan. |
| **Per (Meld)** | Okey, 101, Konken ve 51'de geçerli taş/kart grubu. Üç türü vardır: **Seri (`run`)** (aynı renk ardışık en az 3 taş/kart), **Grup/Set (`set`)** (farklı renklerde aynı sayıdan 3 veya 4 taş/kart) ve **Çift (`pair`)** (birebir aynı renk ve sayıdan 2 taş/kart). |
| **Gösterge (Indicator)** | Okey/101'de dağıtım sonunda açık bırakılan ve aynı rengin bir üst sayısını **Okey (Joker)** yapan taş. Düz Okey'de ve 51/Konken'in bazı varyantlarında elinde eşini bulunduran oyuncuya avantaj sağlar. |
| **Gerçek Okey / Joker** | İstendiği taşın/kartın yerine geçebilen joker. |
| **Sahte Okey (Fake Okey)** | Üzerinde sayı olmayan özel taş; sadece o elin gerçek okeyi hangi taşsa onun gerçek sayı ve rengini temsil eder (joker değildir). |
| **İşlek Taş / Kart** | Masada halihazırda açılmış bir pere kurallara uygun olarak eklenebilen (veya yerdeki okeyi alabilen) taş/kart. |
| **Elden Bitme** | Oyuncunun daha önce masaya hiç per açmamışken, tek bir turda elindeki tüm taşları/kartları kurallara uygun açıp/işleyip son taşını/kartını atarak eli bitirmesi. |
| **İhale (Bid)** | Batak'ta oyuncunun o el almayı taahhüt ettiği minimum el (löve) sayısı. |
| **Koz (Trump)** | Batak ve King'de diğer üç renkten üstün olan, dönen renk elde olmadığında çakılarak eli kazanan renk (suit). |
| **Löve / El Alma (Trick)** | Batak ve King'de masadaki 4 oyuncunun sırayla birer kart atmasıyla oluşan 4 kartlık grup ve bunu en üstün kartla kazanma eylemi. |
| **Çakmak / Üstüne Çakmak** | İstenen renkten elde kart olmadığında koz atmak (`çakmak`); benden önce koz atılmışsa daha büyük bir koz atmak (`üstüne çakmak`). |
| **Yanık / Revör** | Elde dönen renkten kart varken başka renk atmak veya büyütme zorunluluğu varken küçük kart atmak. Dijital motorda `apply` tarafından doğrudan engellenir (`{ ok: false, error }`). |
| **Sanzatu (No Trump)** | Kozsuz oyun. |
| **Pişti** | Pişti oyununda yerde yalnızca 1 kart varken, üzerine aynı değerde kart (Vale hariç, Vale yalnızca Vale'ye pişti yapar) atarak alma durumu. |
| **Kapı (Point)** | Tavlada bir hanede aynı oyuncuya ait en az 2 pul bulunması (Gülbara'da 1 pul, Tapa'da rakip pul üstüne 1 pul). |
| **Kırık / Bar** | Klasik tavlada tek duran açık pulun rakip tarafından vurularak orta bölmeye (bara) çıkarılması. |
| **Esir / Hapis (Pin)** | Tapa tavlasında rakibin tek duran pulunun üzerine kendi pulunu koyarak onu kendi pulun kalkana kadar hareketsiz bırakma. |
| **Mars (Gammon)** | Tavlada bir oyuncu 15 pulunun tamamını topladığında rakibin henüz **hiç pul toplamamış** olması (2 puan). |
| **Konçina / Çifte Mars (Backgammon)** | Tavlada mars olan rakibin, kazanan oyuncunun iç sahasında (1–6 hanelerinde) veya barda (Tapa'da esir altında) hâlâ en az 1 pulunun bulunması (3 puan). *(Not: Konçina kelimesi bazı yörelerde 52'lik kart oyunu için de kullanılır; tavlada "Çifte Mars / Katmerli Mars / Konçina" 3 sayılık bitişi ifade eder).* |
| **Yoz Taş & Dama** | Türk Daması'nda başlangıçtaki normal taşlara **yoz taş**, son yatay sıraya ulaşan taşa **dama** denir. |
| **Gayyım** | Türk Daması'nda iki oyuncunun da 1'er taşı kalması veya hamle sınırı dolmasıyla oluşan beraberlik. |
| **Ayaz (0-0) & Kilit** | Domino'da iki ucu boş taş (`0-0` = Ayaz); kimsenin oynayacak taşı kalmaması durumu (`Kilit / Bağlanma`). |

---

## BÖLÜM 2: Ortak Ayar Nesnesi Yapısı (TypeScript Tip Taslağı)

Aşağıdaki tip tanımları `@kahve/core` içindeki `GameDefinition<S, A, V, Opts>` sözleşmesiyle birebir uyumludur ve JSON serileştirilebilir (`Map`/`Set`/`class` içermez) yapıdadır:

```ts
// Tüm oyun kimlikleri (mevcut + yakında eklenecekler)
export type KahveGameId =
  | 'okey101'
  | 'okeyDuz'
  | 'pisti'
  | 'batak'
  | 'king'
  | 'konken'
  | 'elli1'
  | 'papazKacti'
  | 'tavla'
  | 'turkDamasi'
  | 'domino';

export type BotLevel = 'easy' | 'medium' | 'hard';

/** Her oyunun Opts tipinin genişlettiği temel masa ayarları */
export interface BaseGameOptions {
  /** Tur başına düşünme süresi (ms). 0 = süresiz (yalnızca çevrimdışı/özel masa). */
  turnTimeoutMs: number;
  /** İlk tur çarpanı (varsayılan 2 = 60 sn). */
  firstTurnFactor: number;
  /** Çevrimdışı veya bot devralmada bot zorluk seviyesi. */
  botLevel: BotLevel;
}

/** 1. 101 Okey Ayarları */
export interface Okey101Options extends BaseGameOptions {
  partnerMode: boolean;              // false = Tekli, true = Eşli (0-2 vs 1-3)
  folding: boolean;                  // false = Katlamasız (sabit 101 / 5 çift), true = Katlamalı (son açan + 1)
  takeOkeyFromTable: boolean;        // true = Yerdeki okeyi alma açık
  okeyTakenPenalty: 0 | 101;         // 101 = Okeyi çalınan oyuncuya 101 ceza (eşinden alınırsa 0)
  throwableMeldTilePenalty: 0 | 101; // 101 = İşlek taş atana 101 ceza
  strictSidePickup: boolean;         // true = Yandan alınan taşla o tur açmak/işlemek zorunlu (yoksa hamle reddedilir)
  allowPickupThrownOkey: boolean;    // false = Yere atılan okeyi yan oyuncu alamaz
  reshuffles: 0 | 1 | 2 | 3;         // Orta deste bitince ıskartaları karıştırma hakkı (varsayılan 3)
  okeyInHandCountsFace: boolean;     // false = Elde kalan okey sadece 101 yazar; true = 101 + kendi sayısını yazar
  eldenScope: 'self' | 'table';      // 'self' = Kendisi ilk açtığı turda biterse elden; 'table' = Kimse açmamışsa elden
  matchEndMode: 'rounds' | 'points' | 'endless'; // 'rounds' = El sayısı, 'points' = Ceza limiti, 'endless' = Süresiz
  targetRounds: 5 | 7 | 9 | 11;      // matchEndMode === 'rounds' ise
  targetPoints: 501 | 1001;          // matchEndMode === 'points' ise
}

/** 2. Düz Okey Ayarları */
export interface OkeyDuzOptions extends BaseGameOptions {
  partnerMode: boolean;              // false = Tekli, true = Eşli
  startPoints: 10 | 15 | 20;         // Başlangıç puanı (varsayılan 20, sıfıra düşen biter)
  gostergePoints: 0 | 1 | 2;         // Gösterge puanı (varsayılan 1; 0 = gösterge kapalı)
  gostergeTiming: 'beforeDraw' | 'firstTurnAnytime'; // Taş çekmeden önce vs ilk turda taş atmadan önce
  allowSevenPairs: boolean;          // true = 7 çift ile bitiş açık (×2 çarpan)
  colorHandMultiplier: boolean;      // false = Kapalı, true = Tek renk 14 taşla bitiş ×4 çarpan
  allowPickupThrownOkey: boolean;    // false = Yere atılan okey yandan alınamaz
}

/** 3. Pişti Ayarları */
export interface PistiOptions extends BaseGameOptions {
  seats: 2 | 4;                      // 2 veya 4 oyuncu
  partnerMode: boolean;              // 4 kişide: true = Eşli (0-2 vs 1-3), false = Tekli
  targetScore: 51 | 101 | 151 | 201; // Bitiş puanı (varsayılan 151)
  firstDealPistiAllowed: boolean;    // false = İlk 4 kartta yere tek kart kalırsa/başlangıçta pişti olmaz, true = Olur
  blindCenterVisibleOnTake: boolean; // true = İlk 3 kapalı kartı ilk alan oyuncu ve herkes görür, false = Sadece alan görür
  pistiPoints: 10;                   // Normal pişti puanı (10)
  jackPistiPoints: 20;               // Vale pişti puanı (20)
}

/** 4. Batak Ayarları */
export interface BatakOptions extends BaseGameOptions {
  variant: 'ihaleli' | 'kozMaca' | 'esli' | 'gommeli';
  seats: 3 | 4;                      // Gömmeli'de 3 veya 4; diğerlerinde 4
  targetRounds: 5 | 7 | 9 | 11 | 13; // Kaç el oynanacağı (varsayılan 9)
  minBid: 4 | 5 | 8;                 // İhaleli tekli: 5 (veya 4), Eşli: 8
  forcedDealerBid: 4 | 7;            // Herkes pas derse ihale kime kaça kalır (tekli 4, eşli 7)
  mustRaise: boolean;                // true = Masadaki kartı geçmek (büyütmek) zorunlu
  mustTrump: boolean;                // true = Renk yoksa koz atmak (çakmak) zorunlu
  trumpLeadNeedsBreak: boolean;      // true = Koz kırılmadan (yere koz düşmeden) koz çıkılamaz
  zeroTrickPenalty: 'bid' | 'fixed5' | 'none'; // Hiç el alamayana ceza: ihale bedeli kadar eksi / -5 / ceza yok
  kozMacaOvertrickLimit: 2 | 3 | 0;  // Koz Maça'da taahhüdün kaç fazlasında yanar (varsayılan 2; 0 = sınırsız)
  kanliGommeli: boolean;             // Gömmeli'de: true = Yerdeki 4 kartı görmeden gömer
  sariKirmiziKing: boolean;          // true = 11+ (veya 13) el deklare edip alınca doğrudan maçı kazanır
}

/** 5. King (Rıfkı) Ayarları */
export interface KingOptions extends BaseGameOptions {
  partyLength: 20 | 12;              // 20 el (12 ceza + 8 koz) veya hızlı 12 el (6 ceza + 6 koz)
  allowSanzatu: boolean;             // true = Koz hakkı Sanzatu (kozsuz) olarak seçilebilir
  heartsBrokenRule: boolean;         // true = Kupa Almaz ve Rıfkı'da kupa çıkmadan kupa çıkılamaz
  mustDiscardRifkiOrQueen: boolean;  // true = Renk yoksa Rıfkı/Kız/Kupa atmak (yemekten kaçmak/yedirmek) zorunlu
  kingInstantWin: boolean;           // true = Koz oyununda 13 elin tamamını alan partiyi anında kazanır
  maxSamePenaltyPerPlayer: 1 | 2;    // Bir oyuncu aynı cezayı en fazla kaç kez seçebilir (varsayılan 2)
}

/** 6. Konken Ayarları */
export interface KonkenOptions extends BaseGameOptions {
  variant: 'classic10' | 'rummy14';  // 'classic10' = 10 kağıt klasik Konken, 'rummy14' = 14 kağıt Konken
  seats: 2 | 4;                      // 2 veya 4 oyuncu
  openThreshold: 0 | 51;             // Klasik 10 kağıtta 0 (barajsız), 14 kağıtta 51
  enableBettingPool: boolean;        // Klasik 10 kağıtta Mecburcu / Kabul / Rölans / Sür-Rölans sanal çip havuzu
  aceWrapAllowed: boolean;           // false = K-A-2 yasak; A-2-3 ve Q-K-A geçerli
  targetRounds: 5 | 7 | 11;          // Maç uzunluğu
}

/** 7. 51 (Elli Bir) Ayarları */
export interface ElliBirOptions extends BaseGameOptions {
  partnerMode: boolean;              // false = Tekli, true = Eşli
  progressiveThreshold: boolean;     // true = Kademeli baraj (ilk açan 51+, sonrakiler önceki açan + 1), false = Sabit 51
  pairsToOpen: 4 | 5;                // 5 çift veya (4 çift + 1 per)
  strictSidePickup: boolean;         // true = Yandan alınan kartla o tur açmak zorunlu
  throwableMeldCardPenalty: 0 | 51;  // İşlek kart atma cezası (0 veya 51)
  notOpenedPenalty: 100 | 200;       // Hiç açamayanın cezası (varsayılan 100, elden bitişte ×2)
  targetPoints: 301 | 501;           // Bu ceza puanına ulaşan kaybeder
}

/** 8. Papaz Kaçtı Ayarları */
export interface PapazKactiOptions extends BaseGameOptions {
  seats: 2 | 3 | 4;                  // Oyuncu sayısı (varsayılan 4)
  removedKings: 'random3' | 'keepSpadeKing'; // 'keepSpadeKing' = Sadece Maça Papazı (Kara Papaz) kalır, 'random3' = Gizli 1 papaz kalır
  pairColorMatch: 'any' | 'sameColor'; // 'any' = Herhangi iki aynı sayı eşleşir, 'sameColor' = Kırmızı-kırmızı / siyah-siyah eşleşir
  shuffleHandOnPick: boolean;        // true = Çekilen oyuncunun eli her çekiş öncesi karıştırılır
  targetRounds: 1 | 3 | 5;           // Kaç el sonunda en az papazda kalan kazanır
}

/** 9. Tavla Ayarları */
export interface TavlaOptions extends BaseGameOptions {
  variant: 'klasik' | 'gulbara' | 'tapa';
  targetScore: 1 | 3 | 5 | 7;        // Maç bitiş sayısı (varsayılan 5; 1 = tek oyun)
  koncinaPoints: 2 | 3;              // 3 = Çifte mars (Konçina) 3 sayı, 2 = Her mars 2 sayı
  gulbaraDoublesChain: 'none' | 'allUp' | 'fromFirst'; // Gülbara'da çift zar zinciri (örn. 2-2 oynayınca 3-3..6-6'ya kadar oynama)
  autoBearOffExactIfOnlyMove: boolean; // Tek yasal hamle varsa otomatik tamamla (false = oyuncu dokunur)
}

/** 10. Türk Daması Ayarları */
export interface TurkDamasiOptions extends BaseGameOptions {
  mandatoryMaxCapture: boolean;      // true = TÜDAF resmi kuralı: en çok taş alan yolu seçmek zorunlu
  singlePieceDrawRule: boolean;      // true = 1'e 1 taş kaldığında anında beraberlik (Gayyım)
  maxMovesWithoutCapture: 40 | 60;   // Taş alınmadan yapılan hamle sınırı (beraberlik)
  matchRounds: 1 | 3 | 5;            // Maçtaki oyun sayısı
}

/** 11. Domino Ayarları */
export interface DominoOptions extends BaseGameOptions {
  variant: 'klasikCezali' | 'besinKatlari'; // 'klasikCezali' = Blok/Cezalı Türk usulü, 'besinKatlari' = Aznif / 5 ve katları puanlı
  seats: 2 | 4;                      // 2 veya 4 oyuncu
  partnerMode: boolean;              // 4 kişide eşli mi
  targetScore: 101 | 151 | 201;      // Bitiş puanı (varsayılan 101; 5'in katlarında 150/200)
  ayazPenalty: 0 | 10 | 20;          // Elde tek başına 0-0 (Ayaz) kalırsa yazılacak puan (varsayılan 10, 5'in katlarında 20)
  minDrawStockRemaining: 0 | 2;      // Pazarda (bankada) bırakılacak kapalı taş sayısı (2 kişide 2 taş kapalı kalır)
  spinnerMode: 'none' | 'firstDouble'; // 'firstDouble' = İlk atılan çift 4 yöne de kol açabilir, 'none' = Sadece 2 uç
}
```

---

## OYUN 1: 101 OKEY (Tekli ve Eşli, Katlamalı ve Katlamasız)

### 1. Malzeme ve Kurulum
- **Malzeme:** 106 taş: 4 renk (`red` Kırmızı ●, `yellow` Sarı ▲, `blue` Mavi ■, `black` Siyah ◆) × `1..13` arası ikişer kopya (104 normal taş) + 2 adet **Sahte Okey (`fake`)**.
- **Oyuncu Sayısı ve Oturuş:** 4 oyuncu (`seat 0, 1, 2, 3`). Eşli modda (`partnerMode: true`) `0` ile `2` (Takım A) ve `1` ile `3` (Takım B) ortaktır.
- **Dağıtım ve Başlangıç:**
  - İlk el `startingSeat = 0`, sonraki ellerde `round % 4` (saat yönünün tersine bir sağdaki koltuk) başlar.
  - Başlayan oyuncuya **22 taş**, diğer 3 oyuncuya **21'er taş** dağıtılır.
  - Kalan 21 taştan ilk normal taş (`kind === 'normal'`) **Gösterge** olarak açık konur; kalan **20 taş** orta desteyi (`deck`) oluşturur.
- **Okey Belirleme:** Gösterge taşının aynı renkten bir üst sayısı (`13` ise `1`) o elin **Gerçek Okey** taşlarıdır (2 adet). İki **Sahte Okey**, o elin gerçek okeyi hangi renk ve sayı ise tam olarak o taşın yerine geçer.

### 2. Tur Akışı Adım Adım
1. **Başlangıç Turu (`turnNumber === 0`, `startingSeat`):** Başlayan oyuncunun elinde 22 taş vardır; `turnPhase = 'play'` ile başlar (taş çekmez). İsterse elini açabilir (`open`), ardından 1 taş atarak (`discard`) sırayı `(seat + 1) % 4`'e devreder.
2. **Çekme Fazı (`turnPhase === 'draw'`):** Sıradaki oyuncu:
   - Orta desteden kapalı taş çeker (`{ type: 'draw', source: 'deck' }`), **VEYA**
   - Solundaki oyuncunun (`leftOf(seat)`) son attığı taşı alır (`{ type: 'draw', source: 'discard' }`).
3. **Oynama Fazı (`turnPhase === 'play'`):** Oyuncu elinde 22 taş (veya önceki turlarda açtıysa kalan taş + 1) varken:
   - Henüz açmadıysa `open` ile seri/set perleri veya çiftler açabilir.
   - Açtıysa (veya eşli modda kurallara göre eşi açtıysa) `meld` ile yeni per/çift indirebilir, `addToMeld` ile masadaki perlere taş işleyebilir veya yerdeki okeyi alabilir (`okeySwap`).
4. **Atma Fazı (`discard`):** Oyuncu ıstakasında en az 1 taş bırakmak zorundadır ve bu son kalan 1 taşı (veya elindeki taşlardan birini) sağ tarafına açık olarak atar (`{ type: 'discard', tileId }`).
   - Attıktan sonra `hand.length === 0` ise el biter (`finishRound`).
   - Aksi halde orta deste boşsa ve `reshufflesLeft > 0` ise ıskartalar (son atılan taş hariç) karıştırılır; `reshufflesLeft === 0` ise el berabere biter.

### 3. Geçerli / Geçersiz Hamle Kuralları ve Tüm Kenar Durumlar
1. **Per Kuralları (`analyzeMeld`):**
   - **Grup/Set (`set`):** Aynı sayıdan, **farklı renklerde** 3 veya 4 taş (örn. K7-M7-S7). Aynı renkten iki taş aynı sette bulunamaz.
   - **Seri (`run`):** Aynı renkten ardışık en az 3, en fazla 13 taş (`1..13`). **`13-1-2` veya `12-13-1` döngüsü geçersizdir.**
   - **Çift (`pair`):** Aynı renk ve aynı sayıdan 2 taş (örn. Mavi 8 - Mavi 8). Gerçek okey her taşla çift olur; iki sahte okey birbiriyle (veya gerçek okeyin eşiyle) çift olur.
2. **El Açma Barajı (`open`):**
   - **Katlamasız (`folding: false`):** Seri/set toplamı en az **101 sayı** VEYA en az **5 çift** olmalıdır.
   - **Katlamalı (`folding: true`):** Masada henüz kimse seri/set açmadıysa baraj **101**, birisi `P` puanla açtıysa bir sonraki seri/set açacak oyuncunun barajı **`P + 1`** olur. Çift açmada ise ilk çift açan **5 çift**, ikincisi **6 çift**, üçüncüsü **7 çift**, dördüncüsü **8 çift** açmak zorundadır.
   - Seri/set ile çift aynı açılışta karıştırılamaz.
   - Açılış yapıldıktan sonra oyuncunun ıstakasında **atmak için en az 1 yasal taş** kalmalıdır (`keepsDiscard`). Tüm 22 taşı yere indirip atacak taş bırakmamak **geçersizdir**.
3. **Çiftten Açan Oyuncunun Kısıtları:**
   - Çiftten açan oyuncu sonraki turlarda **asla yeni seri veya set per indiremez**; yalnızca yeni çift indirebilir.
   - Ancak çiftten açan oyuncu, diğer oyuncuların masaya açtığı **seri ve set perlerine taş işleyebilir (`addToMeld`) ve yerdeki okeyi alabilir (`okeySwap`)**.
   - Masadaki çiftlerin üzerine 3. taş işlenemez.
   - **4 Oyuncu da Çift Açarsa:** 4. oyuncu da çiftten açtığı anda el iptal olur (`cancelled: true`), o elki cezalar silinir ve herkes `0` puan alır.
4. **Soldan (Yandan) Taş Alma Kuralları (`strictSidePickup`):**
   - **Sıkı Kural (`strictSidePickup: true`, Varsayılan Kahvehane Kuralı):**
     - Henüz elini açmamış bir oyuncu soldan taş alırsa, **o tur içinde elini açmak ve aldığı taşı açtığı perlerin/çiftlerin içinde kullanmak zorundadır**. Eğer oyuncunun eli (aldığı taş dahil) açma barajına (101 veya 5 çift) yetmiyorsa, `draw(discard)` hamlesi doğrudan reddedilir (`"Yandan taş almak için o taşla elinizi açabilmelisiniz"`), ya da oyuncu taşı alıp vazgeçerse taş sol oyuncunun ıskartasına geri konur, oyuncuya **+101 ceza** yazılır ve oyuncu orta desteden taş çekmeye zorlanır.
     - Elini daha önce açmış bir oyuncu soldan taş alırsa, aldığı taşı **o tur içinde** ya yeni bir perde/çiftte indirmeli ya da masadaki bir pere işlemelidir.
   - **Esnek Kural (`strictSidePickup: false`, Mevcut Kod Davranışı):** Yandan alınan taş geri atılamaz ve elde tek başına kalamaz; kullanılmadan başka taş atılırsa oyuncuya **+101 ceza** (`UNUSED_DISCARD_PENALTY`) yazılır.
5. **Yerdeki Okeyi Alma (`okeySwap` — Düzeltilmiş Kenar Durumlar):**
   - Oyuncu yalnızca **kendi elini açtıktan sonra** masadaki bir perden okey alabilir.
   - **Set (Grup) Perinden Okey Alma:**
     - `3 taşlı sette 1 okey varsa` (örn. K9-M9-Okey): Eksik olan iki renkten (Sarı 9 ve Siyah 9) **ikisi de** eklendiğinde (tek hamlede veya farklı turlarda sırayla) 4 renk tamamlanır ve okey oyuncunun eline geçer.
     - `4 taşlı sette 1 okey varsa` (örn. K9-M9-S9-Okey): Eksik olan tek renk (Siyah 9) işlendiği anda okey oyuncunun eline geçer.
     - `Sette 2 okey varsa`: 4 gerçek renk tamamlandığında iki okey birden alınır.
   - **Seri (`run`) Perinden Okey Alma:**
     - Okey serinin **ortasındaysa** (örn. M6-Okey-M8): Temsil ettiği taş (`M7`) işlendiğinde okey alınır.
     - Okey serinin **kesin ucundaysa**: **`Okey-M2-M3`** perinde okey yalnızca `M1` olabilir; `M1` işlendiğinde okey alınır! **`M11-M12-Okey`** perinde okey yalnızca `M13` olabilir; `M13` işlendiğinde okey alınır!
     - Okey serinin **iki yöne de uzayabilen ucundaysa** (örn. `M5-M6-Okey`): Okey hem `M4` hem `M7` yerine geçebileceği için, ilk uç (örn. `M7`) işlendiğinde seri `M4(Okey)-M5-M6-M7` olur (okey alınmaz); ikinci uç (`M4`) da işlendiğinde okey boşa çıkar ve alınır!
   - **Ceza:** Alınan okey başka bir oyuncunun (eşli modda karşı takımın) perindeyse, o perin sahibine okey başına **+101 ceza** (`OKEY_TAKEN_PENALTY`) yazılır. Kendi perinden veya eşinin perinden okey almanın cezası **0**'dır.
6. **İşlek Taş Atma (`throwableMeldTilePenalty`):**
   - Elini açmış bir oyuncu, masadaki mevcut perlerden herhangi birine işlenebilen (`addableTiles` içinde bulunan, gerçek okey hariç) bir taşı ıskartaya atarsa **+101 ceza** alır (taş yine de atılır).
7. **Yere Okey Atma ve Yerdeki Okeyin Alınamaması:**
   - Elini bitirmeyen (`hand.length > 0` kalan) bir oyuncu ıskartaya gerçek okey atarsa **+101 ceza** (`OKEY_DISCARD_PENALTY`) alır.
   - `allowPickupThrownOkey: false` (varsayılan) iken, ıskartaya atılan gerçek okeyi sağdaki oyuncu **yandan alamaz** (`"Yere atılan okey yandan alınamaz"`).

### 4. Puanlama Tablosu, Cezalar, Bitiş Koşulu ve Beraberlik Bozma

| Durum | Tekli 101 Puanı | Eşli 101 Puanı (Takım Toplamı) |
| :--- | :--- | :--- |
| **Normal Bitiş (Biten Oyuncu)** | `-101` | `-101` (Bitenin ortağına `0` yazılır, elindeki taşlar **sayılmaz**) |
| **Okeyle Bitiş (`okeyFinish`)** | Çarpan `×2` (`-202`) | Çarpan `×2` (`-202`) |
| **Çiftten Açıp Bitiş (`pairsFinish`)** | Çarpan `×2` (`-202`) | Çarpan `×2` (`-202`) |
| **Elden Bitiş (`elden`)** | Çarpan `×2` (`-202`) | Çarpan `×2` (`-202`) |
| **Kombinasyon Çarpanı (`multiplier`)** | `(okeyFinish ? 2 : 1) × (elden ? 2 : 1) × (pairsFinish ? 2 : 1)` (Maks: `×8`, yani `-808`) | Aynı çarpan (`-202`, `-404`, `-808`) |
| **Hiç Açamamış Rakip** | `202 × multiplier` (`202 / 404 / 808 / 1616`) | Karşı takımda açamayan her oyuncu için `202 × multiplier` |
| **Seri/Set Açmış Rakip** | `(Kalan Taş Sayı Toplamı) × multiplier` | Karşı takımda açmış oyuncunun kalan taş toplamı `× multiplier` |
| **Çiftten Açmış Rakip** | `(Kalan Taş Sayı Toplamı) × 2 × multiplier` | `(Kalan Taş Sayı Toplamı) × 2 × multiplier` |
| **Elde Kalan Gerçek Okey** | Okey başına sabit **`+101`** (çarpılmaz; `okeyInHandCountsFace: false` ise kendi sayısı eklenmez) | Okey başına sabit **`+101`** (kazanan oyuncunun ortağının elinde okey kalsa bile ceza **yazılmaz**!) |
| **Elde Kalan Sahte Okey** | Gerçek okeyin sayı değeri (`okey.value`) olarak el toplamına katılır | Gerçek okeyin sayı değeri olarak el toplamına katılır |
| **Oyun İçi Anlık Cezalar** | İşlek atma `+101`, Okey çaldırma `+101`, Okey atma `+101`, Yandan alıp kullanmama `+101` (hiçbiri el sonu çarpanıyla çarpılmaz) | Takım hanesine `+101` olarak eklenir (kazanan takımın oyun içi cezaları silinmez, korunur) |
| **Deste Bitmesi (Kimse Bitemezse)** | Kazanan yok (`winner: null`, `multiplier: 1`). Açmayanlar `202`, açanlar `el_toplamı` (çiftçiler `×2`) + elde okey `+101` + oyun içi cezalar. | Her iki takımda da herkesin cezası (açmayan `202`, açan `el_toplamı`) toplanır. |

- **Bitiş Koşulu ve Beraberlik Bozma:**
  - En düşük toplam puana sahip oyuncu/takım 1. olur.
  - `matchEndMode === 'rounds'` (örn. 7 el) veya `'points'` (bir oyuncu/takım `>= 1001` puana ulaştığında) maç biter.
  - Maç sonunda en düşük puanda eşitlik varsa: (1) Daha çok el kazanan (`winner` sayısı), (2) Hâlâ eşitse **1 uzatma eli** oynanır.

### 5. Yaygın Ev Kuralları ve Varyantlar (Ayarlar)

| Ayar Adı | Varsayılan | Olası Değerler | Ne Değiştirir? |
| :--- | :--- | :--- | :--- |
| `partnerMode` | `false` | `true`, `false` | `true` ise koltuk `0-2` ve `1-3` eş olur; bitenin eşine el sonu cezası yazılmaz. |
| `folding` | `false` | `true`, `false` | `true` ise Katlamalı 101: her yeni açılış bir öncekinden en az +1 sayı (veya +1 çift) fazla olmalıdır. |
| `takeOkeyFromTable` | `true` | `true`, `false` | `false` ise yerdeki perlerden okey alınamaz (`okeySwap` devre dışı). |
| `okeyTakenPenalty` | `101` | `0`, `101` | Yerdeki okeyi alınan oyuncuya `101` ceza yazılıp yazılmayacağını belirler. |
| `throwableMeldTilePenalty` | `101` | `0`, `101` | Masadaki pere işlenebilen (işlek) taşı ıskartaya atana `101` ceza yazar. |
| `strictSidePickup` | `true` | `true`, `false` | `true` ise yandan alınan taş o tur açmada/işlemede kullanılmak zorundadır. |
| `okeyInHandCountsFace` | `false` | `true`, `false` | `false` ise elde kalan okey sadece 101 yazar; `true` ise 101 + kendi sayısını yazar. |
| `eldenScope` | `'self'` | `'self'`, `'table'` | `'self'` ise kendisi açmamışken tek turda biten her zaman elden sayılır; `'table'` ise masada kimse açmamış olmalıdır. |
| `reshuffles` | `3` | `0`, `1`, `2`, `3` | Orta deste bittiğinde ıskartaların kaç kez yeniden karıştırılacağını belirler. |

### 6. Süre / Zaman Aşımı ve Oyuncu Ayrılınca Ne Olur
- **Süre:** İlk tur (`turnNumber === 0`) **60 sn**, sonraki turlar **30 sn**. Tur içinde yapılan ilk `open`, `meld` veya `addToMeld` hamlesi saati bir defaya mahsus +30 sn yeniler (`refilled = true`).
- **Zaman Aşımı (`quickMove`):**
  - `turnPhase === 'draw'` ise: Orta desteden taş çeker (`source: 'deck'`); ardından kalan süre `0` olduğu için anında atma hamlesine geçer.
  - `turnPhase === 'play'` ise: Eğer oyuncu yandan taş almışsa ve kullanmadıysa, o taşı kullanabilen otomatik bir `open`/`meld`/`addToMeld` varsa yapar; yoksa `mustUseTileId` olmayan ve per dışındaki en yüksek/en az işe yarayan taşı atar.
- **Oyuncu Ayrılması (`disconnect` / `leave`):**
  - Bağlantı koparsa (`socketId = null`), koltuk korunur ve sıra geldiğinde `botDelayMs` (1000 ms) sonra `botMove` oynar; oyuncu aynı isimle dönerse koltuğunu geri alır.
  - Oyuncu kasten çıkarsa (`room:leave`), koltuk kalıcı olarak bir bota devredilir (`isBot = true`).

### 7. Gizli Bilgi (`viewFor`)
- **Gönderilenler:** Oyuncunun kendi `hand` dizisi, `indicator`, `okey`, `deckCount`, her oyuncunun `handCount`, `opened`, `pairs`, `penalties` bilgisi, her oyuncunun yalnızca **en üstteki görünür ıskarta taşı** (`topDiscard: Tile | null`, eğer `topTaken` ise `null`), masadaki açık perler (`table`), tur ve saat bilgisi. El bittiğinde (`phase === 'finished'`) `revealedHands` açılır.
- **Gizlenenler (Asla Gönderilmez):** Rakip elleri (`players[i].hand`), orta destedeki taşların sırası (`deck`), alınan veya üstü kapanan eski ıskarta taşları (`discards[0..-2]`), `seed`.

### 8. Bot Stratejisi İpuçları (Acemi / Usta)
- **Acemi (`easy`):**
  - `nodeLimit = 300`, `slip = 0.25`. 101 barajını bulduğunda hemen açar (beklemez).
  - Masadaki okeyleri veya rakiplerin attığı taşları takip etmez; işlek taş kontrolünü bazen atlar (eğer ceza kapalıysa).
- **Usta (`hard`):**
  - `nodeLimit = 40_000`, `slip = 0`.
  - **Katlamalıysa:** Rakiplerin taş sayılarını ve ıskartalarını izler; elinde 105–115 varken hemen açmak yerine yüksek barajla (125+) açıp rakipleri kilitlemeyi veya elden bitmeyi hedefler.
  - **Okey Saklama:** Gerçek okeyi açılışta 101'e ulaşmak için mecbur kalmadıkça masaya indirmez (çalınma ve +101 ceza riskini önler); okeyi son taş olarak atıp `×2` çarpanla bitmek için elde tutar.
  - **İşlek ve Okey Çalma:** Masada `okeySwap` fırsatı varsa en yüksek öncelikle okeyi çalar; ıskartaya taş atarken `addableTiles` listesinde olmayan bir taş seçerek `+101` işlek cezasından kaçınır.

### 9. Test Senaryoları Listesi (25 Somut Test Durumu)
1. **[101-T01] Dağıtım ve Taş Sayısı:** `createGame({ mode: '101', startingSeat: 2 })` → Toplam 106 benzersiz taş; koltuk 2'de 22 taş, diğerlerinde 21 taş, 1 normal gösterge taşı, orta destede 20 taş, `turn: 2`, `turnPhase: 'play'`.
2. **[101-T02] Gösterge 13 İken Okey 1:** Gösterge `Siyah 13` → `okeyFromIndicator` sonucu `{ color: 'black', value: 1 }`; iki `Siyah 1` taşı `isJoker === true`, iki sahte okey `faceOf === { color: 'black', value: 1 }`.
3. **[101-T03] 100 Puanla Açma Reddi:** Elde per toplamı `100` (örn. 39 + 33 + 28) ve 1 ekstra taş → `applyAction(open)` `{ ok: false, error: 'Açmak için en az 101 gerekli (100)' }` döner.
4. **[101-T04] 101 Puanla Açma ve Atacak Taş Kalmama Reddi:** Elde tam 22 taş var ve 22 taşın tamamı per yapılarak `open` gönderilir → `{ ok: false, error: 'Atmak için elinizde bir taş kalmalı' }` döner.
5. **[101-T05] Katlamalı 101 Artan Baraj:** `folding: true`, Koltuk 0 `115` puanla açtı → Koltuk 1 `115` puanla `open` denerse `{ ok: false, error: 'Açmak için en az 116 gerekli (115)' }`, `116` puanla denerse `{ ok: true }`.
6. **[101-T06] Katlamalı 101 Artan Çift Barajı:** `folding: true`, Koltuk 0 `5` çiftle açtı → Koltuk 1 `5` çiftle `open` denerse `{ ok: false, error: 'Çiftten açmak için en az 6 çift gerekli (5)' }`, `6` çiftle denerse `{ ok: true }`.
7. **[101-T07] Çiftten Açanın Seri İndirme Yasağı ve İşleme İzninin Doğrulanması:** Koltuk 0 `5` çiftle açtıktan sonra `Mavi 4-5-6` ile `meld` dener → `{ ok: false }`. Ancak Koltuk 1'in masadaki `Kırmızı 7-8-9` perine `Kırmızı 10` ile `addToMeld` dener → `{ ok: true }`.
8. **[101-T08] 4 Oyuncu da Çift Açarsa İptal:** Koltuk 0, 1 ve 2 çiftten açmış ve Koltuk 0'ın `101` cezası varken, Koltuk 3 de `5` çiftle `open` yapar → `phase === 'finished'`, `result.cancelled === true`, `result.scores === [0, 0, 0, 0]`.
9. **[101-T09] Seri Ortasındaki Okeyi Çalma ve Ceza:** Koltuk 1'in `Mavi 6 - Okey - Mavi 8` perine, açmış olan Koltuk 0 `Mavi 7` işler (`addToMeld`) → Okey Koltuk 0'ın eline geçer, per `Mavi 6-7-8` olur, Koltuk 1'in `penalties` değeri `+101` artar.
10. **[101-T10] Seri 13 Ucundaki Kesin Okeyi Çalma:** Koltuk 1'in `Mavi 11 - Mavi 12 - Okey` perine Koltuk 0 `Mavi 13` işler → 14 sayısı olmadığı için okey kesin `Mavi 13`'tür; okey Koltuk 0'ın eline geçer, Koltuk 1 `+101` ceza alır.
11. **[101-T11] Seri 1 Ucundaki Kesin Okeyi Çalma:** Koltuk 1'in `Okey - Sarı 2 - Sarı 3` perine Koltuk 0 `Sarı 1` işler → 0 sayısı olmadığı için okey kesin `Sarı 1`'dir; okey Koltuk 0'ın eline geçer, Koltuk 1 `+101` ceza alır.
12. **[101-T12] İki Yöne Açık Seri Ucundaki Okeyin İki Uç Dolunca Çıkması:** Koltuk 1'in `Mavi 5 - Mavi 6 - Okey` perine Koltuk 0 önce `Mavi 7` işler → Per `Okey(M4)-M5-M6-M7` olur (okey çıkmaz). Ardından `Mavi 4` işler → Okey boşa çıkar ve Koltuk 0'ın eline geçer.
13. **[101-T13] 3 Taşlı Setten Okey Çalma:** Koltuk 1'in `Kırmızı 12 - Mavi 12 - Okey` perine Koltuk 0 yalnız `Sarı 12` işler → Per 4 taş olur, okey çıkmaz. Ardından `Siyah 12` işler → 4 gerçek renk tamamlanır, okey Koltuk 0'a geçer ve Koltuk 1 `+101` ceza alır.
14. **[101-T14] Kendi Okeyini veya Eşinin Okeyini Alma Cezasızlığı:** `partnerMode: true`, Koltuk 2'nin (ortağın) perindeki okeyi Koltuk 0 gerçek taşıyla alır → Okey Koltuk 0'a geçer, Koltuk 2'ye `0` ceza yazılır.
15. **[101-T15] Yandan Alınan Taşı Geri Atma ve Tek Bırakma Yasağı:** Koltuk 1 soldan `Mavi 2` alır (`mustUseTileId`), aynı turda `Mavi 2`'yi `discard` dener → `{ ok: false }`. Elindeki diğer tüm taşları per yapıp elde tek `Mavi 2` bırakacak şekilde `open` dener → `{ ok: false }`.
16. **[101-T16] Sıkı Yandan Alma (`strictSidePickup: true`):** Henüz açmamış Koltuk 1'in eli soldaki taşla birlikte en fazla `95` puana ulaşıyor ve sadece `3` çifti var → `draw(discard)` denerse `{ ok: false, error: 'Yandan alınan taşla elinizi açabilmelisiniz' }` döner.
17. **[101-T17] İşlek Taş Atma Cezası:** `throwableMeldTilePenalty: 101`, masada `Siyah 4-5-6` peri açıkken, elini açmış olan Koltuk 0 elindeki `Siyah 7` taşını `discard` eder → Hamle kabul edilir, Koltuk 0'a `+101` ceza yazılır.
18. **[101-T18] El Bitmeden Gerçek Okey Atma Cezası ve Yandan Alınamaması:** Koltuk 0 elinde 5 taş varken gerçek okeyi ıskartaya atar → Koltuk 0'a `+101` ceza yazılır. Sıradaki Koltuk 1 `draw(discard)` denerse `{ ok: false, error: 'Yere atılan okey yandan alınamaz' }` döner.
19. **[101-T19] Elde Kalan Gerçek Okey vs Sahte Okey Puanlaması:** Okey `Kırmızı 5`, `okeyInHandCountsFace: false`. Koltuk 0 normal biter (`multiplier: 1`). Açmış olan Koltuk 1'in elinde `Gerçek Okey (K5) + Mavi 3`, Koltuk 2'nin elinde `Sahte Okey + Mavi 3` kalır → Koltuk 1'in skoru `3 + 101 = 104`, Koltuk 2'nin skoru `5 + 3 = 8`.
20. **[101-T20] Başkası Açmışken Elden Bitme (`eldenScope: 'self'`):** Koltuk 1 daha önce açmış ve elinde `10` sayı kalmış; Koltuk 2 ve 3 hiç açmamış. Koltuk 0 daha önce hiç açmamışken tek turda tüm taşlarını açıp normal taş atarak biter → `elden: true`, `multiplier: 2`; skorlar `[-202, 20, 404, 404]`.
21. **[101-T21] Elden + Çiftten + Okeyle Bitme (`×8` Çarpan):** Koltuk 0 tek turda çift açıp kalan taşlarını masadaki perlere işleyip son taş olarak gerçek okeyi atarak biter → `multiplier: 8`; Koltuk 0 `-808`, hiç açmamış rakipler `1616` ceza alır.
22. **[101-T22] Eşli 101 Bitişinde Ortağın El Cezası Muafiyeti:** `partnerMode: true`, Koltuk 0 normal biter (`-101`). Ortağı Koltuk 2 hiç el açmamış (ve elinde 1 okey var), ancak Koltuk 2 oyun içinde `+101` işlek cezası yemiş → Koltuk 2'ye açmama (202) ve eldeki okey (101) cezası **yazılmaz**, sadece oyun içi `+101` cezası kalır; Takım A net `0`, Takım B toplam cezalarını alır.
23. **[101-T23] Orta Deste Bitince Iskarta Karıştırma:** `reshuffles: 2`, orta deste `0` iken Koltuk 2 son taşını atar → Koltuk 2'nin son attığı taş yerinde kalır, diğer tüm ıskartalar karıştırılıp yeni `deck` olur, `reshufflesLeft` 1'e düşer, toplam taş sayısı `106` korunur.
24. **[101-T24] Tur Saati Yenileme Sınırı:** Koltuk 0 turunun 20. saniyesinde `open` yapar → `deadline` `now + 30_000` olur (`refilled: true`). 25. saniyede `addToMeld` yapar → `deadline` **değişmez**.
25. **[101-T25] Gizli Bilgi Sızıntı Testi (`viewFor`):** Oyun ortasında `viewFor(state, 1)` çıktısı JSON olarak taranır → Koltuk 0, 2, 3'ün el taşlarını, `deck` dizisini, `seed` değerini ve `topTaken === true` olan koltukların önceki ıskarta taşlarını **kesinlikle içermez**.

### 10. 60+ Kullanıcı İçin Arayüzde Gösterilmesi Gereken Yardımcı Bilgiler
- **Dinamik Aç Düğmesi:** Istakadaki perlerin anlık toplamını otomatik hesaplayıp iki satırlı göster: `"Aç 87 / 101"` ve altında `"14 sayı daha"` (katlamalıysa `"Aç 87 / 116 · 29 sayı daha"`). Baraj geçildiğinde düğme yeşile (`#5fd07d`) dönsün ve `"Açabilirsin! (104)"` yazsın. Çift sayısı `>= 4` ise `"4/5 Çift"` ipucu gösterilsin.
- **İşlek (`+`) ve Okey (`OK`) Rozetleri:** Oyuncu elini açtıktan sonra ıstakasında masadaki perlere işlenebilen (veya yerdeki okeyi çalabilen) her taşın sol üst köşesinde yeşil **`+`** rozeti belirmeli; o taş seçildiğinde masadaki uyan per(ler) ilk sıraya gelip yeşil çerçeveyle parlamalı.
- **Tehlike Uyarısı (İşlek / Okey Atma):** Oyuncu elini açmışken üzerinde `+` olan işlek bir taşı veya `OK` rozetli gerçek okeyi atma bölgesine sürüklerse / `At` düğmesine basarsa: `"Dikkat: Bu taş masaya işleniyor! Atarsan 101 ceza yazılırsın. Yine de at?"` onay kutusu çıkmalı.
- **Yandan Alınan Taş Vurgusu:** Soldan alınan taş ıstakada altın sarısı kesik çerçeve ve `"Kullan"` etiketiyle işaretlenmeli.

---

## OYUN 2: DÜZ OKEY (Klasik Okey — Tekli ve Eşli)

### 1. Malzeme ve Kurulum
- **Malzeme:** 101 Okey ile aynı **106 taş** (104 normal + 2 sahte okey).
- **Oyuncu Sayısı ve Oturuş:** 4 oyuncu (`0, 1, 2, 3`). Eşli modda (`partnerMode: true`) `0-2` ve `1-3` ortaktır.
- **Dağıtım ve Başlangıç:**
  - Başlayan oyuncuya (`startingSeat`) **15 taş**, diğer 3 oyuncuya **14'er taş** dağıtılır.
  - 1 normal taş **Gösterge** olarak açılır; kalan **48 taş** orta desteyi (`deck`) oluşturur.
  - Her oyuncu (veya eşli modda her takım) maça **`startPoints` (varsayılan 20)** puanla başlar.

### 2. Tur Akışı Adım Adım
1. **Gösterge Aşaması (`showIndicator`):**
   - Elinde gösterge taşının birebir eşini (`color` ve `value` aynı normal taş) bulunduran oyuncu, **yalnızca kendi ilk turunda**:
     - `gostergeTiming === 'beforeDraw'` ise: Taş çekmeden önce (başlayan oyuncu ise ilk taşını atmadan önce),
     - `gostergeTiming === 'firstTurnAnytime'` ise: İlk turunda taşını atmadan önceki herhangi bir anda,
     `{ type: 'showIndicator' }` eylemini gönderebilir. Diğer 3 oyuncudan (eşli modda karşı takımdan) `gostergePoints` (varsayılan 1) puan düşülür.
2. **Çekme Fazı (`draw`):** Başlayan oyuncunun ilk turu hariç, sırası gelen oyuncu orta desteden (`deck`) veya solundaki oyuncunun attığı son taştan (`discard`) 1 taş çeker (eli 15 taşa çıkar). Düz okeyde yandan alınan taşı kullanma zorunluluğu **yoktur**; hemen geri atılabilir veya elde tutulabilir.
3. **Bitirme veya Atma Fazı (`finish` / `discard`):**
   - Düz okeyde **masaya per açılmaz**. Tüm dizilim oyuncunun kendi ıstakasında gizli yapılır.
   - Oyuncunun elindeki 15 taştan 1'i çıkarıldığında kalan **14 taşın tamamı** geçerli ayrık perler (`meldCover === 14`) VEYA **7 çift** (`isSevenPairs`) oluşturuyorsa, oyuncu 15. taşını bitiş alanına (göstergenin üzerine) sürükleyerek `{ type: 'finish', tileId }` ile eli bitirir.
   - Eli bitmiyorsa (veya bitmek istemiyorsa) 1 taşını sağa ıskartaya atar (`{ type: 'discard', tileId }`) ve sıra sağdaki oyuncuya geçer.
4. **Deste Bitmesi:** Orta destedeki 48 taş bittiğinde ve son oyuncu taşını attığında (ıskartalar yeniden karıştırılmaz, `reshufflesLeft = 0`) el berabere (`winner: null`) biter.

### 3. Geçerli / Geçersiz Hamle Kuralları ve Tüm Kenar Durumlar
1. **14 Taş Bitiş Doğrulaması (`finishShape`):**
   - **Normal Per Bitişi (`'melds'`):** Kalan 14 taş, birbirinden ayrık geçerli seri (`run`, aynı renk ardışık $\ge 3$ taş, `13-1` döngüsü yok) ve/veya grup (`set`, farklı renk aynı sayı 3 veya 4 taş) kombinasyonlarına tam bölünebilmelidir (ör. `4+4+3+3` veya `5+3+3+3` veya `4+3+4+3`).
   - **7 Çift Bitişi (`'pairs'`):** Kalan 14 taş, 7 adet çiftten (aynı renk ve aynı sayıdan ikişer taş) oluşmalıdır. Gerçek okey her tek taşla çift oluşturur. Eğer 14 taş hem 7 çift hem de 2 adet 7'li seri olarak okunabiliyorsa (örn. Mavi 1..7'den ikişer adet), oyuncu lehine daha yüksek çarpan veren **`'pairs'`** seçilir.
   - **Tek Renk Bitişi (`colorHandMultiplier: true` ise):** Kalan 14 taşın tamamı (gerçek okeyler hariç) aynı renkten oluşuyorsa özel çarpan uygulanır.
2. **Okeyle Bitme (`okeyFinish`):**
   - 15 taş içinden **atılan 15. taş (bitiş taşı) gerçek okey** ise (ve kalan 14 taş per veya 7 çift oluşturuyorsa) "Okey atarak bitme" gerçekleşir ve ceza çarpanı 2'ye katlanır.
   - Sahte okey atarak bitmek normal bitiş sayılır (joker değildir).
3. **Yere Atılan Okeyin Yandan Alınması:**
   - `allowPickupThrownOkey: false` (varsayılan) ise bir oyuncunun ıskartaya attığı gerçek okey yan oyuncu tarafından alınamaz.

### 4. Puanlama Tablosu, Cezalar, Bitiş Koşulu ve Beraberlik Bozma
*(Düz Okey'de herkes `20` puandan başlar; puan kaybeden düşer. Kodda `totals` düşülen puanların toplamını tutar ve `totals[i] >= startPoints` olduğunda maç biter).*

| Bitiş Türü | Biten Oyuncudan Düşülen | Diğer Oyunculardan Düşülen (Tekli) | Eşli Modda Karşı Takımdan Düşülen |
| :--- | :--- | :--- | :--- |
| **Gösterge (`showIndicator`)** | `0` | **`1` puan** (el berabere bitse bile düşer; el sonunda kazanan oyuncu daha önce başkasının yaptığı göstergenin 1 puanını öder) | Karşı takımdan **`1` puan** |
| **Normal Bitiş** | `0` | **`2` puan** | **`2` puan** |
| **Okey Atarak Bitiş (`okeyFinish`)** | `0` | **`4` puan** (`2 × 2`) | **`4` puan** |
| **7 Çift İle Bitiş (`pairs`)** | `0` | **`4` puan** (`2 × 2`) | **`4` puan** |
| **7 Çift + Okey Atarak Bitiş** | `0` | **`8` puan** (`2 × 2 × 2`) | **`8` puan** |
| **Tek Renk Bitişi (Ayar Açıksa)** | `0` | **`8` puan** (Okeyle biterse **`16` puan**) | **`8` / `16` puan** |
| **Orta Deste Biterse (Berabere)** | `0` | `0` (Varsa sadece o el yapılan gösterge puanı düşer) | `0` |

- **Maç Bitiş Koşulu (`matchOver`):** Herhangi bir oyuncunun (veya takımın) kalan puanı `<= 0` olduğunda (yani toplam düşülen puan `>= startPoints` olduğunda) maç biter.
- **Beraberlik Bozma:** Kalan puanı en yüksek (en az puan kaybetmiş) oyuncu/takım 1. olur. Eşitlik halinde daha çok el bitiren kazanır; o da eşitse 1 uzatma eli oynanır.

### 5. Yaygın Ev Kuralları ve Varyantlar (Ayarlar)

| Ayar Adı | Varsayılan | Olası Değerler | Ne Değiştirir? |
| :--- | :--- | :--- | :--- |
| `partnerMode` | `false` | `true`, `false` | `true` ise `0-2` ve `1-3` ortak tek kasa üzerinden 20 puandan düşer. |
| `startPoints` | `20` | `10`, `15`, `20` | Maç başlangıç puanını belirler. |
| `gostergePoints` | `1` | `0`, `1`, `2` | Gösterge yapıldığında rakiplerden düşülecek puan (`0` = gösterge kapalı). |
| `gostergeTiming` | `'firstTurnAnytime'` | `'beforeDraw'`, `'firstTurnAnytime'` | Gösterge taşının ilk turda taş çekmeden önce mi yoksa taş çektikten sonra da gösterilebileceğini belirler. |
| `allowSevenPairs` | `true` | `true`, `false` | 7 çift ile bitişin geçerli olup olmadığını belirler. |
| `colorHandMultiplier` | `false` | `true`, `false` | Tek renk 14 taşla bitişe ekstra çarpan verir. |

### 6. Süre / Zaman Aşımı ve Oyuncu Ayrılınca Ne Olur
- **Süre:** İlk tur **60 sn**, sonraki turlar **30 sn**. (Masaya per açılmadığı için tur içi saat yenileme yoktur).
- **Zaman Aşımı (`quickMove`):**
  - `turnPhase === 'draw'` ise: Orta desteden çeker.
  - `turnPhase === 'play'` ise: Önce `findFinish(hand, okey)` ile elin bitip bitmediğine bakar; bitiyorsa otomatik olarak `{ type: 'finish', tileId }` ile eli bitirir! Bitmiyorsa eldeki per bütünlüğünü en az bozan (ve gerçek okey olmayan) taşı atar.
- **Oyuncu Ayrılması:** 101 Okey ile birebir aynıdır.

### 7. Gizli Bilgi (`viewFor`)
- **Gönderilenler:** Oyuncunun kendi 14/15 taşı (`hand`), `indicator`, `okey`, `deckCount`, rakiplerin taş sayısı (`14` veya `15`), her oyuncunun yalnızca görünür en üst ıskarta taşı, `gosterge` yapan koltuk, kalan puanlar (`startPoints - totals[i]`). El bittiğinde `revealedHands` ile biten oyuncunun 14 taşı perlerine ayrılmış sırada gösterilir.
- **Gizlenenler:** Rakiplerin elleri, orta deste sırası, `seed`, kapanmış eski ıskartalar.

### 8. Bot Stratejisi İpuçları (Acemi / Usta)
- **Acemi (`easy`):** Gösterge varsa gösterir; soldan taş almayı sadece o taşla anında bitiyorsa yapar; atarken sadece yan yana duran perleri korur (`nodeLimit = 300`, `slip = 0.25`).
- **Usta (`hard`):**
  - Elinde 5+ çift varsa 7 çifte döner (`duzValue`).
  - Soldaki taş `duzValue` değerini artırıyorsa alır.
  - Atacağı taşı seçerken rakiplerin daha önce yandan aldığı taşların renk/sayı komşularını ve henüz çıkmamış taşları hesaba katar; bitişte hem normal taş hem gerçek okey atarak bitebiliyorsa her zaman **gerçek okeyi atarak (`×2`)** bitirir (`findFinish` sıralaması).

### 9. Test Senaryoları Listesi (25 Somut Test Durumu)
1. **[DUZ-T01] Dağıtım Kontrolü:** `createGame({ mode: 'duz', startingSeat: 0 })` → Koltuklar `[15, 14, 14, 14]` taş alır, 1 gösterge, orta destede `48` taş kalır.
2. **[DUZ-T02] İlk Turda Gösterge Başarısı:** Koltuk 2'nin elinde göstergenin ikizi var → Sıra Koltuk 2'ye ilk geldiğinde `showIndicator` yapar; `gosterge === 2` olur.
3. **[DUZ-T03] Gösterge Olmayan Oyuncunun Gösterge Reddi:** Elinde gösterge taşı olmayan Koltuk 1 `showIndicator` gönderir → `{ ok: false }` döner.
4. **[DUZ-T04] İkinci Turda Gösterge Reddi:** Elinde gösterge olan Koltuk 0 ilk turunda gösterge yapmayıp taş atar; sıra tekrar kendisine geldiğinde (`turnNumber === 4`) `showIndicator` dener → `{ ok: false }` döner.
5. **[DUZ-T05] Aynı Elde İki Kez Gösterge Reddi:** Koltuk 0 gösterge yaptıktan sonra aynı turda tekrar `showIndicator` dener → `{ ok: false }` döner.
6. **[DUZ-T06] Normal 14 Taş Per Bitişi (4+3+4+3):** Elde `M1-2-3-4`, `S9-10-11`, `K7-S7-M7-Si7`, `K12-S12-Si12` + `Sarı 2` → `{ type: 'finish', tileId: sari2.id }` ile el biter, diğerleri `2` puan düşer.
7. **[DUZ-T07] Eksik Perle (13 Taş Per + 1 Açık Taş) Bitiş Reddi:** 14 taş içinde 1 taş hiçbir pere uymuyorsa `finish` dener → `{ ok: false, error: 'Eliniz bitmiyor...' }` döner.
8. **[DUZ-T08] 13-1-2 Döngüsü İle Bitiş Reddi:** Elde `M12-M13-M1` üçlüsü varken `finish` dener → `finishShape === null`, `{ ok: false }` döner.
9. **[DUZ-T09] Gerçek Okeyin Eksik Taşı Tamamlaması:** 14 taşlık dizilimde `M2` yerine gerçek okey (`K5`) varken `finish` → `{ ok: true, shape: 'melds' }`.
10. **[DUZ-T10] Sahte Okeyin Kendi Değerinde Kullanılması:** Gösterge `K4` (Okey `K5`). Elde `K3-K4-SahteOkey-K6` + 10 perli taş varken `finish` → `{ ok: true }`. Ancak `M3-M4-SahteOkey-M6` varken `finish` → `{ ok: false }` (sahte okey `M5` yerine geçemez).
11. **[DUZ-T11] 7 Çift İle Bitiş ve ×2 Çarpan:** Elde 7 adet çift (14 taş) + 1 tek taş varken tek taşı `finish` ile atar → `result.pairs === true`, `multiplier === 2`, rakipler `4` puan düşer.
12. **[DUZ-T12] 6 Çift + 1 Tek + 1 Gerçek Okey İle 7 Çift Bitişi:** Gerçek okey tek kalan `Sarı 9` ile çiftleşir → `isSevenPairs === true`, `shape === 'pairs'`, rakipler `4` puan düşer.
13. **[DUZ-T13] Hem 2 Seri Hem 7 Çift Okunan Elde Çift Önceliği:** Elde `Mavi 1..7` taşlarının her birinden ikişer adet (14 taş) var → Hem iki adet `M1..7` serisi hem de 7 çift olarak geçerlidir; `finishShape` daha yüksek puanlı olan `'pairs'` döner (`multiplier: 2`).
14. **[DUZ-T14] Okey Atarak Normal Bitiş (`×2`):** Kalan 14 taş normal per iken 15. taş olarak gerçek okey `finish` ile atılır → `okeyFinish === true`, `multiplier === 2`, rakipler `4` puan düşer.
15. **[DUZ-T15] 7 Çift + Okey Atarak Bitiş (`×4`):** Kalan 14 taş 7 çift iken 15. taş olarak gerçek okey `finish` ile atılır → `pairs: true, okeyFinish: true, multiplier: 4`, rakipler `8` puan düşer.
16. **[DUZ-T16] `findFinish` Fonksiyonunun Okey Atmayı Tercih Etmesi:** 15 taşlık elde hem `Mavi 5` hem de `Gerçek Okey` atılarak bitilebiliyorsa (örn. 4 taşlı bir perden biri atılacaksa) → `findFinish` her zaman gerçek okeyin `tileId` değerini seçer.
17. **[DUZ-T17] Kesişen Perlerde Taşın İki Kez Kullanılamaması:** `M3-4-5-6-7` ve `S7-Si7` varken `M7` hem seriye hem sete aynı anda sayılamaz (`meldCover === 13`, bitmez).
18. **[DUZ-T18] Yandan Alınan Taşı Geri Atabilme:** Düz okeyde Koltuk 1 soldan taş çeker (`draw(discard)`) ve aynı taşı hemen `discard` ile geri atar → `mustUseTileId === null` olduğu için `{ ok: true }` döner ve ceza yazılmaz.
19. **[DUZ-T19] Düz Okeyde Masaya Per Açma Yasağı:** Koltuk 0 `{ type: 'open', melds: [...] }` veya `{ type: 'meld', ... }` gönderir → `{ ok: false, error: 'Düz okeyde yere per açılmaz' }` döner.
20. **[DUZ-T20] Orta Deste Bitince Berabere Sonuçlanma:** 48 taşlık orta deste biter ve son oyuncu `discard` yapar → `reshufflesLeft === 0`, `phase === 'finished'`, `winner === null`, gösterge yoksa `scores === [0, 0, 0, 0]`.
21. **[DUZ-T21] Berabere Biten Elde Gösterge Puanının Korunması:** Koltuk 1 ilk turda gösterge yapmış ve orta deste biterek el berabere kalmışsa → Koltuk 0, 2 ve 3'ten `1`'er puan düşülür (`scores: [1, 0, 1, 1]`).
22. **[DUZ-T22] 20 Puan Sıfırlanınca Maç Bitişi (`matchOver`):** `totals = [6, 20, 4, 12]` olduğunda `matchOver('duz', totals)` → `true` döner; Koltuk 2 (en az puan kaybeden: 4 kayıp = 16 kalan puan) maçı kazanır.
23. **[DUZ-T23] Zaman Aşımında (`quickMove`) Biten Elin Otomatik Bitirilmesi:** Koltuk 0'ın elindeki 15 taş bitiyorken süresi dolar (`quickMove`) → Taşı ıskartaya atmak yerine `{ type: 'finish', tileId }` döner ve eli kazanır.
24. **[DUZ-T24] Eşli Düz Okey Puan Düşümü:** `partnerMode: true`, Koltuk 0 normal biter → Takım A (`0-2`) `0` düşer, Takım B (`1-3`) ortak kasasından `2` puan düşer.
25. **[DUZ-T25] İki Gerçek Okey + 12 Taşla Karmaşık Bitiş:** Elde 2 gerçek okey varken iki ayrı eksik üçlü peri tamamlayarak 14 taşa ulaşır → `meldCover === 14`, `{ ok: true }`.

### 10. 60+ Kullanıcı İçin Arayüzde Gösterilmesi Gereken Yardımcı Bilgiler
- **"Gösterge Yap (+1)" Düğmesi:** Oyuncunun elinde gösterge taşı varsa ve ilk turundaysa, ekranın ortasında büyük altın sarısı `"Gösterge Göster"` düğmesi otomatik belirmeli (taş aratmamalı).
- **"Bitir" Düğmesi ve Bitiş Taşı Parlaması:** Oyuncu 15 taşla oynama fazındayken `findFinish(hand, okey)` arka planda çalışmalı; eğer el bitiyorsa hangi taş atıldığında elin bittiği yeşil parıltıyla gösterilmeli ve `"At"` düğmesinin yanında dev yeşil bir **"ELİ BİTİR!"** düğmesi aktif olmalı (yaşlı kullanıcının taşı küçük gösterge kutusunun üstüne sürüklemesini zorunlu kılma; tek dokunuşla bitirebilsin).
- **Per Sayacı:** Istakanın sağ üst köşesinde `"Hazır: 11 / 14 taş (veya 5 / 7 çift)"` bilgisi gösterilmeli.
- **Kalan Puan Gösterimi:** Rakip panellerinde düşülen puan değil, kahvehanedeki gibi **20'den geriye kalan puan** (`"18 puan kaldı"`) büyük puntolarla yazılmalı.

---

## OYUN 3: PİŞTİ (2 Kişilik, 4 Kişilik Tekli, 4 Kişilik Eşli)

### 1. Malzeme ve Kurulum
- **Malzeme:** 52 kartlık standart iskambil destesi (4 takım: `spades` ♠ Maça, `hearts` ♥ Kupa, `diamonds` ♦ Karo, `clubs` ♣ Sinek; değerler: `A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K`).
- **Oyuncu Sayısı:** 2 oyuncu (`0, 1`) veya 4 oyuncu (`0, 1, 2, 3`). 4 kişilik eşli modda (`partnerMode: true`) `0-2` ve `1-3` ortaktır.
- **Dağıtım ve Başlangıç:**
  - İlk el `dealer = 0`, sonraki ellerde `(dealer + 1) % seats`. İlk oynayacak koltuk `startingSeat = (dealer + 1) % seats`.
  - Ortaya (masaya) **3 kart kapalı (`faceDown`), 4. kart en üste açık (`faceUp`)** olmak üzere toplam **4 kart** konur.
  - Her oyuncuya **4'er kart** dağıtılır.
  - Kalan kartlar kapalı destede (`deck`) bekler:
    - **2 Kişilikte:** `52 - 4 (yer) - 8 (ilk el) = 40 kart` (5 tur daha 4'er kart dağıtılır, toplam 6 dağıtım turu).
    - **4 Kişilikte:** `52 - 4 (yer) - 16 (ilk el) = 32 kart` (2 tur daha 4'er kart dağıtılır, toplam 3 dağıtım turu).

### 2. Tur Akışı Adım Adım
1. Sırası gelen oyuncu (`turn`) elindeki kartlardan **1 tanesini** seçer ve masanın ortasındaki yığının (`centerPile`) en üstüne açık olarak atar (`{ type: 'play', cardId }`).
2. **Eşleşme / Toplama Kontrolü:**
   - Eğer `centerPile` boşsa (önceki oyuncu yerdeki kartları yeni toplamışsa): Atılan kart yerde tek başına kalır (Vale dahi olsa boş yeri alamaz).
   - Eğer `centerPile` içinde en az 1 kart varsa ve en üstteki kart `topCard` ise:
     - **Pişti Durumu (`centerPile.length === 1`):**
       - `topCard.rank === 'J'` ve atılan kart `card.rank === 'J'` ise: **Vale Piştisi (+20 puan)** olur!
       - `topCard.rank !== 'J'` ve `card.rank === topCard.rank` ise: **Normal Pişti (+10 puan)** olur!
       - `topCard.rank !== 'J'` ve `card.rank === 'J'` ise: **Pişti OLMAZ!** Vale yerdeki tek kartı normal olarak süpürür (pişti puanı yazılmaz, sadece kartlar kasaya alınır).
     - **Normal Toplama (`centerPile.length >= 2`):**
       - `card.rank === topCard.rank` VEYA `card.rank === 'J'` ise: Oyuncu yerdeki tüm kartları (`centerPile` + kendi attığı kart) kendi kasasına (`captured[seat]`) alır ve `lastCapturer = seat` olarak kaydedilir.
     - **Eşleşme Yoksa:** Atılan kart `centerPile` en üstüne eklenir.
3. **Yeniden Dağıtım:** Tüm oyuncuların elindeki 4 kart bittiğinde:
   - Eğer `deck.length > 0` ise: Her oyuncuya sırayla **4'er kart** daha dağıtılır, oyun kesintisiz devam eder.
   - Eğer `deck.length === 0` ise (52 kart bitti):
     - Yerde (`centerPile`) kalan kartlar varsa, bunları **en son yerden kart toplayan oyuncu (`lastCapturer`)** otomatik olarak kendi kasasına alır (ancak bu son kalan kartlar pişti sayılmaz).
     - El biter (`phase = 'finished'`) ve `scoreRound` hesaplanır.

### 3. Geçerli / Geçersiz Hamle Kuralları ve Tüm Kenar Durumlar
1. **Başlangıçta Yere Vale Açılması veya İlk Kartta Pişti (`firstDealPistiAllowed`):**
   - Dağıtımda ortaya açılan 4. (en üstteki) kart Vale (`J`) olsa bile yerde 4 kart olduğu için ilk başlayan oyuncu Vale veya başka kart atarak **pişti yapamaz**, sadece yerdeki 4 kartı toplar.
   - İlk başlayan oyuncu yerdeki 4 kartı topladıktan sonra, 2. oyuncu yere 1 kart atar ve 3. (veya 1.) oyuncu aynısını atarsa pişti olur.
2. **Hiç Kimsenin Yerden Kart Alamaması (Çok Nadir Kenar Durum):**
   - El boyunca 52 kartın tamamı oynanıp hiç kimse yerden tek bir kez bile kart alamamışsa (`lastCapturer === null`), yerdeki 52 kart kimseye gitmez ve el `0-0` biter.
3. **Kart Sayısı Eşitliği (`26 - 26`):**
   - El sonunda toplanan kart sayıları eşitse (örn. 2 kişilikte `26-26`, veya 4 kişilik teklide iki oyuncuda `20-20`), **3 puanlık kart çoğunluğu ödülü kimseye verilmez** (`0` puan).
   - 4 kişilik tekli oyunda tek bir oyuncu en çok kartı toplamışsa (örn. `22, 14, 10, 6`), 3 puanı yalnız o oyuncu alır (`22` kart alan).
4. **İlk 3 Kapalı Kartın Görünürlüğü (`blindCenterVisibleOnTake`):**
   - Yerdeki ilk 4 kartı (3'ü kapalı, 1'i açık) ilk toplayan oyuncu bu 3 kapalı kartı görür (`blindCenterVisibleOnTake: true` ise "İlk el alınan kartlar" bildirimiyle tüm masaya 2 saniye gösterilir).

### 4. Puanlama Tablosu, Cezalar, Bitiş Koşulu ve Beraberlik Bozma

| Puan Kalemi | Birim Puan | Destede Adet | Toplam Puan |
| :--- | :--- | :--- | :--- |
| **Her As (`A♠, A♥, A♦, A♣`)** | `1` puan | 4 adet | `4` puan |
| **Her Vale (`J♠, J♥, J♦, J♣`)** | `1` puan | 4 adet | `4` puan |
| **Sinek İkilisi (`2♣`)** | `2` puan | 1 adet | `2` puan |
| **Karo Onlusu (`10♦`)** | `3` puan | 3 puan (1 adet) | `3` puan |
| **Kart Çoğunluğu (En Çok Kart)** | `3` puan | Tek kazanan varsa | `3` puan |
| **Desteden Çıkan Sabit Toplam** | — | 52 kart | **Her el sabit `16` puan** (kart eşitliği varsa `13` puan) |
| **Normal Pişti** | `10` puan | Sınırsız | Pişti başına `+10` (pişti yapılan 2 kartın kendi değerleri — örn. iki As ise +2 — ayrıca sayılır!) |
| **Vale Piştisi (`J` üstüne `J`)** | `20` puan | Sınırsız | `+20` puan (+ iki Vale'nin kendi kart değeri `+2` = toplam `22` puan!) |

- **Önemli Kural (Pişti Kartlarının Kendi Değeri):** Pişti yapılan iki kart kasadaki 52 karta dahildir! Örneğin `A♠` üstüne `A♥` ile pişti yapıldığında: `10 (pişti) + 1 (A♠) + 1 (A♥) = 12 puan` ve `+2 kart` olarak sayılır. `10♦` ile pişti yapıldığında `10 (pişti) + 3 (10♦) = 13 puan` getirir.
- **Bitiş Koşulu (`matchOver`):** Toplam puanı `targetScore` (varsayılan `151`, ayarlanabilir `51 / 101 / 151`) barajına ulaşan veya geçen oyuncu/takım maçı kazanır.
- **Beraberlik Bozma:** Aynı el sonunda iki taraf da `151` barajını geçerse, **toplam puanı daha yüksek olan** kazanır. Tam eşitlik varsa (örn. `155 - 155`), bir taraf öne geçene kadar **1 uzatma eli** oynanır.

### 5. Yaygın Ev Kuralları ve Varyantlar (Ayarlar)

| Ayar Adı | Varsayılan | Olası Değerler | Ne Değiştirir? |
| :--- | :--- | :--- | :--- |
| `seats` | `2` | `2`, `4` | 2 kişilik karşılıklı veya 4 kişilik masa. |
| `partnerMode` | `true` (4 kişide) | `true`, `false` | 4 kişide `true` ise `0-2` ve `1-3` ortak kasa ve ortak puan kullanır. |
| `targetScore` | `151` | `51`, `101`, `151`, `201` | Maçın biteceği hedef puan. |
| `blindCenterVisibleOnTake` | `true` | `true`, `false` | İlk yerdeki 3 kapalı kart alındığında herkese gösterilip gösterilmeyeceği. |

### 6. Süre / Zaman Aşımı ve Oyuncu Ayrılınca Ne Olur
- **Süre:** Her hamle **20 sn** (`baseMs: 20_000`, ilk tur **40 sn**). Tek kart atıldığı için tur içi saat yenileme yoktur.
- **Zaman Aşımı (`quickMove`):**
  - Yerdeki kartla eşleşen (pişti veya toplama yapan) bir kart elde varsa (Vale hariç, yerde değerli kart yoksa Vale harcanmaz) onu atar; yoksa eldeki pişti verme ihtimali en düşük (veya en küçük) kartı atar.
- **Oyuncu Ayrılması:** Kopan oyuncunun yerine bot geçer; oyuncu dönerse koltuğunu devralır.

### 7. Gizli Bilgi (`viewFor`)
- **Gönderilenler:** Oyuncunun kendi `hand` kartları, `deckCount` (kalan kart sayısı), rakiplerin `handCount` sayısı, yerdeki `centerPile` kartlarının sayısı (`centerCount`) ve **yalnızca en üstteki açık kart (`topCard: Card | null`)** (veya son atılan 2 kartın geçmişi), her oyuncunun/takımın o ana kadar topladığı **kart sayısı (`capturedCount`)** ve yaptığı **açık piştiler (`pistis: { card: Card; isJack: boolean }[]`)**.
- **Gizlenenler:** Rakiplerin elleri, orta deste sırası, yerdeki ilk 3 kapalı kart (`centerPile` alınana kadar), kasaya alınan kapalı kartların hangileri olduğu (el sonuna kadar).

### 8. Bot Stratejisi İpuçları (Acemi / Usta)
- **Acemi (`easy`):** Yerdeki kartın aynısı varsa alır, yoksa rastgele bir kart atar (bazen boş yere Vale bile atabilir).
- **Usta (`hard`):**
  - **Kart Sayma (Card Counting):** O ana kadar açık oynanan tüm kartları (`A..K` her değerden kaç adet çıktığını) hafızasında tutar.
  - **Boş Yere Kart Atarken (Pişti Savunması):** `centerPile.length === 0` iken, daha önce 3 tanesi çıkmış bir sayının 4.'sünü (kesin pişti olmaz!) veya kendi elinde çifti olan bir sayıyı (rakip alsa bile ya da tek kalsa kendisi pişti yapabilir) atar. Hiç çıkmamış tek bir kartı boş yere atmaktan kaçınır.
  - **Vale (`J`) Yönetimi:** Yerde az ve değersiz kart varken (örn. iki tane 4'lü) Vale atmaz; yerde `10♦`, `2♣`, `A` veya çok sayıda kart biriktiğinde Vale ile süpürür. Boş yere mecbur kalmadıkça asla Vale atmaz (rakibe 20 puanlık Vale Piştisi vermemek için).

### 9. Test Senaryoları Listesi (25 Somut Test Durumu)
1. **[PIS-T01] 2 Kişilik İlk Dağıtım:** `create(opts2, names, rng, 0)` → Yerde 4 kart (3 kapalı, 1 açık), Koltuk 0 ve 1'de 4'er kart, destede `40` kart.
2. **[PIS-T02] 4 Kişilik İlk Dağıtım:** `create(opts4, names, rng, 0)` → Yerde 4 kart, 4 oyuncuda 4'er kart, destede `32` kart.
3. **[PIS-T03] İlk Yerdeki 4 Kartın Aynı Sayıyla Alınması (Pişti Değil):** Yerde başlangıçtaki 4 kart var ve en üstte `7♠` açık. Koltuk 0 `7♥` atar → Yerde 4 kart olduğu için pişti **olmaz**, Koltuk 0'ın kasasına `5` kart geçer, `pistis` boş kalır.
4. **[PIS-T04] İlk Yerdeki En Üst Kart Vale İken Vale Atılması (Pişti Değil):** Başlangıçta yerde 3 kapalı + en üstte `J♠` (toplam 4 kart) var. Koltuk 0 `J♥` atar → `centerPile.length === 4` olduğu için Vale Piştisi **olmaz**, sadece 5 kart toplanır.
5. **[PIS-T05] Normal Pişti (+10 Puan):** Yerde tek başına `8♦` var (`centerPile.length === 1`). Koltuk 1 `8♣` atar → Normal pişti olur (`+10` puan), `capturedCount += 2`, `centerPile` boşalır.
6. **[PIS-T06] Vale İle Tek Kartı Alma (Pişti Değil):** Yerde tek başına `10♦` var (`centerPile.length === 1`). Koltuk 1 `J♠` atar → Pişti **olmaz**, Koltuk 1 iki kartı (`10♦` ve `J♠`) normal olarak kasasına alır (`3 + 1 = 4` kart puanı, `0` pişti puanı).
7. **[PIS-T07] Vale Üstüne Vale İle Vale Piştisi (+20 Puan):** Yerde tek başına `J♦` var (`centerPile.length === 1`). Koltuk 1 `J♣` atar → **Vale Piştisi** olur (`+20` pişti puanı + `2` Vale kart puanı = `22` puan).
8. **[PIS-T08] Boş Yere Vale Atılması:** Yerde hiç kart yok (`centerPile.length === 0`). Koltuk 0 `J♠` atar → Boş yeri alamaz, `J♠` yerde tek başına kalır (Koltuk 1 için Vale Piştisi fırsatı doğar).
9. **[PIS-T09] 10♦ İle Pişti Puan Hesabı:** Yerde tek `10♠` varken Koltuk 0 `10♦` atarak pişti yapar → El sonunda bu hamleden `10 (pişti) + 3 (10♦) = 13` puan gelir.
10. **[PIS-T10] 2♣ İle Pişti Puan Hesabı:** Yerde tek `2♥` varken Koltuk 0 `2♣` atarak pişti yapar → El sonunda `10 (pişti) + 2 (2♣) = 12` puan gelir.
11. **[PIS-T11] İki As İle Pişti Puan Hesabı:** Yerde tek `A♠` varken Koltuk 0 `A♦` atarak pişti yapar → `10 (pişti) + 1 (A♠) + 1 (A♦) = 12` puan gelir.
12. **[PIS-T12] 4'er Kart Bitince Otomatik Yeni Dağıtım:** 2 kişilik oyunda her iki oyuncu da 4'er kartını oynadığında (`hand.length === 0`) ve destede `40` kart varken → Otomatik olarak ikisine de 4'er kart dağıtılır, destede `32` kart kalır, `centerPile` olduğu gibi korunur.
13. **[PIS-T13] Son Elde Yerde Kalan Kartların Son Alana Gitmesi:** Son dağıtımda Koltuk 0 bir el alır (`lastCapturer = 0`), sonrasında kalan 6 kartta kimse eşleşme yapamaz → Destede ve ellerde kart kalmadığında yerdeki 6 kart otomatik olarak Koltuk 0'ın kasasına eklenir.
14. **[PIS-T14] Son Elde Yerde Tek Kart Kalmasının Pişti Sayılmaması:** Son oyuncunun attığı son kart eşleşmez ve yerde tek başına kalıp `lastCapturer`'a gider → Bu kart pişti sayılmaz.
15. **[PIS-T15] Kart Çoğunluğu (27 vs 25):** Koltuk 0 toplam `27` kart, Koltuk 1 toplam `25` kart topladı → Koltuk 0 `+3` çoğunluk puanı alır, piştisiz toplam puan `16` olur.
16. **[PIS-T16] Kart Sayısı Eşitliği (26 vs 26):** Koltuk 0 ve 1 `26`'şar kart topladı → İkisi de çoğunluk puanı alamaz (`0`), piştisiz toplam puan `13` olur.
17. **[PIS-T17] 4 Kişilik Teklide Çoğunluk Eşitliği (20-20-6-6):** Koltuk 0 ve 2 `20`'şer kart, Koltuk 1 ve 3 `6`'şar kart topladı → En çok kartta eşitlik olduğu için `3` puan kimseye verilmez.
18. **[PIS-T18] 4 Kişilik Eşli Pişti Ortak Kasa:** `seats: 4, partnerMode: true`. Koltuk 0 `14` kart + 1 pişti, ortağı Koltuk 2 `16` kart + `10♦` topladı → Takım A toplam `30` kart ile `+3` çoğunluk puanı + `10` pişti + `3` (`10♦`) kazanır; Koltuk 0 ve 2'nin skoru ortaktır.
19. **[PIS-T19] Sırası Olmayan Oyuncunun Hamle Reddi:** `turn === 0` iken Koltuk 1 `play` gönderir → `{ ok: false, error: 'Sıra sizde değil' }` döner.
20. **[PIS-T20] Elde Olmayan Kartı Oynama Reddi:** Koltuk 0 elinde bulunmayan bir `cardId` ile `play` gönderir → `{ ok: false, error: 'Kart elinizde değil' }` döner.
21. **[PIS-T21] 151 Barajıyla Maç Bitişi ve Eşitlik Bozma:** `targetScore: 151`. El sonunda toplamlar `[154, 158]` oldu → İkisi de 151'i geçtiği için daha yüksek olan Koltuk 1 (`158`) kazanır, `matchOver === true`.
22. **[PIS-T22] Tam Puan Eşitliğinde (152 - 152) Uzatma Eli:** `targetScore: 151`, toplamlar `[152, 152]` → Eşitlik bozulmadığı için `matchOver === false` döner ve 1 uzatma eli oynanır.
23. **[PIS-T23] Gizli Bilgi (`viewFor`) Kontrolü:** Başlangıçta yerde 3 kapalı 1 açık kart varken `viewFor(state, 0)` → Yerdeki 3 kapalı kartın kimliğini, rakibin 4 kartını ve destedeki 40 kartı **asla içermez**; yalnızca `topCard` ve `centerCount: 4` döner.
24. **[PIS-T24] Usta Botun Vale Piştisi Fırsatını Kaçırmaması:** Yerde tek `J♠` varken Usta botun elinde `J♥` ve `4♣` var → Bot `%100` `J♥` oynayarak 20 puanlık Vale Piştisi yapar.
25. **[PIS-T25] Usta Botun Boş Yere Vale Atmaması:** Yerde kart yokken (`centerPile.length === 0`) Usta botun elinde `[J♠, 5♦]` var → Bot asla `J♠` atmaz, `5♦` atar.

### 10. 60+ Kullanıcı İçin Arayüzde Gösterilmesi Gereken Yardımcı Bilgiler
- **Yerdeki Kart Sayısı Rozeti:** Masanın ortasındaki kart yığınının yanında büyük bir rozetle `"Yerde: 1 kart (Pişti fırsatı!)"` veya `"Yerde: 7 kart"` yazmalı (yaşlı kullanıcı üst üste duran kartların tek mi yoksa çoklu mu olduğunu uzaktan karıştırmamalı).
- **Eşleşen Kart Vurgusu:** Sıra oyuncudayken elinde yerdeki üst kartla aynı sayıda olan kart (veya Vale) varsa, o kartın çerçevesi hafif yeşil parlamalı (`"Alır"` / `"Pişti Yapar!"` alt etiketiyle).
- **Kasa ve Pişti Özeti:** Oyuncu ve rakip panellerinde `"Toplanan: 18 kart · 1 Pişti"` bilgisi sürekli görünür olmalı.

---

## OYUN 4: BATAK (İhaleli Tekli, Koz Maça, Eşli Batak, Gömmeli Batak)

### 1. Malzeme ve Kurulum
- **Malzeme:** 52 kartlık standart iskambil destesi. Her renkte büyüklük sırası (küçükten büyüğe): `2 < 3 < 4 < 5 < 6 < 7 < 8 < 9 < 10 < J < Q < K < A`.
- **Varyantlara Göre Kurulum ve Dağıtım:**
  1. **İhaleli Tekli Batak (`variant: 'ihaleli'`):** 4 oyuncu, herkese **13'er kart** dağıtılır.
  2. **Koz Maça (`variant: 'kozMaca'`):** 4 oyuncu, herkese **13'er kart** dağıtılır. Koz sabit olarak **Maça (`spades` ♠)**'dır.
  3. **Eşli İhaleli Batak (`variant: 'esli'`):** 4 oyuncu (`0-2` ve `1-3` eşli), herkese **13'er kart** dağıtılır.
  4. **Gömmeli Batak (`variant: 'gommeli'`):**
     - 4 kişilikte: Her oyuncuya **12'şer kart** dağıtılır, ortaya kapalı **4 kart (define/gömü)** ayrılır (`12 × 4 + 4 = 52`).
     - 3 kişilikte (`seats: 3`): Desteden `2♣, 2♦, 2♥` çıkarılmaz; her oyuncuya **16'şar kart** dağıtılır, ortaya kapalı **4 kart** ayrılır (`16 × 3 + 4 = 52`).

### 2. Tur Akışı Adım Adım
1. **Aşama 1 — İhale / Deklarasyon Fazı (`phase === 'bidding'`):**
   - **İhaleli / Eşli / Gömmeli'de:** Dağıtıcının sağındaki koltuktan (`startingSeat`) başlayarak sırayla her oyuncu ya mevcut en yüksek ihaleden daha büyük bir sayı söyler (`{ type: 'bid', amount: 5..13 }`) ya da pas geçer (`{ type: 'pass' }`).
     - İhaleli Tekli ve Gömmeli'de minimum ihale **`minBid = 5`** (ayarlanabilir `4`).
     - Eşli Batak'ta minimum ihale **`minBid = 8`**.
     - Pas geçen oyuncu o el bir daha ihaleye giremez.
     - 3 oyuncu pas geçtiğinde en yüksek teklifi veren ihaleyi kazanır (`declarer`).
     - **Herkes Pas Geçerse:** İlk 3 oyuncu pas derse, ihale son (4.) oyuncuya (veya ayarlara göre dağıtıcıya) Tekli'de **`4`**, Eşli'de **`7`** ile mecburi kalır (`forcedDealerBid`).
   - **Koz Maça'da (`variant === 'kozMaca'`):** İhale yarışı yoktur; her oyuncu sırayla o el kaç el alacağını (`1..13`, hiç alamayacağını düşünüyorsa `0` = "Yanık/Boş" veya en az `1`) taahhüt eder (`{ type: 'declare', tricks: number }`). Koz otomatik olarak Maça'dır (`♠`).
2. **Aşama 2 — Koz Seçimi ve Gömme / Eş Açma (`phase === 'selectingTrump'` / `'burying'`):**
   - **Koz Seçimi (İhaleli/Eşli/Gömmeli):** İhaleyi kazanan `declarer`, `{ type: 'selectTrump', suit: 'spades' | 'hearts' | 'diamonds' | 'clubs' }` ile kozu belirler.
   - **Gömmeli Batak'ta (`burying`):**
     - Normal Gömmeli'de: `declarer` yerdeki 4 kapalı kartı eline alır (eli 16/20 kart olur) ve elinden istediği 4 kartı kapalı olarak yere gömer (`{ type: 'bury', cardIds: [c1, c2, c3, c4] }`).
     - Kanlı Gömmeli'de (`kanliGommeli: true`): `declarer` yerdeki 4 kartı **görmeden** elinden 4 kartı yere gömer, ardından yerdeki 4 kartı eline alır.
   - **Eşli Batak'ta (Açık El / Dummy Kuralı):** `declarer` kozu seçip ilk kartı oynadığı anda (veya koz seçimi sonrası), ortağı (`(declarer + 2) % 4`) elindeki 13 kartı renklerine göre dizilmiş olarak masaya **açık (`dummyHand`)** serer. El boyunca ortağın sırası geldiğinde kartı **`declarer` (ihaleyi alan oyuncu)** seçip oynar!
3. **Aşama 3 — El Oynama Fazı (`phase === 'playing'`, 13 Löve):**
   - İlk löveye `declarer` (Koz Maça'da `startingSeat`) başlar. Sonraki lövelere bir önceki löveyi kazanan oyuncu başlar.
   - 4 oyuncu sırayla 1'er kart atar (`{ type: 'play', cardId }`).
   - Löveyi: Masaya koz atıldıysa **en büyük kozu atan**, hiç koz atılmadıysa **ilk atılan rengin (`leadSuit`) en büyüğünü atan** oyuncu kazanır ve `tricksWon[winner]++` artar.

### 3. Geçerli / Geçersiz Hamle Kuralları ve Tüm Kenar Durumlar
Batak'ta kural dışı kart atmak (yanık/revör) sunucu tarafından `legalCards(hand, currentTrick, trump, trumpBroken, opts)` fonksiyonu ile **kesin olarak engellenir**. Bir oyuncunun oynayabileceği yasal kart kümesi şu öncelik ağacıyla belirlenir:
1. **Lövenin İlk Kartı (`currentTrick.length === 0` — Eli Başlatma):**
   - `trumpLeadNeedsBreak: true` (varsayılan) ve henüz o elde yere hiç koz düşmemişse (`trumpBroken === false`):
     - Oyuncunun elinde koz dışında en az 1 kart varsa **koz ile başlayamaz** (`"Koz kırılmadan koz çıkılamaz"`).
     - Oyuncunun elindeki **tüm kartlar koz ise** (kozdan başka rengi kalmamışsa) koz çıkabilir ve `trumpBroken = true` olur.
2. **Lövenin 2., 3. ve 4. Kartları (`currentTrick.length > 0`, İlk Renk = `leadSuit`):**
   - **Durum A — Elde `leadSuit` (Dönen Renk) VARSA:**
     - Oyuncu `leadSuit` renginden bir kart atmak **zorundadır**.
     - **Büyütme Zorunluluğu (`mustRaise: true`):**
       - Eğer o ana kadar bu lövede hiç koz çakılmamışsa (`!trickHasTrump`) VE oyuncunun elinde masadaki en büyük `leadSuit` kartından (`highestLeadRank`) daha büyük bir `leadSuit` kartı varsa, **onu geçecek (büyütecek) bir `leadSuit` kartı atmak zorundadır!**
       - Eğer masada zaten bir oyuncu koz çakmışsa (`trickHasTrump` ve `leadSuit !== trump`): Dönen renkten kart büyüterek eli alma şansı kalmadığı için oyuncunun `leadSuit` rengini büyütme zorunluluğu **yoktur**; elindeki herhangi bir (küçük) `leadSuit` kartını atabilir! *(Bu, Batak motorlarında en sık yanlış kodlanan kenar durumdur).*
   - **Durum B — Elde `leadSuit` YOKSA, Ama Elde Koz (`trump`) VARSA (`mustTrump: true`):**
     - Oyuncu koz atmak (**çakmak**) **zorundadır** (bu hamleyle `trumpBroken = true` olur).
     - **Üstüne Çakma Zorunluluğu (`mustRaise: true`):**
       - Eğer bu lövede benden önce başka bir oyuncu zaten koz çakmışsa (`highestTrumpRank` varsa):
         - Elinde `highestTrumpRank`'tan **daha büyük bir koz varsa**, üstüne çakmak (daha büyük kozu atmak) **zorunludur**!
         - Elinde `highestTrumpRank`'tan daha büyük koz **yoksa**, fakat sadece daha küçük koz(lar) varsa: **Yine de elindeki küçük kozu atmak (alttan çakmak) zorundadır!** ("Geçemiyorum diye başka renk kağıt atma" Batak'ta yasaktır; renk yoksa ve elde koz varsa, geçemese bile koz atılır!). *(Ev kuralı ayarı olarak "geçemiyorsa koz atmak zorunda değil" seçeneği aşağıda verilmiştir).*
   - **Durum C — Elde Ne `leadSuit` Ne de Koz VARSA:**
     - Oyuncu elindeki herhangi bir kartı serbestçe atabilir.

### 4. Puanlama Tablosu, Cezalar, Bitiş Koşulu ve Beraberlik Bozma

| Varyant | Oyuncu / Takım Durumu | Alınan El (`W`) vs İhale/Söz (`B`) | Yazılan Puan (`scoreRound`) |
| :--- | :--- | :--- | :--- |
| **İhaleli Tekli & Gömmeli** | İhaleyi Alan (`declarer`) | `W >= B` (Tutturdu) | **`+W`** (Aldığı el sayısı kadar artı; örn. 6 deyip 8 aldıysa `+8`) |
| **İhaleli Tekli & Gömmeli** | İhaleyi Alan (`declarer`) | `W < B` (Battı) | **`-B`** (İhale bedeli kadar eksi; örn. 7 deyip 6 aldıysa `-7`) |
| **İhaleli Tekli & Gömmeli** | Diğer Oyuncular | `W > 0` | **`+W`** (Aldığı el sayısı kadar artı) |
| **İhaleli Tekli & Gömmeli** | Diğer Oyuncular | `W === 0` (Hiç el alamadı) | **`-B`** (`zeroTrickPenalty === 'bid'` ise ihale bedeli kadar eksi; `'fixed5'` ise `-5`) |
| **Eşli Batak** | İhaleyi Alan Takım | `W_takım >= B` | **`+W_takım`** (Bazı yörelerde `B × 10 + (W - B)`) |
| **Eşli Batak** | İhaleyi Alan Takım | `W_takım < B` | **`-B`** |
| **Eşli Batak** | Savunma Takımı | `W_savunma >= 2` (veya `> 0`) | **`+W_savunma`** (Hiç el alamazsa `-B`) |
| **Koz Maça** | Her Oyuncu (`B` söz verdi) | `B <= W <= B + 2` | **`+(B × 10 + (W - B))`** (veya sade ölçekte **`+W`**) |
| **Koz Maça** | Her Oyuncu (`B` söz verdi) | `W < B` (Eksik aldı) VEYA `W > B + 2` (3+ fazla aldı) | **`-(B × 10)`** (veya sade ölçekte **`-B`**, battı!) |

- **King / Sürgün Kuralı (`sariKirmiziKing: true`):** İhaleli Batak'ta bir oyuncu `11` (Sarı King), `12` veya `13` (Kırmızı King) ihale söyleyip taahhüt ettiği elleri alırsa maçı o anda doğrudan kazanır; alamazsa `-22 / -26` ile batar.
- **Maç Bitiş Koşulu ve Beraberlik Bozma:** `targetRounds` (örn. 9 el) tamamlandığında en yüksek puana sahip oyuncu/takım kazanır. Puan eşitliğinde 1 uzatma eli oynanır.

### 5. Yaygın Ev Kuralları ve Varyantlar (Ayarlar)

| Ayar Adı | Varsayılan | Olası Değerler | Ne Değiştirir? |
| :--- | :--- | :--- | :--- |
| `variant` | `'ihaleli'` | `'ihaleli'`, `'kozMaca'`, `'esli'`, `'gommeli'` | Batak oyun türünü belirler. |
| `minBid` | `5` (Eşlide `8`) | `4`, `5`, `8` | İhale açılış alt sınırını belirler. |
| `mustRaise` | `true` | `true`, `false` | Yerdeki kartı büyütme / üstüne çakma zorunluluğunu açar/kapatır. |
| `mustTrump` | `true` | `true`, `false` | Dönen renk yoksa koz atma (çakma) zorunluluğunu açar/kapatır. |
| `trumpLeadNeedsBreak` | `true` | `true`, `false` | Yere koz düşmeden kozla başlama yasağını açar/kapatır. |
| `zeroTrickPenalty` | `'bid'` | `'bid'`, `'fixed5'`, `'none'` | Hiç el alamayan oyuncuya ihale kadar eksi / -5 / ceza yok uygular. |
| `kozMacaOvertrickLimit` | `2` | `2`, `3`, `0` | Koz Maça'da söylenen elin kaç fazlasında batılacağını belirler (`2` = 3 fazlada batar). |

### 6. Süre / Zaman Aşımı ve Oyuncu Ayrılınca Ne Olur
- **Süre:** İhale ve kart oynama hamlesi başına **25 sn** (ilk tur **50 sn**).
- **Zaman Aşımı (`quickMove`):**
  - İhalede: Pas geçebiliyorsa `{ type: 'pass' }`, herkes pas geçtiyse mecburi minimum ihaleyi verir.
  - Koz seçiminde: Elinde en çok kart bulunan rengi koz seçer.
  - Gömmede: Koz olmayan en küçük 4 kartı gömer.
  - Kart oynamada: `legalCards` içindeki en küçük geçerli kartı oynar.
- **Oyuncu Ayrılması:** Bot devralır (`botMove`). Eşli Batak'ta `declarer` ayrılırsa bot hem kendi elini hem açık `dummyHand`'i yönetir.

### 7. Gizli Bilgi (`viewFor`)
- **Gönderilenler:** Oyuncunun kendi `hand` kartları, ihale geçmişi (`bids`), seçilen `trump`, `trumpBroken`, masadaki aktif löve (`currentTrick`), her oyuncunun aldığı el sayısı (`tricksWon`), kendi elinde şu an oynanabilir yasal kartların kimlik listesi (`legalCardIds: string[]`), Eşli Batak'ta koz seçildikten sonra ortağın açık eli (`dummyHand`).
- **Gizlenenler:** Rakiplerin kapalı elleri, Gömmeli Batak'ta yere gömülen 4 kart (`buriedCards` sadece `declarer` tarafından bilinir, diğerlerine asla gönderilmez), önceki bitmiş lövelerin kartları (sadece son tamamlanan löve 2 sn gösterilir).

### 8. Bot Stratejisi İpuçları (Acemi / Usta)
- **Acemi (`easy`):** Elindeki As, Papaz ve koz sayısına göre basit ihale verir; `legalCards` içinden rastgele/en büyük kartı atar.
- **Usta (`hard`):**
  - **İhale Değerlendirmesi:** Her As (`+1`), Papaz (`+0.8`, yanında en az 1 kart varsa), Kız (`+0.5`, yanında 2 kart varsa), en uzun renkteki 4'ten fazla her koz (`+0.9`) ve tek/boş renklerden (şikan/सिंglton) gelecek çakma potansiyelini toplayarak gerçekçi ihale tavanını hesaplar.
  - **Oyun İçi Takip:** Çıkan kozları ve As/Papazları sayar. İhaleyi kendisi aldıysa önce dışarıdaki kozları temizler (`koz çekme`), sonra sağlam yan renklerini tahsil eder. Savunmadaysa hiç el alamamış (`0` eldeki) oyuncuyu sıfırdan kurtarmak veya `declarer`'ı batırmak için ortağına el geçirir.
  - **Koz Maça'da Fazla El Kaçınma:** Söylediği el sayısına (`B + 1`) ulaştığında kalan elleri almamak için elindeki büyük kartları kozların veya büyük renklerin altına atar (debloke eder).

### 9. Test Senaryoları Listesi (25 Somut Test Durumu)
1. **[BAT-T01] 4 Kişilik Dağıtım:** `create` → 4 oyuncuda 13'er benzersiz kart, toplam 52 kart, `phase: 'bidding'`.
2. **[BAT-T02] Minimum İhale Altında Teklif Reddi:** `minBid: 5` iken Koltuk 0 `{ type: 'bid', amount: 4 }` gönderir → `{ ok: false, error: 'İhale en az 5 olmalı' }`.
3. **[BAT-T03] Mevcut İhaleyi Yükseltmeme Reddi:** Koltuk 0 `6` dedikten sonra Koltuk 1 `6` der → `{ ok: false, error: 'Mevcut ihaleden yüksek söylemelisiniz' }`.
4. **[BAT-T04] Pas Geçenin Tekrar İhaleye Girememesi:** Koltuk 0 `pass` dedikten sonra ihale turu dönüp tekrar Koltuk 0'a geldiğinde `bid` dener → `{ ok: false }`.
5. **[BAT-T05] İlk 3 Oyuncu Pas Geçince 4. Oyuncuya İhalenin 4 İle Kalması:** Koltuk 0, 1, 2 `pass` der → İhale otomatik olarak Koltuk 3'e `amount: 4` ile kalır ve `phase: 'selectingTrump'` olur.
6. **[BAT-T06] Koz Kırılmadan Koz Çıkma Yasağı:** Koz `♠`, henüz yere hiç `♠` düşmemiş (`trumpBroken: false`). Koltuk 0'ın elinde `♠A` ve `♥5` varken löveye `♠A` ile başlamak ister → `{ ok: false, error: 'Koz kırılmadan koz çıkılamaz' }`.
7. **[BAT-T07] Elde Sadece Koz Kalmışsa Koz Çıkabilme:** `trumpBroken: false`, ancak Koltuk 0'ın elindeki kalan 3 kartın tamamı `♠` (koz) → `♠` ile başlayabilir (`{ ok: true }`) ve `trumpBroken: true` olur.
8. **[BAT-T08] Renge Uyma Zorunluluğu:** Yere `♥7` açıldı. Koltuk 1'in elinde `♥3` ve `♠A` varken `♠A` atmak ister → `{ ok: false, error: 'Yerdeki renge uymak zorundasınız' }`.
9. **[BAT-T09] Aynı Rengi Büyütme Zorunluluğu (`mustRaise: true`):** Yere `♦8` açıldı. Koltuk 1'in elinde `♦4` ve `♦Q` varken `♦4` atmak ister → `{ ok: false, error: 'Yerdeki kartı büyütmek zorundasınız' }`, `♦Q` atarsa `{ ok: true }`.
10. **[BAT-T10] Masada Koz Çakılmışken Dönen Rengi Büyütme Zorunluluğunun Kalkması (Kritik Kenar Durum):** Koz `♠`. Koltuk 0 `♦8` açtı, Koltuk 1 (`♦` yok) `♠2` ile çaktı. Koltuk 2'nin elinde `♦4` ve `♦A` var → Löveyi zaten `♠2` aldığı için Koltuk 2 `♦A` atmak zorunda **değildir**, `♦4` atabilir (`{ ok: true }`)!
11. **[BAT-T11] Dönen Renk Yokken Koz Çakma Zorunluluğu (`mustTrump: true`):** Koz `♠`, yere `♣10` açıldı. Koltuk 1'de `♣` yok ama `♠3` ve `♦2` var. `♦2` atmak ister → `{ ok: false, error: 'Elinizde dönen renk yoksa koz atmak zorundasınız' }`.
12. **[BAT-T12] Üstüne Çakma Zorunluluğu:** Koz `♠`, yere `♣10` açıldı, Koltuk 1 `♠6` çaktı. Koltuk 2'de `♣` yok, elinde `♠3` ve `♠9` var. `♠3` atmak ister → `{ ok: false, error: 'Yerdeki kozu büyütmek zorundasınız' }`, `♠9` atarsa `{ ok: true }`.
13. **[BAT-T13] Kozu Geçemese Bile Alttan Koz Atma Zorunluluğu:** Koz `♠`, yere `♣10` açıldı, Koltuk 1 `♠K` çaktı. Koltuk 2'de `♣` yok, elinde sadece `♠4` (küçük koz) ve `♦2` var → `♦2` atamaz, geçemese bile `♠4` atmak **zorundadır** (`{ ok: true }`).
14. **[BAT-T14] Ne Renk Ne Koz Varken Serbest Kart Atma:** Koz `♠`, yere `♣10` açıldı. Koltuk 1'de hiç `♣` ve hiç `♠` yok → Elindeki herhangi bir `♥` veya `♦` kartını atabilir.
15. **[BAT-T15] İhaleli Batak Başarılı Puanlama:** Koltuk 0 `7` ihale aldı ve `9` el topladı; diğerleri `2, 2, 0` el aldı → Skorlar: Koltuk 0 `+9`, Koltuk 1 `+2`, Koltuk 2 `+2`, Koltuk 3 (hiç el alamadı) `-7`.
16. **[BAT-T16] İhaleli Batak Batma Puanlaması:** Koltuk 0 `8` ihale aldı ama `7` el topladı; diğerleri `3, 2, 1` el aldı → Skorlar: Koltuk 0 `-8`, diğerleri `+3, +2, +1`.
17. **[BAT-T17] Eşli Batak Açık El (Dummy) Yönetimi:** `variant: 'esli'`, Koltuk 0 ihaleyi `9` ile aldı ve kozu seçti → Koltuk 2'nin eli herkese görünür olur (`dummyHand`); sıra Koltuk 2'ye geldiğinde hamleyi Koltuk 0 gönderir (`seat === 0` yetkisiyle oynanır).
18. **[BAT-T18] Gömmeli Batak 4 Kart Gömme:** `variant: 'gommeli'`, Koltuk 0 ihaleyi alıp kozu seçtiğinde yerdeki 4 kart eline eklenir (`16` kart); 4 kart seçip `bury` yaptığında eli `12` karta düşer ve oyun başlar.
19. **[BAT-T19] Koz Maça Normal ve +2 Fazla Sınırı:** `variant: 'kozMaca'`, `kozMacaOvertrickLimit: 2`. Koltuk 0 `3` dedi ve `5` el aldı (`3 + 2`) → Batmaz, artı puan alır. Koltuk 1 `3` dedi ve `6` el aldı (`3 + 3`) → Fazla elden **batar** ve `-3` (veya `-30`) ceza alır!
20. **[BAT-T20] King (13 El) Deklarasyonu ve Anında Kazanma:** `sariKirmiziKing: true`, Koltuk 0 `13` ihale dedi ve 13 elin tamamını aldı → Maçı o anda kazanır (`matchOver === true`).
21. **[BAT-T21] Löve Kazananının Doğru Hesaplanması:** Yere sırasıyla `♥10`, `♥A`, `♠2` (koz), `♥K` atıldı → Löveyi en küçük koz da olsa `♠2` atan Koltuk 2 kazanır ve bir sonraki löveye Koltuk 2 başlar.
22. **[BAT-T22] Çakma İle Kozun Kırılması (`trumpBroken`):** 2. lövede Koltuk 1 dönen renk olmadığı için `♠3` (koz) çaktı → `trumpBroken` `true` olur; 3. löveyi kazanan oyuncu yanında başka renk olsa bile artık kozla başlayabilir.
23. **[BAT-T23] 13 Löve Sonunda El Bitişi:** 13. lövenin 4. kartı atıldığında toplam alınan eller `sum(tricksWon) === 13` olur ve `phase === 'finished'` durumuna geçer.
24. **[BAT-T24] `viewFor` İçinde `legalCardIds` Doğruluğu:** Sıra Koltuk 1'deyken `viewFor(state, 1).legalCardIds` içindeki her kart `apply` ile kabul edilir, liste dışındaki her kart `apply` ile reddedilir.
25. **[BAT-T25] Gizli Bilgi Sızıntı Testi (`viewFor`):** Gömmeli Batak'ta Koltuk 0'ın gömdüğü 4 kart ve rakiplerin elleri `viewFor(state, 1)` çıktısında **kesinlikle yer almaz**.

### 10. 60+ Kullanıcı İçin Arayüzde Gösterilmesi Gereken Yardımcı Bilgiler
- **Oynanamaz Kartları Karartma (En Kritik Yardımcı):** Sıra oyuncuya geldiğinde, `legalCardIds` içinde **olmayan** (atılması kural dışı/yanık olan) kartlar ıstakada `%45` opaklıkla sönükleştirilmeli ve biraz aşağıda durmalı; sadece oynanabilir yasal kartlar parlak ve tam boy görünmeli! Böylece 60+ kullanıcı "Renk var mıydı, büyütecek miydim?" diye yanlış karta basıp hata mesajı okumak zorunda kalmaz.
- **Sabit Koz ve İhale Göstergesi:** Üst şeritte büyük simgeyle `"Koz: ♠ Maça · İhale: Hasan (7)"` ve her oyuncu panelinde `"Aldığı: 4 / 7"` sayacı gösterilmeli.

---

## OYUN 5: KİNG (Rıfkı — 6 Ceza + Koz + Sanzatu)

### 1. Malzeme ve Kurulum
- **Malzeme:** 52 kartlık standart iskambil destesi (`2 < 3 < ... < K < A`).
- **Oyuncu Sayısı:** 4 oyuncu (`0, 1, 2, 3`), bireysel oynanır.
- **Parti Yapısı (`partyLength: 20`):**
  - Tam bir King partisi **20 el** sürer: **12 Ceza eli + 8 Koz eli**.
  - Her oyuncunun parti boyunca **3 Ceza** ve **2 Koz** seçme hakkı vardır (`playerQuotas[seat] = { penaltiesLeft: 3, trumpsLeft: 2 }`).
  - 6 ceza oyununun her biri parti boyunca **en fazla 2 kez** seçilebilir (`penaltyRemaining: Record<PenaltyType, number>` başlangıçta hepsi `2`).
  - Ayrıca bir oyuncu aynı ceza oyununu kendi 3 ceza hakkı içinde en fazla `maxSamePenaltyPerPlayer` (varsayılan `2`, bazı kurallarda `1`) kez seçebilir.
- **Dağıtım ve İlk Oyuncu:**
  - Her el 4 oyuncuya **13'er kart** dağıtılır.
  - Partinin 1. elinde elinde **`2♦` (Karo İkilisi)** bulunan oyuncu (veya sırayla `round % 4`) oyunu seçme hakkına (`selectorSeat`) sahiptir. İlk el (veya ilk 4 el) geleneksel olarak ceza ile başlar; sonraki ellerde sırası gelen ve kotası kalan oyuncu Ceza veya Koz seçer.

### 2. Tur Akışı Adım Adım
1. **Aşama 1 — Oyun Seçimi (`phase === 'selectingContract'`):**
   - Sırası gelen `selectorSeat` elindeki 13 karta bakarak kalan kotalarına göre bir oyun seçer (`{ type: 'selectContract', contract }`):
     - **6 Ceza Türü (`PenaltyType`):**
       1. `'elAlmaz'` (Hiç el almamak)
       2. `'kupaAlmaz'` (♥ Kupa kartı almamak)
       3. `'erkekAlmaz'` (Papaz `K` ve Vale `J` almamak)
       4. `'kizAlmaz'` (Kız `Q` almamak)
       5. `'rifki'` (**`K♥` Kupa Papazı**'nı almamak)
       6. `'sonIki'` (12. ve 13. löveleri almamak)
     - **Koz Türü (`TrumpContract`):** `'spades' | 'hearts' | 'diamonds' | 'clubs'` (veya `allowSanzatu: true` ise `'sanzatu'` kozsuz el alma).
2. **Aşama 2 — 13 Lövenin Oynanması (`phase === 'playing'`):**
   - İlk löveye `selectorSeat` başlar; sonraki lövelere bir önceki löveyi kazanan oyuncu başlar.
   - **Erken Bitiş Optimizasyonu (Önemli):**
     - `'rifki'` oyununda `K♥` (Rıfkı) bir lövede alındığı anda, kalan lövelerde başka puan olmadığı için el **anında biter**!
     - `'kizAlmaz'`, `'erkekAlmaz'`, `'kupaAlmaz'` oyunlarında ilgili tüm cezalı kartlar (4 Kız, 8 Erkek veya 13 Kupa) çıkıp alındığında el kalan löveler oynanmadan **anında biter**!

### 3. Geçerli / Geçersiz Hamle Kuralları ve Tüm Kenar Durumlar
1. **Ceza Oyunlarında Geçerli Hamle Kuralları (Koz Yoktur!):**
   - **Renge Uyma Zorunluluğu:** Her ceza oyununda dönen renkten (`leadSuit`) elde kart varsa o rengi atmak **zorunludur**. Ceza oyunlarında **asla büyütme zorunluluğu yoktur** (oyuncu elindeki en küçük kartı atıp elin altından kaçabilir!).
   - **Kupa Almaz ve Rıfkı Özel Kuralları (`heartsBrokenRule: true`):**
     - Yere henüz kupa düşmemişken (`heartsBroken === false`), elinde kupa dışında kartı olan oyuncu **kupa ile löveye başlayamaz** (ancak elinde sadece kupa kalmışsa kupa çıkabilir).
     - **Zorunlu Cezalı Kart Atma (`mustDiscardRifkiOrQueen: true`):**
       - **Rıfkı'da:** Dönen renkten elinde kart **olmayan** oyuncunun elinde `K♥` (Rıfkı) varsa, **Rıfkı'yı atmak (yemekten kurtulmak) zorundadır**! Eğer Rıfkı yoksa ama başka `♥` (Kupa) varsa, kupa atmak zorundadır. Ayrıca lövede kupa dönüyorsa ve elinde `K♥` dışında başka kupa varsa, masada `A♥` varsa `K♥`'yi `A♥`'nın altına atmak zorundadır!
       - **Kupa Almaz'da:** Dönen renkten elinde kart olmayan oyuncunun elinde `♥` (Kupa) varsa, **kupa atmak zorundadır**.
       - **Kız Almaz ve Erkek Almaz'da:** Dönen renkten elinde kart olmayan oyuncunun elinde Kız (`Q`) veya Erkek (`K`/`J`) varsa, onu atmak zorundadır.
2. **Koz Oyunlarında Geçerli Hamle Kuralları:**
   - Batak kurallarıyla aynıdır:
     - Koz kırılmadan koz çıkılamaz (elde sadece koz varsa çıkılır).
     - Dönen renge uymak zorunludur (ancak King koz oyunlarında aynı rengi büyütme zorunluluğu **yoktur**; sadece dönen renk yoksa koz çakmak ve daha önce koz çakılmışsa **kozu büyütmek / üstüne çakmak** zorunludur!).
   - **Sanzatu (Kozsuz El Alma):** Renge uymak zorunludur; koz olmadığı için renk yoksa herhangi bir kart atılır.

### 4. Puanlama Tablosu, Cezalar, Bitiş Koşulu ve Beraberlik Bozma

| Oyun / Kontrat Türü | Birim Puan / Ceza | Adet | El Başına Toplam Puan | Partide Oynanma Sayısı | Parti Toplamı |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. El Almaz** | Alınan her löve: **`-50`** | 13 löve | `-650` | 2 kez | `-1300` |
| **2. Kupa Almaz** | Alınan her ♥ Kupa: **`-30`** | 13 kart | `-390` | 2 kez | `-780` |
| **3. Erkek Almaz** | Alınan her `K` ve `J`: **`-60`** | 8 kart | `-480` | 2 kez | `-960` |
| **4. Kız Almaz** | Alınan her `Q`: **`-100`** | 4 kart | `-400` | 2 kez | `-800` |
| **5. Rıfkı (`K♥`)** | `K♥` alan oyuncuya: **`-320`** | 1 kart | `-320` | 2 kez | `-640` |
| **6. Son İki** | 12. ve 13. löve: **`-180`** | 2 löve | `-360` | 2 kez | `-720` |
| **Toplam Ceza Havuzu** | — | — | `-2600` (×2) | **12 Ceza Eli** | **`-5200`** |
| **Koz / Sanzatu Oyunları** | Alınan her löve: **`+50`** | 13 löve | `+650` | **8 Koz Eli** | **`+5200`** |
| **GENEL PARTİ TOPLAMI** | — | — | — | **20 El** | **`0` (Sıfır Toplamlı!)** |

- **Matematiksel Sağlama:** Her el sonunda ve 20 el sonunda 4 oyuncunun puanlarının toplamı **her zaman tam `0`**'dır (`-5200 + 5200 = 0`).
- **King Yapmak (`kingInstantWin: true`):** Bir koz oyununda 13 lövenin **13'ünü de** tek başına alan oyuncu "King" yapmış olur ve partiyi o anda kazanır.
- **Parti Sonu ve Beraberlik Bozma:** 20 el sonunda puanı `>= 0` (artıda) olan oyuncular partiyi kazanmış sayılır; en yüksek artı puandaki oyuncu 1. olur. Eşitlikte daha çok Koz eli kazanan, o da eşitse daha az Rıfkı yiyen üst sırada yer alır.

### 5. Yaygın Ev Kuralları ve Varyantlar (Ayarlar)

| Ayar Adı | Varsayılan | Olası Değerler | Ne Değiştirir? |
| :--- | :--- | :--- | :--- |
| `partyLength` | `20` | `20`, `12` | `20` = Standart (her oyuncu 3 ceza + 2 koz); `12` = Hızlı King (her ceza 1 kez = 6 ceza + 6 koz, toplam yine sıfır dengeli). |
| `allowSanzatu` | `true` | `true`, `false` | Koz hakkını kozsuz (Sanzatu) olarak kullanabilmeyi açar. |
| `heartsBrokenRule` | `true` | `true`, `false` | Kupa Almaz ve Rıfkı'da kupa çıkmadan kupa çıkma yasağı. |
| `mustDiscardRifkiOrQueen` | `true` | `true`, `false` | Renk yokken eldeki Rıfkı, Kız, Erkek veya Kupa'yı atma zorunluluğu. |
| `kingInstantWin` | `true` | `true`, `false` | Kozda 13 el alanın partiyi anında kazanması. |

### 6. Süre / Zaman Aşımı ve Oyuncu Ayrılınca Ne Olur
- **Süre:** Kontrat seçimi **40 sn**, kart oynama **20 sn**.
- **Zaman Aşımı (`quickMove`):**
  - Kontrat seçiminde: Bot değerlendirmesiyle eline en uygun kalan kontratı seçer.
  - Kart oynamada: Ceza oyunundaysa `legalCards` içindeki en küçük (veya cezalı kartı yediren) kartı, koz oyunundaysa eli alabilecek/koruyacak kartı oynar.
- **Oyuncu Ayrılması:** Bot devralır (`botMove`).

### 7. Gizli Bilgi (`viewFor`)
- **Gönderilenler:** Kendi `hand` kartları, `legalCardIds`, aktif `contract`, kalan ceza ve koz tabloları (`penaltyRemaining`, `playerQuotas`), o el her oyuncunun yediği cezalar / aldığı löveler (`roundBreakdown`), `heartsBroken` / `trumpBroken`.
- **Gizlenenler:** Rakiplerin elleri.

### 8. Bot Stratejisi İpuçları (Acemi / Usta)
- **Acemi (`easy`):** Kontratı rastgele kalan hakkından seçer; ceza oyununda en küçük kartı, kozda en büyük kartı oynar.
- **Usta (`hard`):**
  - **Kontrat Seçimi:**
    - Elinde `K♥` veya `A♥` ve çok sayıda kupa varsa **asla** `rifki` veya `kupaAlmaz` seçmez; bir renkte 6+ kart ve As/Papaz varsa **Koz** seçer.
    - Kısa (1-2 kartlı) bir rengi varsa ve yüksek kartları yoksa `elAlmaz` veya `sonIki` seçer.
    - Elinde `A♠, K♠, A♦` gibi yan As/Papazlar varsa ama `K♥` yoksa `rifki` seçip yan rengini hızla bitirerek Rıfkı'dan kaçar.
  - **Ceza Oynanışı:**
    - `sonIki`'de ilk 11 lövede elindeki tüm büyük kartları (`A, K, Q`) harcar, 12. ve 13. löveye en küçük (`2, 3, 4`) kartlarını saklar!
    - `rifki` ve `kizAlmaz`'da elindeki kısa rengi boşaltıp (`şikan yapıp`), o renk döndüğünde elindeki `K♥` veya `Q`'ları rakiplerin üstüne atar.

### 9. Test Senaryoları Listesi (25 Somut Test Durumu)
1. **[KNG-T01] Başlangıç Kotaları:** `create` → 4 oyuncunun her birinde `penaltiesLeft: 3, trumpsLeft: 2`; 6 cezanın her birinde `remaining: 2`.
2. **[KNG-T02] Ceza Hakkı Biten Oyuncunun Ceza Seçememesi:** Koltuk 0'ın `penaltiesLeft === 0, trumpsLeft === 1` iken `'rifki'` seçmek ister → `{ ok: false, error: 'Ceza seçme hakkınız kalmadı' }`.
3. **[KNG-T03] İki Kez Oynanmış Cezanın Tekrar Seçilememesi:** `'kizAlmaz'` partide 2 kez oynandı (`remaining === 0`). Koltuk 1 `'kizAlmaz'` seçmek ister → `{ ok: false, error: 'Bu ceza oyunu 2 kez oynandı' }`.
4. **[KNG-T04] El Almaz Puanlaması:** `'elAlmaz'` elinde oyuncular `[0, 5, 6, 2]` löve aldı → Skorlar: `[0, -250, -300, -100]`, toplam `-650`.
5. **[KNG-T05] Kupa Almaz Puanlaması:** `'kupaAlmaz'` elinde oyuncular `[0, 3, 10, 0]` adet ♥ Kupa aldı → Skorlar: `[0, -90, -300, 0]`, toplam `-390`.
6. **[KNG-T06] Erkek Almaz Puanlaması:** `'erkekAlmaz'` elinde oyuncular `[1, 2, 5, 0]` adet `K`/`J` aldı → Skorlar: `[-60, -120, -300, 0]`, toplam `-480` (`Q` ve `A` ceza yazmaz!).
7. **[KNG-T07] Kız Almaz Puanlaması ve 4 Kız Çıkınca Erken Bitiş:** 9. lövede 4. Kız (`Q`) da alındı (dağılım `[0, 1, 2, 1]`) → 10..13. löveler oynanmadan el **anında biter**, skorlar `[0, -100, -200, -100]`.
8. **[KNG-T08] Rıfkı Puanlaması ve `K♥` Alınınca Anında Bitiş:** 6. lövede `K♥` kartını Koltuk 2 aldı → El 6. löve sonunda **anında biter**, skorlar `[0, 0, -320, 0]`.
9. **[KNG-T09] Son İki Puanlaması:** İlk 11 lövenin tamamını Koltuk 0 aldı, ancak 12. löveyi Koltuk 1, 13. löveyi Koltuk 3 aldı → Skorlar: `[0, -180, 0, -180]`, toplam `-360`.
10. **[KNG-T10] Koz Oyunu Puanlaması:** Koz `♦`, oyuncular `[8, 3, 2, 0]` löve aldı → Skorlar: `[+400, +150, +100, 0]`, toplam `+650`.
11. **[KNG-T11] Ceza Oyununda Aynı Rengi Büyütme Zorunluluğunun Olmaması:** `'elAlmaz'` oyununda yere `♠10` açıldı. Koltuk 1'in elinde `♠A` ve `♠2` var → Koltuk 1 `♠2` atarak elin altından kaçabilir (`{ ok: true }`).
12. **[KNG-T12] Kupa Almaz'da Kupa Kırılmadan Kupa Çıkma Yasağı:** `'kupaAlmaz'`, `heartsBroken: false`. Koltuk 0'ın elinde `♥2` ve `♣8` varken löveye `♥2` ile başlamak ister → `{ ok: false }`.
13. **[KNG-T13] Rıfkı'da Renk Yokken Zorunlu `K♥` Atma:** `'rifki'` oyununda yere `♣5` açıldı. Koltuk 1'de hiç `♣` yok, elinde `K♥`, `♥3` ve `♠A` var → Koltuk 1 `♠A` veya `♥3` atamaz, **`K♥` (Rıfkı) atmak zorundadır**!
14. **[KNG-T14] Rıfkı'da Kupa Dönüyorken `A♥` Altına Zorunlu `K♥` Atma:** `'rifki'` oyununda yere `♥4` açıldı, Koltuk 1 `A♥` attı. Koltuk 2'nin elinde `K♥` ve `♥7` var → Masada `A♥` olduğu için Koltuk 2 `♥7` atamaz, **`K♥` atarak Rıfkı'yı `A♥` sahibine yedirmek zorundadır**!
15. **[KNG-T15] Kız Almaz'da Renk Yokken Zorunlu Kız Atma:** `'kizAlmaz'` oyununda yere `♦6` açıldı. Koltuk 2'de `♦` yok, elinde `Q♠` ve `♣2` var → `♣2` atamaz, `Q♠` atmak zorundadır.
16. **[KNG-T16] Koz Oyununda Dönen Renk Varken Büyütme Zorunluluğu Olmaması, Renk Yokken Üstüne Çakma Zorunluluğu:** Koz `♠`, yere `♥10` açıldı. Koltuk 1 (`♥A, ♥2` var) `♥2` atabilir (`{ ok: true }`). Koltuk 2 (`♥` yok, `♠5` var) `♠5` çakar. Koltuk 3 (`♥` yok, `♠3, ♠9` var) `♠9` ile üstüne çakmak **zorundadır**.
17. **[KNG-T17] Sanzatu Kontratı:** `contract: 'sanzatu'` seçildiğinde koz yoktur; alınan her löve `+50` puan yazar.
18. **[KNG-T18] Kozda 13 El Alarak "King" Yapma (`kingInstantWin: true`):** Koz oyununda Koltuk 0 13 lövenin tamamını alır → `result.isKing === true`, `matchOver === true`.
19. **[KNG-T19] 20 El Sonunda Sıfır Toplam Sağlaması:** 12 ceza ve 8 koz eli tamamlandığında `totals.reduce((a, b) => a + b, 0) === 0` eşitliği sağlanır.
20. **[KNG-T20] Hızlı 12 El Modu (`partyLength: 12`):** Her oyuncu 1.5 yerine toplamda 6 ceza (her ceza 1 kez = `-2600`) ve 6 koz (her löve `+2600 / 78` veya dengeli ölçek) oynar.
21. **[KNG-T21] Erkek Almaz'da Renk Yokken Zorunlu `K` veya `J` Atma:** Yere `♠4` açıldı, Koltuk 1'de `♠` yok ama `J♦` ve `7♣` var → `J♦` atmak zorundadır.
22. **[KNG-T22] Kupa Almaz'da Renk Yokken Zorunlu Kupa Atma:** Yere `♣8` açıldı, Koltuk 3'te `♣` yok ama `♥K` ve `♦A` var → `♥K` atmak zorundadır.
23. **[KNG-T23] Son İki'de 12. Löveden Sonra Devam:** 12. löve alındığında el bitmez (13. löve de `-180` puan olduğu için 13. löve sonuna kadar oynanır).
24. **[KNG-T24] Usta Botun Son İki Stratejisi:** `'sonIki'` oyununda 1..10. lövelerde Usta bot elinde `[A♠, 2♠]` varken `♠` döndüğünde `A♠` atarak büyük kartından kurtulur, `2♠`'yi son iki löveye saklar.
25. **[KNG-T25] Gizli Bilgi Testi (`viewFor`):** Rakiplerin elleri asla sızmaz; kalan ceza/koz tablosu eksiksiz görünür.

### 10. 60+ Kullanıcı İçin Arayüzde Gösterilmesi Gereken Yardımcı Bilgiler
- **Büyük Kontrat Seçim Tablosu:** Sıra oyuncudayken ekranda 6 Ceza (kırmızı sütun) ve Kozlar (yeşil sütun) büyük düğmelerle açılmalı; oynanmış/bitmiş cezaların üstü çizili (`"Rıfkı (Bitti)"`), kalanlar `"Kız Almaz (-100 · 1 hak kaldı)"` şeklinde net yazmalı.
- **Aktif Oyun Uyarı Şeridi:** Ekranın en üstünde o elin kuralı dev harflerle yazmalı: örn. **"OYUN: RIFKI — ♥K (Kupa Papazı) ALMA! (-320)"** veya **"OYUN: SON İKİ — 12. ve 13. ELİ ALMA! (-180)"**.
- **Otomatik Zorunlu Kart Filtresi:** Rıfkı, Kız veya Kupa yedirme zorunluluğu devreye girdiğinde `legalCardIds` sadece o kartları açık bırakmalı ve durum satırında `"Kural gereği Kupa/Rıfkı atmalısın"` yazmalı.

---

## OYUN 6: KONKEN (Klasik 10 Kağıt & 14 Kağıt Varyantı)

### 1. Malzeme ve Kurulum
- **Malzeme:** 2 adet 52'lik standart iskambil destesi + **2 adet Joker** = **106 kart** (101 Okey ile aynı kart/taş matematiği).
- **Oyuncu Sayısı:** 4 oyuncu (`0, 1, 2, 3`) veya 2 oyuncu (`0, 1`).
- **Varyantlara Göre Dağıtım:**
  1. **Klasik 10 Kağıt Konken (`variant: 'classic10'`):**
     - Başlayan oyuncuya (`startingSeat`, dağıtıcının sağı = "Mecburcu") **11 kart**, diğer oyunculara **10'ar kart** dağıtılır.
     - Kalan kartlar orta desteyi (`deck`) oluşturur.
  2. **14 Kağıt Konken (`variant: 'rummy14'`):**
     - Başlayan oyuncuya **15 kart**, diğer oyunculara **14'er kart** dağıtılır.
- **Kart Puan Değerleri:**
  - `2..10`: Kendi sayı değeri (`2..10` puan).
  - `J, Q, K`: Her biri **`10` puan**.
  - `A` (As): `A-2-3` serisinde **`1` puan** (veya ceza hesabında elde kalırsa **`11` puan**), `Q-K-A` serisinde ve `A-A-A` setinde **`11` puan** (ayarlara göre `10`).
  - `Joker`: Perde temsil ettiği kartın puanını alır; elde kalırsa **`25` puan** (veya `100` puan) ceza yazar.

### 2. Tur Akışı Adım Adım
1. **Ön Bahis / Giriş Aşaması (`variant === 'classic10'` ve `enableBettingPool: true` ise):**
   - Sadece sanal puan/çip ile (gerçek para yok): Dağıtıcının sağındaki ilk oyuncu **Mecburcu**'dur (havuz girişi `1` birim). Diğer oyuncular ellerine bakıp `"Kabul"` (oyuna girer), `"Pas / Yokum"` (o el çekilir, ceza yemez) veya `"Rölans"` (girişi `2` birime çıkarır) diyebilir. (`enableBettingPool: false` ise herkes doğrudan oyundadır).
2. **Çekme Fazı (`draw`):**
   - Başlayan oyuncu ilk turda kart çekmez (11 veya 15 kartı vardır).
   - Sonraki turlarda oyuncu orta desteden (`deck`) veya solundaki oyuncunun son attığı karttan (`discard`) 1 kart çeker.
3. **Açma / İşleme Fazı (`open` / `meld` / `addToMeld`):**
   - **Klasik 10 Kağıt Konken'de (`openThreshold: 0`):** Sayı barajı yoktur; oyuncu istediği geçerli perleri (`set` veya `run`) açabilir veya hiç açmadan elinde biriktirip tek hamlede **elden ("Konken")** bitebilir!
   - **14 Kağıt Konken'de (`openThreshold: 51`):** İlk açılışta perlerin toplamı en az **51 puan** (veya 5 çift) olmalıdır.
   - Açmış oyuncu masadaki tüm perlere kart işleyebilir (`addToMeld`) ve yerdeki jokeri gerçek kartıyla değiştirebilir (`jokerSwap`).
4. **Atma Fazı (`discard`):** Oyuncu 1 kartı ıskartaya atar; elinde `0` kart kalırsa el biter.

### 3. Geçerli / Geçersiz Hamle Kuralları ve Tüm Kenar Durumlar
1. **Per Kuralları (`analyzeCardMeld`):**
   - **Set (Grup):** Farklı takımlardan (`♠, ♥, ♦, ♣`) aynı değerde 3 veya 4 kart (örn. `7♠-7♥-7♦`). **Aynı takımdan iki kart aynı sette olamaz** (örn. `7♠-7♠-7♥` geçersizdir!).
   - **Seri (`run`):** Aynı takımdan ardışık en az 3 kart.
     - As (`A`) hem en başta (`A-2-3-...`) hem de en sonda (`...-Q-K-A`) kullanılabilir.
     - `aceWrapAllowed: false` (varsayılan) iken `K-A-2` döngüsü **geçersizdir**.
2. **Yandan Kart Alma Kuralı:**
   - Yandan alınan kart o tur içinde mutlaka bir perde açılmalı veya masadaki bir pere işlenmelidir; geri atılamaz ve elde tek başına bırakılamaz.
3. **Konken (Elden Bitme) Durumu:**
   - Oyuncu daha önce yere hiç per açmamışken, 10 (veya 14) kartının tamamını tek turda per yapıp 11. (veya 15.) kartını ıskartaya atarak biterse **"Konken"** yapmış olur (`elden = true`, cezalar `×2`).

### 4. Puanlama Tablosu, Cezalar, Bitiş Koşulu ve Beraberlik Bozma

| Durum | Klasik 10 Kağıt Konken | 14 Kağıt Konken |
| :--- | :--- | :--- |
| **Normal Biten Oyuncu** | `-50` puan (veya sanal havuzu alır) | `-51` puan |
| **Konken (Elden) veya Jokerle Biten** | `-100` puan (Çarpan `×2`) | `-102` puan (Çarpan `×2`) |
| **Açmış Rakip** | Elde kalan kartların toplam puanı `× multiplier` | Elde kalan kartların toplam puanı `× multiplier` |
| **Hiç Açmamış Rakip** | **`100 × multiplier`** | **`100 × multiplier`** |
| **Elde Kalan Joker** | Joker başına **`+25`** (veya `+50`) ek ceza | Joker başına **`+51`** ek ceza |

- **Bitiş Koşulu:** `targetRounds` (örn. 7 el) sonunda en düşük ceza puanına sahip oyuncu kazanır.

### 5. Yaygın Ev Kuralları ve Varyantlar (Ayarlar)

| Ayar Adı | Varsayılan | Olası Değerler | Ne Değiştirir? |
| :--- | :--- | :--- | :--- |
| `variant` | `'classic10'` | `'classic10'`, `'rummy14'` | 10 kağıt barajsız klasik Konken veya 14 kağıt 51 barajlı Konken. |
| `openThreshold` | `0` (`classic10`) | `0`, `51` | İlk el açma baraj puanı. |
| `enableBettingPool` | `false` | `true`, `false` | Mecburcu / Kabul / Rölans sanal puan havuzu aşamasını açar/kapatır. |
| `aceWrapAllowed` | `false` | `true`, `false` | `K-A-2` serisine izin verilip verilmeyeceği. |

### 6. Süre / Zaman Aşımı ve Oyuncu Ayrılınca Ne Olur
- **Süre:** İlk tur **60 sn**, sonraki turlar **30 sn**, ilk per açmada 1 kez **+30 sn** yenileme.
- **Zaman Aşımı (`quickMove`):** Desteden çeker, en yüksek puanlı per dışı kartı atar.
- **Oyuncu Ayrılması:** Bot devralır.

### 7. Gizli Bilgi (`viewFor`)
- 101 Okey ile aynıdır: Rakiplerin elleri, orta deste sırası ve geçmiş ıskartalar gizlenir.

### 8. Bot Stratejisi İpuçları (Acemi / Usta)
- **Acemi (`easy`):** Bulduğu her 3'lü peri hemen yere açar.
- **Usta (`hard`):** Klasik 10 kağıtta rakiplere işleme fırsatı vermemek ve `×2` çarpan almak için elini yere açmadan içeride **Konken (elden bitme)** kovalar; ancak rakiplerden biri 3 kartın altına düştüğünde elindeki yüksek puanlı perleri hemen yere indirerek cezasını küçültür.

### 9. Test Senaryoları Listesi (25 Somut Test Durumu)
1. **[KON-T01] 10 Kağıt Dağıtımı:** `variant: 'classic10'` → Başlayanda 11, diğer 3 oyuncuda 10'ar kart, destede `65` kart (`11 + 30 + 65 = 106`).
2. **[KON-T02] 14 Kağıt Dağıtımı:** `variant: 'rummy14'` → Başlayanda 15, diğerlerinde 14'er kart, destede `49` kart.
3. **[KON-T03] `A-2-3` ve `Q-K-A` Geçerliliği:** `A♠-2♠-3♠` (`points: 6`) ve `Q♠-K♠-A♠` (`points: 31`) ikisi de geçerli `'run'` döner.
4. **[KON-T04] `K-A-2` Döngü Reddi:** `aceWrapAllowed: false` iken `K♠-A♠-2♠` → `analyzeCardMeld === null`.
5. **[KON-T05] Aynı Takımdan İki Kartlı Set Reddi:** `9♠-9♠-9♥` → `analyzeCardMeld === null`.
6. **[KON-T06] Klasik 10 Kağıtta Barajsız Açma:** `openThreshold: 0` iken oyuncu sadece `2♣-3♣-4♣` (`9` puan) ile `open` yapar → `{ ok: true }`.
7. **[KON-T07] Klasik 10 Kağıtta Tek Turda Konken (Elden) Bitiş:** Oyuncu hiç açmamışken `4+3+3 = 10` kartını per yapıp 11. kartını atar → `elden: true`, `multiplier: 2`.
8. **[KON-T08] Yerdeki Jokeri Gerçek Kartıyla Değiştirme (`jokerSwap`):** Masadaki `5♥-Joker-7♥` perine açmış oyuncu `6♥` işler → Joker oyuncunun eline geçer.
9. **[KON-T09] Yandan Alınan Kartı Kullanmadan Atma Reddi:** Soldan alınan kart o tur bir perde kullanılmazsa hamle reddedilir.
10. **[KON-T10] Atacak Kart Bırakmadan Açma Reddi:** Eldeki 11 kartın 11'ini de per olarak açmak isterse `{ ok: false, error: 'Atmak için elinizde bir kart kalmalı' }`.
11. **[KON-T11] İki Jokerli Per:** `10♦-Joker-Joker` → Geçerli set/seri olarak okunur.
12. **[KON-T12] Çift Açma (14 Kağıt Varyantında 5 Çift):** 5 adet birebir aynı kart çifti (örn. iki adet `K♠`) ile açılır → `{ ok: true, pairs: true }`.
13. **[KON-T13] Farklı Takımdan İki Papazın Çift Sayılmaması:** `K♠-K♥` çift olarak açılmak istenir → `{ ok: false }` (Konken/51'de çift olması için hem sayı hem takım aynı olmalıdır: iki adet `K♠`).
14. **[KON-T14] Jokerle Bitiş Çarpanı (`×2`):** Son atılan kart Joker ise `jokerFinish: true`, `multiplier: 2`.
15. **[KON-T15] Elde Kalan As ve Resimli Kartların Ceza Hesabı:** Açmış oyuncunun elinde `A♠, K♥, 5♦` kaldı → `11 + 10 + 5 = 26` ceza puanı.
16. **[KON-T16] Elde Kalan Joker Ceza Hesabı:** Açmış oyuncunun elinde `Joker + 4♣` kaldı → `25 + 4 = 29` ceza puanı.
17. **[KON-T17] Hiç Açmamış Oyuncu Cezası:** Normal bitişte açmamış oyuncuya `100`, Konken bitişte `200` ceza yazılır.
18. **[KON-T18] Mecburcu ve Pas/Rölans Akışı (`enableBettingPool: true`):** Mecburcu oyunda kalır, Koltuk 2 `"Pas"` derse Koltuk 2'nin kartları toplanır ve o el ceza/puan almaz.
19. **[KON-T19] Rölans Yapılınca Çarpanın Artması:** Koltuk 1 `"Rölans"` der ve kabul edilirse o elin puan/ceza çarpanı `×2` olur.
20. **[KON-T20] Orta Deste Bitince Iskartaların Karıştırılması:** Orta deste bittiğinde son atılan kart hariç ıskartalar yeniden karıştırılır.
21. **[KON-T21] Çiftten Açanın Seri İndirememesi:** Çiftten açan oyuncu yeni seri indiremez, yalnızca çift indirebilir ve açık perlere işleyebilir.
22. **[KON-T22] 2 Kişilik Konken Kurulumu:** `seats: 2` → Koltuk 0'da 11, Koltuk 1'de 10 kart, destede `85` kart.
23. **[KON-T23] As'ın Hem Baştan Hem Sondan İşlenmesi:** Masadaki `2♠-3♠-4♠` perine `A♠` işlenebilir (`1` puan); `J♠-Q♠-K♠` perine de `A♠` işlenebilir (`11` puan). Ancak `A♠-2♠-...-K♠` (13 kart) perine ikinci bir `A♠` işlenemez!
24. **[KON-T24] Usta Botun Elde Yüksek Kart Tuttuğunda Erken Açması:** Rakip 2 karta düştüğünde Usta bot elindeki `Q-K-A` perini hemen yere indirir.
25. **[KON-T25] Gizli Bilgi (`viewFor`):** Rakip elleri ve deste sırası `viewFor` içinde asla yer almaz.

### 10. 60+ Kullanıcı İçin Arayüzde Gösterilmesi Gereken Yardımcı Bilgiler
- **"Otomatik Diz (Seri / Çift)" Düğmesi:** 104+2 kartlık destede aynı karttan ikişer kopya olduğu için, tek dokunuşla kartları takıma ve sıraya göre gruplayan `"Diz"` düğmesi.
- **As Puan Gösterimi:** As `A-2-3` yanına konduğunda üzerinde küçük `"1"`, `Q-K-A` yanına konduğunda `"11"` rozeti gösterilmeli.

---

## OYUN 7: 51 (ELLİ BİR — Tekli ve Eşli, Kademeli Barajlı)

### 1. Malzeme ve Kurulum
- **Malzeme:** 2 adet 52'lik iskambil destesi + **2 adet Joker** = **106 kart**.
- **Oyuncu Sayısı:** 4 oyuncu (`0, 1, 2, 3`). Eşli modda (`partnerMode: true`) `0-2` ve `1-3` ortaktır.
- **Dağıtım:** Başlayan oyuncuya **15 kart**, diğer 3 oyuncuya **14'er kart** dağıtılır (`15 + 42 = 57` kart).
- **Gösterge / Joker Kuralı:**
  - Standart 51'de 2 basılı Joker doğrudan jokerdir (`isJoker`).
  - *(İsteğe bağlı kahvehane varyantında 1 kart gösterge açılır, aynı takımın bir üstü de joker olur; varsayılan olarak 2 basılı Joker kullanılır).*

### 2. Tur Akışı Adım Adım
1. Başlayan oyuncu (15 kartlı) kart çekmeden isterse açar (`open`), ardından 1 kart atar (`discard`).
2. Sıradaki oyuncu orta desteden (`deck`) veya solundaki oyuncunun son attığı karttan (`discard`) 1 kart çeker.
3. **Kademeli Baraj (`progressiveThreshold: true`, 51'in İmza Kuralı):**
   - Masada **ilk el açacak** oyuncunun perlerinin toplamı en az **`51` puan** olmalıdır.
   - İlk oyuncu örneğin `64` puanla açtıysa, ondan sonra seri/set açacak oyuncunun barajı **`65` puan** (`son_açılan_puan + 1`) olur!
   - İkinci oyuncu `78` ile açtıysa üçüncü oyuncunun barajı **`79` puan** olur!
   - **Çift Açma Barajı:** İlk çift açan en az **`5` çift** (veya `pairsToOpen: 4` ise `4 çift + 1 üçlü per`), sonraki çift açacak olan **`6` çift**, üçüncüsü **`7` çift** açmak zorundadır.
4. Açmış oyuncu yeni per indirebilir (`meld`), masadaki perlere kart işleyebilir (`addToMeld`), yerdeki jokeri gerçek kartıyla alabilir (`jokerSwap`) ve sonunda 1 kart atar (`discard`).

### 3. Geçerli / Geçersiz Hamle Kuralları ve Tüm Kenar Durumlar
1. **Per ve Kart Değerleri:**
   - `2..10` kendi değeri, `J, Q, K = 10` puan, `A` (`A-2-3`'te `1` puan, `Q-K-A` ve `A-A-A`'da `10` veya `11` puan — standart 51'de tüm resimler ve As yüksekte **`10` puan** sayılır, `A-2-3`'te `1` puan sayılır).
   - Çift: İki kartın **hem sayısı hem takımı (rengi/şekli) birebir aynı** olmalıdır (örn. `♥8 - ♥8`).
2. **Yandan Kart Alma (`strictSidePickup: true`):**
   - Henüz açmamış oyuncu soldan kart alırsa **o tur içinde kademeli barajı geçerek elini açmak ve aldığı kartı açtığı perlerde kullanmak zorundadır**.
3. **İşlek Kart Atma (`throwableMeldCardPenalty: 51`):**
   - Masadaki açık perlere işlenebilen bir kartı ıskartaya atmak **+51 ceza puanı** yazar.
4. **Elden Bitme (51'de):**
   - Daha önce hiç açmamışken 14 kartını tek turda açıp/işleyip 15. kartını atarak biten oyuncu **elden bitmiş** olur (tüm cezalar `×2`).

### 4. Puanlama Tablosu, Cezalar, Bitiş Koşulu ve Beraberlik Bozma

| Durum | Tekli 51 Puanı | Eşli 51 Puanı |
| :--- | :--- | :--- |
| **Normal Bitiş (Biten)** | **`-51`** | **`-51`** (Ortağın elinde kalan kartlar **sayılmaz**, `0` yazar) |
| **Elden / Jokerle / Çiftle Bitiş** | Her biri çarpanı `×2` yapar (`-102`, `-204`, `-408`) | Aynı çarpan |
| **Hiç Açamamış Rakip** | **`100 × multiplier`** (`100 / 200 / 400`) | Karşı takımda açamayan her oyuncu için `100 × multiplier` |
| **Seri/Set Açmış Rakip** | `El_Kart_Toplamı × multiplier` | `El_Kart_Toplamı × multiplier` |
| **Çiftten Açmış Rakip** | `El_Kart_Toplamı × 2 × multiplier` | `El_Kart_Toplamı × 2 × multiplier` |
| **Elde Kalan Joker** | Joker başına sabit **`+51`** (çarpılmaz) | Joker başına sabit **`+51`** |
| **Oyun İçi Cezalar** | İşlek atma `+51`, Joker çaldırma `+51`, Joker atma `+51` | Takım hanesine `+51` |

- **Bitiş Koşulu:** Bir oyuncunun/takımın toplam ceza puanı `targetPoints` (varsayılan `301` veya `501`) sınırına ulaştığında maç biter; en düşük puandaki kazanır.

### 5. Yaygın Ev Kuralları ve Varyantlar (Ayarlar)

| Ayar Adı | Varsayılan | Olası Değerler | Ne Değiştirir? |
| :--- | :--- | :--- | :--- |
| `partnerMode` | `false` | `true`, `false` | Tekli veya Eşli 51. |
| `progressiveThreshold` | `true` | `true`, `false` | `true` ise ilk açandan sonra baraj `son_açılan + 1` olarak yükselir; `false` ise herkes için sabit 51 kalır. |
| `pairsToOpen` | `5` | `4`, `5` | `5` = 5 çift; `4` = 4 çift + 1 üçlü per ile açılış. |
| `throwableMeldCardPenalty` | `51` | `0`, `51` | İşlek kart atma cezası. |
| `notOpenedPenalty` | `100` | `100`, `200` | Hiç açamayan oyuncunun taban cezası. |

### 6. Süre / Zaman Aşımı ve Oyuncu Ayrılınca Ne Olur
- 101 Okey ile birebir aynıdır (`30 sn` tur, `60 sn` ilk tur, ilk açmada 1 kez yenileme, `quickMove` ve bot devralma).

### 7. Gizli Bilgi (`viewFor`)
- 101 Okey ile birebir aynıdır; ek olarak aktif kademeli baraj (`currentOpenThreshold: number` ve `currentPairsThreshold: number`) `viewFor` içinde açıkça gönderilir.

### 8. Bot Stratejisi İpuçları (Acemi / Usta)
- **Acemi (`easy`):** 51'i bulur bulmaz elindeki tüm perleri indirir.
- **Usta (`hard`):**
  - **Baraj Yönetimi (51'e Özel Taktik!):** Elinde `55` puanlık iki per ve `30` puanlık üçüncü bir per varsa (`toplam 85`), ilk açarken üçünü birden (`85`) açıp ortağının barajını `86`'ya yükseltmez (eşli oyundaysa)! Önce `55` ile açar (`open`), aynı turda üçüncü perini `meld` ile ayrıca indirir? **DİKKAT (Kenar Durum):** Kahvehane 51 kuralında bir oyuncunun **açtığı turda (`openedOnTurn === turnNumber`) indirdiği tüm perlerin toplamı** o oyuncunun açılış barajı sayılır! Dolayısıyla barajı düşük tutmak isteyen oyuncu 3. perini bir sonraki turda indirir; rakibi kilitlemek isteyen oyuncu ise aynı turda hepsini indirip barajı `86`'ya çıkarır!

### 9. Test Senaryoları Listesi (25 Somut Test Durumu)
1. **[E51-T01] Dağıtım:** 4 oyuncu, başlayanda 15, diğerlerinde 14 kart, destede `49` kart, `currentOpenThreshold: 51`.
2. **[E51-T02] 50 Puanla İlk Açılış Reddi:** İlk açacak oyuncu `50` puanlık perlerle `open` dener → `{ ok: false, error: 'Açmak için en az 51 gerekli (50)' }`.
3. **[E51-T03] Kademeli Barajın Yükselmesi:** Koltuk 0 `62` puanla açtı → `currentOpenThreshold` `63` olur. Koltuk 1 `62` puanla `open` denerse `{ ok: false, error: 'Açmak için en az 63 gerekli (62)' }`, `63` ile denerse `{ ok: true }`.
4. **[E51-T04] Aynı Turda Ek Per İndirmenin (`meld`) Barajı Yükseltmesi:** Koltuk 0 `54` puanla `open` yaptıktan sonra **aynı turda** `20` puanlık bir `meld` daha indirir → Toplam açılışı `74` sayılır ve `currentOpenThreshold` `75`'e yükselir!
5. **[E51-T05] Sonraki Turda İndirilen Perin Barajı Yükseltmemesi:** Koltuk 0 ilk turda `54` ile açıp taş attı (`currentOpenThreshold: 55`). Bir sonraki turda `20` puanlık yeni bir per indirdiğinde `currentOpenThreshold` `55` olarak kalır.
6. **[E51-T06] Çift Açmanın Seri Barajını Etkilememesi:** Koltuk 0 `54` puanla seri açtı (`currentOpenThreshold: 55`). Koltuk 1 `5` çiftle açtı (`currentPairsThreshold: 6`). Koltuk 2 seri açmak isterse barajı hâlâ `55`'tir; çift açmak isterse `6` çifttir.
7. **[E51-T07] 4 Çift + 1 Per Varyantı (`pairsToOpen: 4`):** `pairsToOpen: 4` ayarında 4 çift + 1 adet 3'lü per (toplam 11 kart) ile açılış kabul edilir.
8. **[E51-T08] Aynı Sayı Farklı Takım Kartların Çift Reddi:** `10♠` ve `10♣` çift olarak gönderilir → `{ ok: false }` (iki adet `10♠` olmalıdır).
9. **[E51-T09] `A-2-3` (As = 1) vs `Q-K-A` (As = 10) Puan Hesabı:** `A♥-2♥-3♥` `6` puan, `Q♥-K♥-A♥` `30` puan verir.
10. **[E51-T10] Yandan Alınan Kartla Kademeli Barajı Geçememe Reddi:** `currentOpenThreshold: 70`, Koltuk 2 henüz açmamış ve soldaki kartla en fazla `68` yapabiliyor → `draw(discard)` reddedilir.
11. **[E51-T11] İşlek Kart Atma Cezası (+51):** Açmış oyuncu masadaki pere uyan bir kartı ıskartaya atar → `penalties += 51`.
12. **[E51-T12] Yerdeki Jokeri Alma ve +51 Ceza:** Rakibin perindeki jokeri gerçek kartıyla alan oyuncu jokeri eline alır, per sahibine `+51` ceza yazılır.
13. **[E51-T13] El Bitmeden Joker Atma Cezası (+51):** Elinde kart varken Joker atan oyuncuya `+51` ceza yazılır ve yan oyuncu o jokeri alamaz.
14. **[E51-T14] Normal Bitiş Puanlaması:** Koltuk 0 normal biter (`-51`), Koltuk 1 açmış (elde `18` sayı), Koltuk 2 çiftten açmış (elde `12` sayı), Koltuk 3 hiç açmamış → Skorlar: `[-51, 18, 24, 100]`.
15. **[E51-T15] Elden Bitiş Puanlaması (`×2`):** Koltuk 0 tek turda açıp biter → Skorlar: `[-102, 36, 48, 200]`.
16. **[E51-T16] Jokerle Bitiş Puanlaması (`×2`):** Son atılan kart Joker ise `multiplier: 2`, biten `-102`, açmayan `200`.
17. **[E51-T17] Elde Kalan Joker Cezası (+51 Sabit):** Açmış oyuncunun elinde 1 Joker ve `5♠` kaldı, el `multiplier: 2` ile bitti → `5 × 2 + 51 = 61` ceza alır.
18. **[E51-T18] Eşli 51'de Bitenin Ortağının Muafiyeti:** `partnerMode: true`, Koltuk 0 biterse ortağı Koltuk 2 hiç açmamış olsa bile `100` ceza yemez (`0`).
19. **[E51-T19] 4 Oyuncu da Çift Açarsa El İptali:** 4 oyuncu da çiftten açarsa el iptal olur (`scores: [0, 0, 0, 0]`).
20. **[E51-T20] Orta Deste Bitince Karıştırma:** Orta deste bittiğinde ıskartalar karıştırılır.
21. **[E51-T21] Sabit Baraj Modu (`progressiveThreshold: false`):** Koltuk 0 `80` ile açsa bile Koltuk 1 `51` ile açabilir.
22. **[E51-T22] 301 Ceza Barajıyla Maç Bitişi:** `targetPoints: 301`, toplamlar `[120, 305, 80, 210]` olduğunda `matchOver === true` döner ve en düşük puanlı Koltuk 2 (`80`) kazanır.
23. **[E51-T23] Atacak Kart Bırakmadan Tüm 15 Kartı Açma Reddi:** 15 kartın tamamı `open` içinde gönderilirse reddedilir.
24. **[E51-T24] Usta Botun Eşli Modda Barajı Yükseltmemesi:** Eşli modda ortağının henüz açmadığını gören Usta bot, 51'i geçen minimum per kümesiyle açıp kalan perini sonraki tura saklar.
25. **[E51-T25] Gizli Bilgi (`viewFor`):** Rakiplerin elleri ve deste sırası sızmaz; `currentOpenThreshold` ve `currentPairsThreshold` görünür.

### 10. 60+ Kullanıcı İçin Arayüzde Gösterilmesi Gereken Yardımcı Bilgiler
- **Canlı Kademeli Baraj Göstergesi:** `Aç` düğmesinin üzerinde o anki baraj büyük rakamlarla yazmalı: **"Şu Anki Baraj: 65 · Senin Elin: 58 (7 sayı daha)"**. Baraj her yükseldiğinde sesli/görsel bildirim (`"Ahmet 64 ile açtı! Yeni baraj: 65"`) çıkmalı.

---

## OYUN 8: PAPAZ KAÇTI (Kara Papaz / Papaz Kimde — 2, 3 ve 4 Kişilik)

### 1. Malzeme ve Kurulum
- **Malzeme:** 52 kartlık standart iskambil destesinden **3 adet Papaz (`K`) çıkarılır**, geriye **49 kart** (12 değer × 4'er kart = 48 eşleşebilir kart + **1 adet tek Papaz**, varsayılan olarak **`K♠` Kara Papaz**) kalır.
  - `removedKings: 'random3'` ayarında ise hangi Papazın oyunda kaldığı gizlidir (3 Papaz kapalı kutuya ayrılır); `'keepSpadeKing'` ayarında her zaman `K♠` (Maça Papazı) oyunda kalır.
- **Oyuncu Sayısı:** 2, 3 veya 4 oyuncu (`seats: 2 | 3 | 4`, varsayılan `4`).
- **Dağıtım:**
  - 49 kart oyunculara sırayla dağıtılır (4 kişide: başlayan oyuncuya **13 kart**, diğer 3 oyuncuya **12'şer kart**; 3 kişide `17, 16, 16`; 2 kişide `25, 24`).

### 2. Tur Akışı Adım Adım
1. **Aşama 1 — İlk Çiftleri Ayıklama (`phase === 'initialDiscard'`):**
   - Oyun başladığında her oyuncu elindeki çiftleri (aynı değerdeki 2 kartı, örn. iki adet `7`'li) masaya açık olarak atar (`{ type: 'discardPairs', pairs?: [string, string][] }` veya otomatik ayıklama).
   - **Üçlü Kart Kuralı:** Bir oyuncunun elinde aynı sayıdan **3 kart** varsa (örn. `5♠, 5♥, 5♦`), bunlardan **yalnızca 2 tanesi** çift olarak atılır, **1 tanesi elde kalır**. **4 kart** varsa 2 çift olarak dördü de atılır.
   - *(Papaz `K♠` tek olduğu için asla çiftlenemez — eğer `removedKings: 'keepSpadeKing'` ise)*.
2. **Aşama 2 — Sırayla Kart Çekme (`phase === 'drawing'`):**
   - Sırası gelen oyuncu (`turn`), **solundaki (bir önceki) aktif oyuncunun** (elinde hâlâ kart bulunan en yakın oyuncunun, `targetSeat`) kapalı tuttuğu elinden **rastgele bir pozisyon (`cardIndex: 0 .. targetHandCount - 1`)** seçerek 1 kart çeker (`{ type: 'drawFromPlayer', cardIndex }`).
   - **Otomatik Eşleşme:** Çekilen kart, oyuncunun elindeki bir kartla aynı değerdeyse (ve `pairColorMatch` kuralına uyuyorsa), bu iki kart **anında çift olarak masaya açık atılır**! Eşleşmiyorsa oyuncunun eline eklenir ve oyuncunun eli (`shuffleHandOnPick: true` ise) karıştırılır.
   - **Oyundan Çıkma (Bitirme):** Bir oyuncunun elinde `0` kart kaldığında (kartını çektirdiği anda veya çektiği kartla son çiftini yaptığında) o oyuncu **kurtulur (oyundan çıkar)**!
   - Sıra saat yönünün tersine bir sonraki **elinde kart bulunan aktif oyuncuya** geçer.
3. **Bitiş (`phase === 'finished'`):**
   - Masada elinde kart kalan **tek 1 oyuncu** kaldığında (elinde tek başına **Papaz `K`** kalmıştır!), el biter. Elinde Papaz kalan bu son oyuncu eli **kaybeder ("Papaz onda kaldı")**.

### 3. Geçerli / Geçersiz Hamle Kuralları ve Tüm Kenar Durumlar
1. **Çift Eşleşme Kuralı (`pairColorMatch`):**
   - `'any'` (Varsayılan): Aynı değerdeki herhangi iki kart (`7♠` ile `7♥`) birbiriyle eşleşir. Çünkü 4 karttan herhangi ikisi eşleştiğinde geriye kalan 2 kart da birbiriyle eşleşir ve hiçbir kart açıkta kalmaz!
   - `'sameColor'`: Yalnızca aynı renkteki ikililer (`♥-♦` kırmızı-kırmızı ve `♠-♣` siyah-siyah) eşleşir.
2. **Gizli 3 Papaz Varyantı (`removedKings: 'random3'`):**
   - Eğer 3 Papaz rastgele çıkarılmışsa kimse hangi kartın tek olduğunu bilmez; blöf ve heyecan artar.
3. **Çekildiği Anda Eli Biten Oyuncu:**
   - Oyuncu A'nın elinde son 1 kart (`8♠`) var ve Oyuncu B'nin elinde `[8♥, K♠]` var. Oyuncu B, Oyuncu A'nın son kartı olan `8♠`'yi çektiğinde:
     - Oyuncu A'nın eli `0` olduğu için **Oyuncu A kurtulur**.
     - Oyuncu B, çektiği `8♠` ile elindeki `8♥`'yi çift yapıp atar; Oyuncu B'nin elinde tek başına `K♠` kalır ve başka aktif oyuncu kalmadığı için **Papaz Oyuncu B'de kalır**!
4. **Dağıtımda Tüm Kartları Çift Olup 0 Kartla Başlayan Oyuncu:**
   - İlk çift ayıklama (`initialDiscard`) sonunda bir oyuncunun elindeki 12 kartın tamamı 6 çift oluşturursa, o oyuncu daha ilk turdan **kurtulur** ve çekme döngüsüne hiç girmez.

### 4. Puanlama Tablosu, Cezalar, Bitiş Koşulu ve Beraberlik Bozma

| Durum | El Sonu Puanı (`scoreRound`) | Açıklama |
| :--- | :--- | :--- |
| **Kurtulan Oyuncular** | **`0` ceza puanı** (veya kurtulma sırasına göre `+3, +2, +1` ödül puanı) | Elindeki tüm kartları çiftleyip bitirenler |
| **Elinde Papaz Kalan Son Oyuncu** | **`+1` Papaz Cezası** (veya `-10` puan) | Kaybeden oyuncu |

- **Maç Bitiş Koşulu:** `targetRounds` (örn. 3 veya 5 el) sonunda en az kez Papazda kalan oyuncu 1. olur, en çok Papazda kalan kaybeder.

### 5. Yaygın Ev Kuralları ve Varyantlar (Ayarlar)

| Ayar Adı | Varsayılan | Olası Değerler | Ne Değiştirir? |
| :--- | :--- | :--- | :--- |
| `seats` | `4` | `2`, `3`, `4` | Oyuncu sayısı. |
| `removedKings` | `'keepSpadeKing'` | `'keepSpadeKing'`, `'random3'` | Her zaman Maça Papazı mı kalsın, yoksa rastgele 1 Papaz mı kalsın. |
| `pairColorMatch` | `'any'` | `'any'`, `'sameColor'` | Herhangi iki aynı sayı mı yoksa aynı renk (kırmızı/siyah) mi çift olsun. |
| `shuffleHandOnPick` | `true` | `true`, `false` | Kart çekilen oyuncunun eli her tur otomatik karıştırılsın mı. |

### 6. Süre / Zaman Aşımı ve Oyuncu Ayrılınca Ne Olur
- **Süre:** Hamle başına **15 sn**.
- **Zaman Aşımı (`quickMove`):** İlk aşamadaysa çiftlerini otomatik atar; çekme aşamasındaysa hedef oyuncunun elinden `0`. indeksteki kartı çeker.
- **Oyuncu Ayrılması:** Bot devralır.

### 7. Gizli Bilgi (`viewFor`)
- **Gönderilenler:** Oyuncunun kendi `hand` kartları, diğer oyuncuların **yalnızca elindeki kart sayısı (`handCount`)**, masaya atılan açık çiftler, sıradaki oyuncunun hangi koltuktan kart çekeceği (`targetSeat`).
- **Gizlenenler (Çok Kritik):** Hedef oyuncunun elindeki kartların kimlikleri! Sunucu `viewFor` içinde hedef oyuncunun elini asla göndermez; sadece `targetHandCount: number` gönderir ve istemci `0 .. targetHandCount - 1` arasında bir indeks (`cardIndex`) seçer!

### 8. Bot Stratejisi İpuçları (Acemi / Usta)
- **Acemi (`easy`):** Her zaman ilk veya rastgele indeksi çeker.
- **Usta (`hard`):** `shuffleHandOnPick: false` ise Papaz'ı çeken rakibin onu elinin neresine koyduğunu izler; `shuffleHandOnPick: true` ise tamamen tekdüze rastgele (`rng`) indeks seçer ve kendi elindeki çiftleri anında indirir.

### 9. Test Senaryoları Listesi (25 Somut Test Durumu)
1. **[PKC-T01] 49 Kartlık Deste Doğrulaması:** `create` → Destede toplam 49 kart var; `A..Q` arası 12 değerden 4'er adet (48 kart) ve sadece 1 adet `K` (`K♠`) var.
2. **[PKC-T02] 4 Kişilik Dağıtım:** Koltuklarda `[13, 12, 12, 12]` kart, toplam 49 kart.
3. **[PKC-T03] 3 Kişilik Dağıtım:** `seats: 3` → Koltuklarda `[17, 16, 16]` kart, toplam 49 kart.
4. **[PKC-T04] 2 Kişilik Dağıtım:** `seats: 2` → Koltuklarda `[25, 24]` kart, toplam 49 kart.
5. **[PKC-T05] İlk Çiftleri Ayıklama (İkili):** Elde `[7♠, 7♦, 9♣]` varken `discardPairs` → `7♠-7♦` yere açılır, elde sadece `[9♣]` kalır.
6. **[PKC-T06] Üçlü Karttan Yalnızca İkisinin Atılması:** Elde `[5♠, 5♥, 5♦, 9♣]` varken `discardPairs` → İki `5`'li çift olarak atılır, üçüncü `5`'li ve `9♣` elde kalır (`hand.length === 2`).
7. **[PKC-T07] Dörtlü Kartın İki Çift Olarak Tamamen Atılması:** Elde `[5♠, 5♥, 5♦, 5♣, 9♣]` varken `discardPairs` → Dört `5`'li de (2 çift) yere atılır, elde tek `[9♣]` kalır.
8. **[PKC-T08] İlk Ayıklamada 0 Kart Kalan Oyuncunun Kurtulması:** Koltuk 1'in 12 kartı tam 6 çift oluşturdu → `initialDiscard` sonrası Koltuk 1'in eli `0` olur ve aktif çekme döngüsünden çıkar.
9. **[PKC-T09] Geçersiz `cardIndex` Reddi:** Hedef oyuncunun elinde `4` kart varken `cardIndex: 4` veya `-1` gönderilir → `{ ok: false, error: 'Geçersiz kart seçimi' }`.
10. **[PKC-T10] Çekilen Kartın Eldeki Kartla Eşleşmesi:** Koltuk 0'ın elinde `[10♠, K♠]` var, hedeften `10♥` çeker → `10♠-10♥` otomatik olarak yere çift açılır, Koltuk 0'ın elinde yalnız `[K♠]` kalır.
11. **[PKC-T11] Çekilen Kartın Eşleşmemesi (`K♠` Çekilmesi):** Koltuk 0'ın elinde `[10♠]` var, hedeften `K♠` çeker → Eşleşmez, Koltuk 0'ın eli `[10♠, K♠]` (`2` kart) olur.
12. **[PKC-T12] Kurtulmuş Oyuncunun Atlanması:** Koltuk 1'in eli `0` (kurtuldu). Sıra Koltuk 2'ye geldiğinde Koltuk 2 kartı Koltuk 1'den değil, bir önceki aktif oyuncu olan **Koltuk 0'dan** çeker!
13. **[PKC-T13] Son Kartı Çekilen Oyuncunun Kurtulması:** Koltuk 0'ın elinde tek `4♠` var. Koltuk 1 bu kartı çektiği anda Koltuk 0'ın eli `0` olur ve Koltuk 0 kurtulur.
14. **[PKC-T14] Son İki Oyuncu Arasında Papazın Kalması ve Oyun Bitişi:** Sadece Koltuk 0 (`[8♠]`) ve Koltuk 2 (`[8♥, K♠]`) kaldı. Koltuk 0, Koltuk 2'den `8♥`'yi çeker → `8♠-8♥` çift olup atılır, Koltuk 0 kurtulur (`0` kart), Koltuk 2'de tek `[K♠]` kalır → `phase === 'finished'`, `loser === 2`.
15. **[PKC-T15] Son İki Oyuncuda Papazın Çekilmesi:** Koltuk 0 (`[8♠]`) ve Koltuk 2 (`[8♥, K♠]`) kaldı. Koltuk 0, Koltuk 2'den `K♠`'yi çeker → Koltuk 0'ın eli `[8♠, K♠]` olur, sıra Koltuk 2'ye geçer. Koltuk 2 (`[8♥]`), Koltuk 0'dan `8♠`'yi çekerse Koltuk 2 kurtulur ve `loser === 0` olur!
16. **[PKC-T16] Aynı Renk Eşleşme Kuralı (`pairColorMatch: 'sameColor'`):** Elde `[7♠, 7♥]` varken `pairColorMatch: 'sameColor'` ise eşleşmez (biri siyah biri kırmızı); `7♠` yalnızca `7♣` ile, `7♥` yalnızca `7♦` ile eşleşir.
17. **[PKC-T17] Gizli 3 Papaz Modu (`removedKings: 'random3'`):** Destede 4 Papazdan rastgele 1'i kalır; `Pair` eşleşmesi Papazlar için kapalıdır (zaten tek 1 Papaz vardır).
18. **[PKC-T18] Sırası Olmayan Oyuncunun Çekme Reddi:** `turn === 1` iken Koltuk 2 `drawFromPlayer` gönderir → `{ ok: false }`.
19. **[PKC-T19] Çift Ayıklama Bitmeden Kart Çekme Reddi:** `phase === 'initialDiscard'` iken `drawFromPlayer` gönderilir → `{ ok: false }`.
20. **[PKC-T20] El Karıştırma (`shuffleHandOnPick: true`):** Kart çekildikten sonra oyuncunun elindeki kartların indeks sırası `rng` ile deterministik karıştırılır.
21. **[PKC-T21] Puanlama (`scoreRound`):** Kaybeden koltuk `1`, diğer koltuklar `0` alır (`[0, 0, 1, 0]`).
22. **[PKC-T22] Çok Elli Maç Bitişi (`targetRounds: 3`):** 3 el sonunda `matchOver === true`.
23. **[PKC-T23] Zaman Aşımında (`quickMove`) Geçerli Hamle:** Süre dolduğunda `cardIndex: 0` ile hedef oyuncudan otomatik kart çekilir.
24. **[PKC-T24] Tek Hamlede Tüm Kartların Bitmesi Garantisi:** 100 rastgele seed ile oynatılan oyunların tamamı sonsuz döngüye girmeden (en fazla 48 çekişte) biter ve her zaman tam 1 oyuncunun elinde `K` kalır.
25. **[PKC-T25] Gizli Bilgi (`viewFor`) Sızıntı Testi:** `viewFor(state, 0)` içinde hedef oyuncunun elindeki hangi indekste `K♠` olduğu **kesinlikle görünmez**.

### 10. 60+ Kullanıcı İçin Arayüzde Gösterilmesi Gereken Yardımcı Bilgiler
- **Yelpaze Şeklinde Büyük Çekme Ekranı:** Sıra oyuncuya geldiğinde, kart çekeceği rakibin kapalı kartları ekranın ortasında **dev yelpaze kartlar** olarak açılmalı; ilk dokunuşta seçilen kart yukarı kalkmalı (`"Bu kartı çekmek için tekrar dokun"`), ikinci dokunuşta çekilmeli.
- **Otomatik Çift Eşleştirme:** 60+ kullanıcının elindeki çiftleri tek tek bulup sürüklemesine gerek kalmadan `"Çiftleri Masaya Aç"` tek dokunuş düğmesi olmalı.

---

## OYUN 9: TAVLA (Klasik / Erkek Tavlası, Gülbara / Kız Tavlası, Tapa / Hapis Tavlası)

### 1. Malzeme ve Kurulum
- **Malzeme:** 24 hane (`points[0..23]`), 2 oyuncu (`seat 0` Beyaz, `seat 1` Siyah), her oyuncuda **15 pul**, 2 adet 6 yüzlü zar (`dice: [number, number]`), orta bölme (`bar: [number, number]`) ve toplanan pullar (`borneOff: [number, number]`).
- **Hane İndeksleme ve Yön Sözleşmesi:**
  - Haneler `1`'den `24`'e kadar numaralandırılır.
  - **Varyant 1 — Klasik Tavla (`variant: 'klasik'`, Erkek Tavlası):**
    - Karşılıklı zıt yönlü hareket:
      - **Beyaz (`seat 0`):** `24 → 1` yönünde ilerler (İç sahası / Kalesi: `1..6`). Başlangıç dizilişi: **`24`'te 2 pul, `13`'te 5 pul, `8`'de 3 pul, `6`'da 5 pul**.
      - **Siyah (`seat 1`):** `1 → 24` yönünde ilerler (İç sahası / Kalesi: `19..24`). Başlangıç dizilişi: **`1`'de 2 pul, `12`'de 5 pul, `17`'de 3 pul, `19`'da 5 pul**.
  - **Varyant 2 — Gülbara (`variant: 'gulbara'`, Kız Tavlası / Tek Yönlü):**
    - İki oyuncu da tahtanın etrafında **aynı yönde (saat yönünün tersine)** yarışır ve kendi kalesine toplar:
      - **Beyaz (`seat 0`):** Tüm **15 pulu `24` numaralı hanede** başlar, `24 → 1` yönünde ilerler, `1..6` hanelerinden toplar.
      - **Siyah (`seat 1`):** Tüm **15 pulu `12` numaralı hanede** (Beyaz'ın tam karşısındaki diyagonal köşe) başlar, `12 → 1 → 24 → 13` yönünde (kendi göreli `24 → 1` parkurunda) ilerler ve `13..18` hanelerinden toplar.
  - **Varyant 3 — Tapa (`variant: 'tapa'`, Hapis Tavlası / Plakoto):**
    - Karşılıklı zıt yönlü hareket:
      - **Beyaz (`seat 0`):** Tüm **15 pulu `24` numaralı hanede** başlar (`24 → 1` yönünde ilerler, `1..6` iç sahasıdır). En gerideki `24` numaralı hanedeki son pul **"Ana Taş (Mother Checker)"**'dır.
      - **Siyah (`seat 1`):** Tüm **15 pulu `1` numaralı hanede** başlar (`1 → 24` yönünde ilerler, `19..24` iç sahasıdır). En gerideki `1` numaralı hanedeki son pul **"Ana Taş"**'tır.
- **Başlangıç:** İlk elde sunucu seed'li RNG ile açılış zarı atar (çift gelmez); büyük atan başlar. Sonraki ellerde bir önceki eli kazanan oyuncu (veya sırayla) başlar.

### 2. Tur Akışı Adım Adım
1. **Zar Atma (`roll`):** Sırası gelen oyuncunun zarları sunucuda deterministik RNG ile üretilir (`[d1, d2]`).
   - Normal zarda (`d1 !== d2`): Oyuncunun `remainingMoves = [d1, d2]` (2 hamle hakkı) vardır.
   - Çift zarda (`d1 === d2`): Oyuncunun `remainingMoves = [d1, d1, d1, d1]` (**4 hamle hakkı**) vardır.
2. **Hamle Üretimi ve Oynama (`move` / `undo` / `confirm`):**
   - Sunucu/motor o zar için **tüm yasal tam hamle dizilerini (`legalTurnSequences`)** hesaplar.
   - Eğer yasal hiçbir hamle yoksa (`legalTurnSequences.length === 0`), sıra otomatik (veya bildirim sonrası) rakibe geçer.
   - Oyuncu pullarını adım adım oynar (`{ type: 'step', from, to }`), zar bitene veya onaylayana kadar `"Geri Al"` (`{ type: 'undo' }`) yapabilir, son zarı oynadığında tur tamamlanır (`{ type: 'commitTurn', steps }`).

### 3. Geçerli / Geçersiz Hamle Kuralları ve Tüm Kenar Durumlar
1. **Zorunlu Maksimum Zar ve Zorunlu Büyük Zar Kuralı (WBF / Resmi Tavla Kuralı):**
   - Oyuncu atılan iki zarı da (`d1` ve `d2`) oynayabiliyorsa **ikisini de oynamak zorundadır!** Örneğin bir pulu `d1` oynadığında `d2` bloke oluyor, ama başka bir pulu önce `d2` sonra `d1` oynadığında iki zar da oynanabiliyorsa, **tek zarda kalan hamle geçersizdir**!
   - Eğer iki zardan yalnızca **biri** oynanabiliyorsa (ikisinin birden oynandığı hiçbir dizi yoksa) ve hem `d1` tek başına hem de `d2` tek başına oynanabiliyorsa, oyuncu **büyük olan zarı (`Math.max(d1, d2)`) oynamak zorundadır**! (Yalnızca küçük zar oynanabiliyorsa küçük zar oynanır).
2. **Klasik Tavla Özel Kuralları:**
   - **Kapı ve Kırma:** Rakibin 2 veya daha fazla pulu olan haneye basılamaz (`kapı`). Rakibin tek pulu (`açık`) olan haneye basıldığında rakip pul **kırılır** ve `bar`'a çıkar.
   - **Kırık Pul Önceliği:** Oyuncunun `bar` üzerinde 1 veya daha fazla kırık pulu varsa, kırık pulların **tamamı** rakibin iç sahasından (`25 - zar` veya `zar`) oyuna girmeden tahtadaki diğer hiçbir pulla hamle yapılamaz!
   - **Pul Toplama (`Bearing Off`):**
     - Oyuncu yalnızca **15 pulunun tamamı kendi iç sahasında (`1..6`)** iken pul toplayabilir. Toplama sırasında bir pul kırılırsa, o pul tekrar iç sahaya dönene kadar toplama durur!
     - Atılan zar (`d`) tam olarak üzerinde pul bulunan `d` hanesine denk geliyorsa o haneden pul toplanır (veya iç saha içinde ilerletilir).
     - Eğer `d` hanesinde pul **yoksa**:
       - `d` hanesinden **daha geride (daha yüksek numaralı, örn. `d=4` iken `5` veya `6`'da) pul varsa**, oyuncu o gerideki pullardan birini `d` kadar ilerletmek **zorundadır** (`3` numaralı haneden pul toplayamaz!).
       - `d` hanesinden **daha geride hiç pul kalmamışsa** (örn. `d=5` geldi ve `5` ile `6` boş, en gerideki pul `3`'te), oyuncu **en gerideki dolu haneden (`3`)** pul toplayabilir!
3. **Gülbara Özel Kuralları:**
   - **Kırma Yoktur, Tek Pul Kapıdır:** Bir hanede oyuncunun **1 tek pulu bile olsa** rakip o haneye basamaz!
   - **Gülbara Çift Zar Zinciri (`gulbaraDoublesChain`):**
     - `'none'`: Çift zar sadece 4 kez oynanır.
     - `'allUp'` (Geleneksel Kahvehane Gülbarası): Oyuncu çift zar attığında (örn. `2-2`), önce `2-2`'yi 4 kez oynar, ardından sırasıyla **`3-3`, `4-4`, `5-5` ve `6-6`** zarlarını da 4'er kez oynama hakkı kazanır! Eğer zincir sırasında herhangi bir adımı tam (4 kez) oynayamazsa, **kalan adımları rakibi kendi pullarıyla oynar**!
     - `'fromFirst'`: İlk çiftte zincir çalışmaz veya sadece zarla gelen çiftin bir üstü oynanır.
4. **Tapa (Hapis Tavlası) Özel Kuralları:**
   - **Kırma Yoktur, Esir Alma (Pinning) Vardır:** Rakibin tek başına duran açık pulunun üzerine kendi pulunuzu koyduğunuzda rakip pul tahtadan çıkmaz, **altta esir (hapis) kalır**!
   - Üstünde rakip pul bulunan esir bir pul, üstteki tüm rakip pullar o haneden ayrılana kadar **hareket edemez**.
   - Bir hanede 1 esir + üstünde kendi 1 pulunuz (veya kendi 2 pulunuz) varsa, o hane sizin kapınızdır; rakip oraya basamaz, siz üzerine istediğiniz kadar pul ekleyebilirsiniz.
   - **Ana Taş (Mother Checker) Kuralı:** Başlangıç hanesindeki (`24` veya `1`) en son (15.) pulunuz, henüz rakibin iç sahasına ulaşmadan rakip tarafından esir alınırsa:
     - Rakibin kendi başlangıç hanesinde hâlâ pulu varsa oyun devam eder (ancak ikisinin de ana taşı esir alınırsa oyun **berabere / 0 puan** biter).
     - Rakip kendi ana taşını başlangıç hanesinden çıkarmışken sizin ana taşınızı esir alırsa, oyunu **anında (2 puan marsla)** kaybedersiniz!
   - **Tapa'da Toplama:** Kendi iç sahanızda rakip tarafından esir tutulmuş bir pulunuz varsa, o pul özgür kalana kadar 15 pulunuzu bitiremezsiniz.

### 4. Puanlama Tablosu, Cezalar, Bitiş Koşulu ve Beraberlik Bozma

| Bitiş Durumu | Koşul | Kazanılan Puan |
| :--- | :--- | :--- |
| **Normal Oyun (Tek)** | Kazanan 15 pulunu topladığında rakip en az 1 pul toplamışsa | **`1` puan** |
| **Mars (Gammon)** | Kazanan 15 pulunu topladığında rakip **henüz hiç pul toplamamışsa (`borneOff === 0`)** ve rakibin kazananın iç sahasında/barda pulu yoksa | **`2` puan** |
| **Konçina / Çifte Mars (Backgammon)** | Rakip hiç pul toplamamış (`borneOff === 0`) **VE** rakibin hâlâ kazananın iç sahasında (`1..6`) veya `bar`'da (Tapa'da esir altında) en az 1 pulu varsa (`koncinaPoints === 3` ise) | **`3` puan** (`koncinaPoints === 2` ise `2` puan) |

- **Bitiş Koşulu:** `targetScore` (varsayılan `5` veya `3` sayı) puana ilk ulaşan oyuncu maçı kazanır.

### 5. Yaygın Ev Kuralları ve Varyantlar (Ayarlar)

| Ayar Adı | Varsayılan | Olası Değerler | Ne Değiştirir? |
| :--- | :--- | :--- | :--- |
| `variant` | `'klasik'` | `'klasik'`, `'gulbara'`, `'tapa'` | Klasik, Gülbara veya Tapa tavla kuralları. |
| `targetScore` | `5` | `1`, `3`, `5`, `7` | Maç bitiş puanı. |
| `koncinaPoints` | `3` | `2`, `3` | Çifte marsın (Konçina) 3 puan mı yoksa 2 puan mı sayılacağı. |
| `gulbaraDoublesChain` | `'none'` | `'none'`, `'allUp'`, `'fromFirst'` | Gülbara'da çift zar zincirinin uygulanıp uygulanmayacağı. |

### 6. Süre / Zaman Aşımı ve Oyuncu Ayrılınca Ne Olur
- **Süre:** Tur başına **30 sn** (ilk tur **45 sn**).
- **Zaman Aşımı (`quickMove`):** Eğer oyuncu tur içinde kısmi hamleler yapmışsa ve bu kısmi hamleler geçerli bir tam dizinin parçasıysa kalan zarları tamamlar; yoksa `botMove(state, seat, 'medium', rng)` ile en iyi yasal tam diziyi oynar.
- **Oyuncu Ayrılması:** Bot devralır.

### 7. Gizli Bilgi (`viewFor`)
- **Tam Bilgi Oyunu:** Tahtadaki tüm pullar, bar, toplanan pullar ve o anki zarlar herkese açıktır.
- **Gizlenenler (Çok Kritik):** Gelecek zarları üretecek olan **`seed` ve RNG durumu** asla istemciye gönderilmez! Zarlar yalnızca sunucuda atılır.

### 8. Bot Stratejisi İpuçları (Acemi / Usta)
- **Acemi (`easy`):** Yasal hamle dizileri (`legalTurnSequences`) içinden rastgele veya sadece en çok ilerleyen diziyi seçer.
- **Usta (`hard`):**
  - Tüm benzersiz bitiş tahta durumlarını (`legalTurnSequences`) üretir (50 ms altında).
  - **Pozisyon Değerlendirme Fonksiyonu (`evaluateBoard`):**
    1. **Pip (Yarış) Farkı:** Kalan toplam mesafe farkı.
    2. **Kapı ve Blok (Prime) Ödülü:** Özellikle `4, 5, 6, 7, 8` hanelerindeki kapılar ve ardışık kapı zincirleri (3/4/5/6'lı duvar).
    3. **Açık Pul (Blot) Cezası:** Rakibin vurma olasılığına (`1..6` ve `7..12` zar kombinasyon sayısına) ve ev uzaklığına göre ağırlıklandırılmış ceza.
    4. **Kırık Rakip Ödülü:** Rakibin barda pulu varken kendi iç sahasında kapı sayısı.
  - En yüksek skoru veren (veya 1 zar derinliğinde 21 zar olasılığı üzerinden beklenen değeri en yüksek olan) diziyi seçer.

### 9. Test Senaryoları Listesi (25 Somut Test Durumu)
1. **[TAV-T01] Klasik Başlangıç Dizilişi:** `create({ variant: 'klasik' })` → Beyaz `24:2, 13:5, 8:3, 6:5` (toplam 15 pul, 167 pip); Siyah `1:2, 12:5, 17:3, 19:5` (15 pul, 167 pip).
2. **[TAV-T02] Gülbara Başlangıç Dizilişi:** `variant: 'gulbara'` → Beyaz `24:15`, Siyah `12:15`.
3. **[TAV-T03] Tapa Başlangıç Dizilişi:** `variant: 'tapa'` → Beyaz `24:15`, Siyah `1:15`.
4. **[TAV-T04] Kapıya Basma Yasağı (Klasik):** `20` numaralı hanede Siyah'ın 2 pulu varken Beyaz `24`'ten `4` zarıyla `20`'ye oynamak ister → `{ ok: false, error: 'Rakip kapısına basılamaz' }`.
5. **[TAV-T05] Açık Pul Kırma:** `20` numaralı hanede Siyah'ın 1 pulu varken Beyaz `24`'ten `4` ile `20`'ye oynar → Siyah pul kırılır (`bar[1] === 1`), `20`'de Beyaz'ın 1 pulu olur.
6. **[TAV-T06] Kırık Pul Varken Başka Pulla Oynama Yasağı:** Beyaz'ın `bar[0] === 1` iken `13`'teki pulunu oynamak ister → `{ ok: false, error: 'Önce kırık pulunuzu oyuna sokmalısınız' }`.
7. **[TAV-T07] Kırık Pulun Kapalı Evde Gelemediği Durum (Gelemez):** Beyaz'ın barda 1 pulu var, Siyah'ın iç sahasında `19..24` hanelerinin tamamı kapı (2+ pul). Zar `[3, 5]` → `legalTurnSequences === []`, tur otomatik Siyah'a geçer.
8. **[TAV-T08] İki Kırık Puldan Sadece Birinin Girebilmesi:** Beyaz'ın barda 2 pulu var, zar `[2, 5]`. `23` açık ama `20` kapalı → Beyaz `2` zarıyla 1 pulunu `23`'e sokar, ikinci pul barda olduğu için `5` zarını `23`'teki puluyla **oynayamaz**, tur biter.
9. **[TAV-T09] Zorunlu İki Zar Oynama Kuralı:** Zar `[2, 3]`. Pul A `2` oynarsa `3` bloke oluyor, ancak Pul B `3` ve Pul A `2` oynarsa iki zar da oynanabiliyor → Sadece Pul A'yı `2` oynayıp turu bitirmek **geçersizdir**!
10. **[TAV-T10] Zorunlu Büyük Zar Kuralı:** Zar `[2, 5]`. İki zarın birden oynanabildiği hiçbir dizi yok; tek başına `2` de oynanabiliyor, tek başına `5` de oynanabiliyor → `2` oynamak **geçersizdir**, oyuncu büyük zar olan `5`'i oynamak zorundadır!
11. **[TAV-T11] Çift Zarda 4 Hamle:** Zar `[4, 4]` → Toplam 4 adet `4` birimlik hamle yapılır (4 ayrı pul, 2 pul ikişer kez veya 1 pul 4 kez).
12. **[TAV-T12] Çift Zarda Ara Hanenin Kapalı Olması:** Beyaz `24`'teki tek pulunu `[4, 4]` ile `16`'ya taşımak ister ancak `20` numaralı hane Siyah kapısıdır → Ara hane (`20`) kapalı olduğu için `24 → 16` atlayamaz (`{ ok: false }`).
13. **[TAV-T13] Dışarıda Pul Varken Toplama Yasağı:** Beyaz'ın 14 pulu `1..6` içinde ama 1 pulu `7` numaralı hanedeyken pul toplamak (`bearOff`) ister → `{ ok: false }`.
14. **[TAV-T14] Toplamada Geride Pul Varken Büyük Zarla Küçük Haneden Toplama Yasağı:** Beyaz'ın tüm pulları içerde: `6` hanesinde 1 pul, `3` hanesinde 2 pul, `4` ve `5` boş. Zar `[4, 2]`. Beyaz `4` zarıyla `3` hanesinden pul toplamak ister → Geride (`6`'da) pul olduğu için `3`'ten toplayamaz; `4` zarını `6 → 2` olarak oynamak **zorundadır**!
15. **[TAV-T15] Toplamada Geride Pul Yokken Büyük Zarla Toplama:** Beyaz'ın `5` ve `6` haneleri boş, en gerideki pulu `4` hanesinde. Zar `[6, 5]` → Geride pul olmadığı için `6` zarıyla `4`'teki pulu, `5` zarıyla kalan en gerideki pulu toplayabilir (`{ ok: true }`).
16. **[TAV-T16] Toplama Sırasında Kırılan Pulun Toplamayı Durdurması:** Beyaz 10 pul toplamış, kalan 5 pulu içerideyken 1 pulu kırılır (`bar[0] === 1`) → Kırık pul `24`'ten girip tekrar `1..6`'ya ulaşana kadar Beyaz pul toplayamaz.
17. **[TAV-T17] Normal Bitiş (1 Puan):** Beyaz 15 pulunu topladığında Siyah `1` pul toplamışsa → `scoreRound: [1, 0]`.
18. **[TAV-T18] Mars Bitişi (2 Puan):** Beyaz 15 pulunu topladığında Siyah `0` pul toplamış ve Siyah'ın tüm pulları `7..24` arasındaysa → `scoreRound: [2, 0]`.
19. **[TAV-T19] Konçina / Çifte Mars Bitişi (3 Puan):** `koncinaPoints: 3`. Beyaz 15 pulunu topladığında Siyah `0` pul toplamış VE Siyah'ın `bar`'da (veya `1..6` hanelerinde) 1 pulu varsa → `scoreRound: [3, 0]`.
20. **[TAV-T20] Gülbara'da Tek Pulun Kapı Olması:** `variant: 'gulbara'`. Bir hanede Siyah'ın yalnız **1** pulu varken Beyaz o haneye basmak ister → `{ ok: false }` (Gülbara'da kırma yoktur, tek pul kapıdır).
21. **[TAV-T21] Gülbara'da Çift Zar Zinciri (`gulbaraDoublesChain: 'allUp'`):** Beyaz `[3, 3]` atar → Sırasıyla `3-3, 4-4, 5-5, 6-6` zarlarını oynar; `5-5`'in 2 tanesinde tıkanırsa kalan iki `5`'i ve dört `6`'yı Siyah kendi pullarıyla oynar.
22. **[TAV-T22] Tapa'da Açık Pul Esir Alma (Pinning):** `variant: 'tapa'`. `10` numaralı hanede Siyah'ın 1 pulu varken Beyaz oraya 1 pul oynar → Siyah pul kırılmaz, `10` hanesinde Beyaz'ın altında esir kalır; Siyah o pulu hareket ettiremez ve `10` hanesine başka Siyah pul basamaz.
23. **[TAV-T23] Tapa'da Üstteki Pul Kalkınca Esirin Özgürleşmesi:** `10` hanesindeki Beyaz pul başka haneye oynandığında alttaki Siyah pul tekrar özgürleşir ve Siyah tarafından oynanabilir.
24. **[TAV-T24] Tapa'da Ana Taşın (Mother Checker) Esir Alınması:** Beyaz'ın `24` numaralı başlangıç hanesinde kalan son (15.) pulu, Siyah kendi `1` hanesini tamamen boşaltmışken Siyah tarafından esir alınır → Beyaz oyunu anında kaybeder.
25. **[TAV-T25] Geri Al (`undo`) Düğmesi:** Oyuncu `[3, 5]` zarının `3`'ünü oynadıktan sonra `undo` yapar → Tahta zarın atıldığı ilk duruma döner ve oyuncu önce `5`'i oynayabilir.

### 10. 60+ Kullanıcı İçin Arayüzde Gösterilmesi Gereken Yardımcı Bilgiler
- **Dokun-Parla-Oynat:** Pula dokunulduğunda gidebileceği hedef üçgenler (haneler) altın sarısı/yeşil parlamalı ve üzerinde hangi zarla (`"3"`, `"5"` veya `"8 (3+5)"`) oraya gidildiği yazmalı; hedef üçgene dokunulduğunda pul oraya gitmeli (zorunlu sürükleme olmamalı).
- **Büyük "Geri Al" ve "Onayla" Düğmeleri:** Son zar oynanmadan yanlış dokunuşları tek tuşla geri alan büyük `"↩ Geri Al"` düğmesi.
- **Kalan Mesafe (Pip) ve Pul Sayacı:** Her iki oyuncu için `"Kalan: 15 pul · 142 adım"` göstergesi.

---

## OYUN 10: TÜRK DAMASI (TÜDAF Resmi Kuralları)

### 1. Malzeme ve Kurulum
- **Malzeme:** $8 \times 8 = 64$ karelik dama tahtası (`satır 0..7`, `sütun 0..7`). Satrançtan ve Çapraz Dama'dan farklı olarak **tüm 64 kare (hem açık hem koyu kareler)** kullanılır!
- **Taşlar ve Başlangıç Dizilişi:**
  - **Beyaz (`seat 0`):** **16 adet yoz taş**, kendi tarafındaki **2. ve 3. yatay sıralara** (`satır 1` ve `satır 2`, tüm 8 sütuna) dizilir. En arka sıra (`satır 0`) ve orta iki sıra (`satır 3, 4`) boştur!
  - **Siyah (`seat 1`):** **16 adet yoz taş**, kendi tarafındaki **6. ve 7. yatay sıralara** (`satır 5` ve `satır 6`, tüm 8 sütuna) dizilir. En arka sıra (`satır 7`) boştur!
- **Başlangıç:** Oyuna **Beyaz (`seat 0`)** başlar.

### 2. Tur Akışı Adım Adım
1. Sırası gelen oyuncu (`turn`):
   - Önce tahtada **taş alma (`capture`)** hamlesi olup olmadığı kontrol edilir.
   - Eğer taş alma hamlesi **varsa**: Oyuncu taş almak (ve birden fazla alma yolu varsa **en çok taş alan yolu — `mandatoryMaxCapture`** oynamak) **zorundadır**!
   - Eğer taş alma hamlesi **yoksa**: Oyuncu elindeki taşlardan birini 1 kare (Dama ise boş kareler boyunca istediği kadar) ilerletir (`{ type: 'move', path: Square[] }`).
2. **Çoklu Taş Alma Sırasında Taşların Kaldırılması (Resmi Türk Daması Kuralı):**
   - Türk Daması'nda (Çapraz Dama'nın aksine!) çoklu taş alma zinciri sırasında üzerinden atlanan her rakip taş **atlandığı anda hemen tahtadan kaldırılır**! Dolayısıyla aynı hamle içinde boşalan kare üzerinden geçilebilir, ancak 180 derece tam geri dönüş yapılamaz.
3. **Dama Çıkma:**
   - Yoz taş, rakibin en arka yatay sırasına (Beyaz için `satır 7`, Siyah için `satır 0`) ulaştığında ve hamlesi o karede bittiğinde **Dama (`king`)** olur.

### 3. Geçerli / Geçersiz Hamle Kuralları ve Tüm Kenar Durumlar
1. **Yoz Taş Hareketi ve Alma:**
   - **Çapraz hareket kesinlikle YOKTUR!**
   - Yoz taş yalnızca **ileri, sağa veya sola** (3 yöne) bitişik boş kareye **1 kare** gidebilir; **geriye doğru hareket edemez ve geriye doğru taş alamaz!**
   - Bitişik karede (ileri, sağ veya sol) rakip taş varsa ve onun hemen arkasındaki kare boşsa, üzerinden atlayarak rakip taşı alır; indiği karede tekrar ileri, sağa veya sola alma imkânı varsa durmadan almaya devam etmek zorundadır.
2. **Dama Taşı Hareketi ve Alma:**
   - Dama taşı **ileri, geri, sağa ve sola** (4 yöne) önünde engel olmadığı sürece istediği kadar boş kare gidebilir (satrançtaki Kale gibi).
   - Kendi yönünde (arada boş kareler olsa bile) tek başına duran bir rakip taşın üzerinden atlayıp, o taşın arkasındaki boş karelerden istediği birine inerek taşı alır.
   - **Dama Çoklu Alma Yön Kısıtı:** Dama bir taşı aldıktan sonra devamında başka taş alabilecek bir kareye inmek zorundadır. Ancak dama bir taşı aldıktan hemen sonra **180 derece ters yöne (geldiği yöne) dönemez**; ileri, sağa veya sola (90 derece dik açıyla veya aynı yönde) devam edebilir!
   - **Bitişik İki Rakip Taş (Duvar):** Aralarında boş kare olmadan arka arkaya bitişik duran 2 rakip taşın (`[Rakip][Rakip]`) üzerinden ne yoz taş ne de dama **atlayamaz**!
3. **Taş Alma Zinciri Sırasında Son Sıraya Değen Yoz Taş (En Kritik Kenar Durum — TÜDAF Resmi Kuralı):**
   - Bir yoz taş, taş alarak rakibin en son sırasına (`satır 7`) indiğinde:
     - Eğer indiği o son sıra karesinden **yoz taş kurallarıyla (sağa veya sola)** alabileceği bitişik bir taş daha varsa, **yoz taş olarak almaya devam etmek zorundadır**! Eğer bu devam hamlesiyle son sıradan çıkarsa (yoksa son sırada kalırsa) hamle bittiği kareye göre dama olup olmadığı belirlenir: hamlesi son sırada biterse Dama olur!
     - Eğer son sıraya indiğinde yoz taş olarak alabileceği taş **yoksa**, hamlesi orada **biter ve taş Dama olur**! Aynı hamle içinde anında Dama yeteneği kazanıp geriye doğru uzaktan taş almaya **devam edemez**! (Dama yeteneğini bir sonraki turunda kullanır).
4. **Zorunlu En Çok Taş Alma Kuralı (`mandatoryMaxCapture: true`):**
   - Oyuncunun A taşıyla 2 taş, B taşıyla 3 taş alma imkânı varsa (veya aynı taşla sağa gidince 1, ileri gidince 2 taş alabiliyorsa), **3 taş alan yolu oynamak zorundadır**!
   - Eşit sayıda taş alan iki farklı yol varsa (örn. biri Dama taşını alıyor, diğeri yoz taşı alıyor; ikisi de toplam 2 taş alıyor), Türk Daması'nda Dama taşını alma zorunluluğu **yoktur**, oyuncu eşit sayıda taş alan yollardan istediğini seçebilir!

### 4. Puanlama Tablosu, Cezalar, Bitiş Koşulu ve Beraberlik Bozma

| Oyun Sonucu | Koşul | Puan (`scoreRound`) |
| :--- | :--- | :--- |
| **Kazanma** | Rakibin tüm taşları alındığında (`0` taş) VEYA rakibin kalan taşları tamamen sıkıştırılıp **hiçbir yasal hamlesi kalmadığında (`açmaz / blok`)** | Kazanan **`1`** (veya `2`), Kaybeden **`0`** |
| **Beraberlik (Gayyım)** | (1) Her iki oyuncunun da tahtada **yalnızca 1'er taşı** kaldığında (biri Dama biri yoz taş olsa bile, eğer o hamlede hemen alma yoksa anında beraberlik!), VEYA (2) Taş alınmadan `maxMovesWithoutCapture` (40) hamle yapıldığında | İki oyuncuya da **`0.5`** (veya `1 - 1`) |

### 5. Yaygın Ev Kuralları ve Varyantlar (Ayarlar)

| Ayar Adı | Varsayılan | Olası Değerler | Ne Değiştirir? |
| :--- | :--- | :--- | :--- |
| `mandatoryMaxCapture` | `true` | `true`, `false` | `true` = En çok taş alan yolu seçmek zorunlu (TÜDAF); `false` = Herhangi bir taş alma yolu seçilebilir. |
| `singlePieceDrawRule` | `true` | `true`, `false` | 1'e 1 taş kaldığında otomatik beraberlik (Gayyım). |
| `maxMovesWithoutCapture` | `40` | `40`, `60` | Taş alınmadan yapılan hamle sonunda beraberlik sınırı. |

### 6. Süre / Zaman Aşımı ve Oyuncu Ayrılınca Ne Olur
- **Süre:** Hamle başına **30 sn** (ilk hamle **45 sn**).
- **Zaman Aşımı (`quickMove`):** Yasal hamleler içinden (`legalPaths`) ilkini / bot hamlesini oynar.
- **Oyuncu Ayrılması:** Bot devralır.

### 7. Gizli Bilgi (`viewFor`)
- **Tam Bilgi Oyunu:** Tahtadaki 64 kare ve tüm taşlar açıktır; gizli bilgi yoktur. `viewFor` kolaylık için o turdaki tüm yasal hamle yollarını (`legalPaths: Square[][]`) içerir.

### 8. Bot Stratejisi İpuçları (Acemi / Usta)
- **Acemi (`easy`):** 1 derinlikli arama; taş verebilecek kareye ilerleyebilir.
- **Usta (`hard`):**
  - Alfa-Beta budamalı Minimax (derinlik 6–8, zorunlu alma zincirlerinde Quiescence Search ile sonuna kadar açılım).
  - **Değerlendirme:** Yoz taş `100` puan, Dama `350` puan, arka sıra (`satır 1/6`) koruma bonusu, merkez kontrolü ve Türk Daması'na özgü **"feda kombosu" (1 veya 2 taş verip 4–5 taş toplama)** tespiti.

### 9. Test Senaryoları Listesi (25 Somut Test Durumu)
1. **[DAM-T01] Başlangıç Dizilişi:** `create` → Beyaz `satır 1, 2`'de 16 taş; Siyah `satır 5, 6`'da 16 taş; `satır 0, 3, 4, 7` tamamen boş.
2. **[DAM-T02] Yoz Taş İleri/Sağ/Sol Hareketi:** `satır 2, sütun 3`'teki Beyaz yoz taş ileri `(3,3)`, sağa `(2,4)` veya sola `(2,2)` (boşsa) 1 kare gidebilir (`{ ok: true }`).
3. **[DAM-T03] Yoz Taş Geriye Hareket Reddi:** Beyaz yoz taş `(2,3) → (1,3)` geriye gitmek ister → `{ ok: false }`.
4. **[DAM-T04] Çapraz Hareket Reddi:** Beyaz yoz taş `(2,3) → (3,4)` çapraz gitmek ister → `{ ok: false }`.
5. **[DAM-T05] Yoz Taşın Geriye Doğru Taş Alma Reddi:** Beyaz yoz taş `(3,3)`'te, Siyah taş `(2,3)`'te ve `(1,3)` boş → Yoz taş geriye doğru taş alamaz!
6. **[DAM-T06] Zorunlu Taş Alma Kuralı:** Tahtada Beyaz'ın taş alma hamlesi varken başka bir taşını normal ilerletmek ister → `{ ok: false, error: 'Taş almak zorunludur' }`.
7. **[DAM-T07] Zorunlu En Çok Taş Alma Kuralı (`mandatoryMaxCapture: true`):** Beyaz A taşıyla 1 Siyah taş, B taşıyla 3 Siyah taş alabiliyor → A taşıyla 1 taş alma hamlesi `{ ok: false, error: 'En çok taş alan hamleyi oynamalısınız (3 taş)' }` ile reddedilir.
8. **[DAM-T08] Eşit Sayıda Taş Alan İki Yoldan Serbest Seçim:** Hem sol yol hem sağ yol 2 taş alıyor (biri Dama, biri yoz taş içeriyor) → İkisi de `{ ok: true }` kabul edilir.
9. **[DAM-T09] Çoklu Almada Atlanan Taşın Anında Kalkması (Türk Daması İmza Kuralı):** Beyaz taş kare kare döngü yaparak 4 taş alırken, ilk aldığı taşın karesi anında boşaldığı için 4. atlayışta o boşalan kareye inebilir (`{ ok: true }`).
10. **[DAM-T10] Bitişik İki Rakip Taşın Üzerinden Atlayamama:** `(3,3)` ve `(4,3)`'te arka arkaya iki Siyah taş var; `(2,3)`'teki Beyaz taş (veya Dama) ikisinin üzerinden `(5,3)`'e atlayamaz (`{ ok: false }`).
11. **[DAM-T11] Son Sıraya Normal Ulaşan Taşın Dama Olması:** Beyaz yoz taş `(6,2) → (7,2)` oynar → Taş `isKing: true` (Dama) olur.
12. **[DAM-T12] Taş Alarak Son Sıraya İnen Yoz Taşın Anında Dama Gibi Devam Edememesi:** Beyaz yoz taş `(5,2)`'den `(6,2)`'deki Siyah taşı alıp `(7,2)`'ye iner. `(7,5)`'te uzakta bir Siyah taş vardır (arada 2 boş kare var, sadece Dama alabilir) → Yoz taş aynı hamle içinde Dama olup `(7,5)`'teki taşı **alamaz**, hamlesi `(7,2)`'de biter ve Dama olur!
13. **[DAM-T13] Taş Alarak Son Sıraya İnen Yoz Taşın Yoz Taş Gibi Devam Etmesi:** Beyaz yoz taş `(5,2)`'den `(6,2)`'yi alıp `(7,2)`'ye iner; hemen bitişiğinde `(7,3)`'te Siyah taş ve `(7,4)` boş vardır → Yoz taş gibi `(7,3)`'ü alıp `(7,4)`'e inmek **zorundadır** ve `(7,4)`'te hamlesi bitince Dama olur.
14. **[DAM-T14] Dama Taşının Uzaktan Hareket ve Alma Yeteneği:** `(7,2)`'deki Beyaz Dama, `(3,2)`'deki Siyah taşın üzerinden atlayıp `(2,2)`, `(1,2)` veya `(0,2)` boş karelerinden istediğine inebilir.
15. **[DAM-T15] Dama Çoklu Almada Zorunlu Devam Karesine İnme:** Beyaz Dama `(3,2)`'deki taşı aldıktan sonra `(2,2)`'ye inerse sağdaki `(2,5)` taşını da alabiliyor, ancak `(1,2)`'ye inerse başka taş alamıyor → En çok taş alma kuralı gereği `(1,2)`'ye inemez, `(2,2)`'ye inip `(2,5)`'i de almak **zorundadır**!
16. **[DAM-T16] Dama Taşının 180 Derece Geriye Dönememesi:** Kuzeye doğru taş alan bir Dama, hemen aynı sütunda Güneye doğru 180 derece ters yönde hareket edemez.
17. **[DAM-T17] Tüm Taşları Alarak Kazanma:** Siyah'ın son taşı alındığında `phase === 'finished'`, `winner === 0`.
18. **[DAM-T18] Rakibi Sıkıştırarak (Açmaz / Blok) Kazanma:** Siyah'ın 2 yoz taşı var ancak önleri ve yanları tamamen bloke olduğu için yasal hamlesi yok → `phase === 'finished'`, `winner === 0`.
19. **[DAM-T19] 1'e 1 Taş Kalınca Gayyım (Beraberlik):** Tahtada 1 Beyaz Dama ve 1 Siyah Dama (veya yoz taş, anlık alma yoksa) kaldığında → `phase === 'finished'`, `winner === null` (Berabere).
20. **[DAM-T20] 40 Hamle Taş Alınmadan Oynanınca Beraberlik:** `movesWithoutCapture === 40` olduğunda oyun berabere biter.
21. **[DAM-T21] Kendi Taşının Üzerinden Atlayamama:** Dama taşı kendi rengindeki bir taşın üzerinden atlayamaz.
22. **[DAM-T22] Çoklu Almada Yarıda Durma Yasağı:** 3 taşlık zorunlu zincirin sadece ilk 2 taşını alan bir `path` gönderilirse `{ ok: false, error: 'Alma hamlesini tamamlamalısınız' }` döner.
23. **[DAM-T23] Sırası Olmayan Oyuncunun Hamle Reddi:** `turn === 0` iken Siyah hamle gönderirse reddedilir.
24. **[DAM-T24] Usta Botun Feda Kombosunu Görmesi:** 1 taş verip 3 taş alma pozisyonunda Usta bot feda hamlesini seçer.
25. **[DAM-T25] `viewFor` İçinde `legalPaths` Doğruluğu:** `viewFor` içindeki `legalPaths` listesi en çok taş alan tüm yolları ve yalnız onları barındırır.

### 10. 60+ Kullanıcı İçin Arayüzde Gösterilmesi Gereken Yardımcı Bilgiler
- **Zorunlu Alma Vurgusu:** Taş alma zorunluluğu olan turda, yalnızca taş alabilen taş(lar) altın çerçeveyle parlamalı ve durum satırında **"Zorunlu Taş Alma! (3 Taş)"** yazmalı.
- **Adım Adım Yol Çizgisi:** Oyuncu taşa dokunduğunda gidebileceği kare(ler) ve çoklu almada izleyeceği ok yolu tahta üzerinde net çizgilerle gösterilmeli; son hedef kareye dokunduğunda tüm zincir animasyonla oynanmalı.

---

## OYUN 11: DOMİNO (Klasik Türk Usulü Cezalı & 5 ve Katları Puanlı / Aznif Varyantı)

### 1. Malzeme ve Kurulum
- **Malzeme:** Standart Çift-Altılı (**Double-Six**) Domino seti: `0-0` (Ayaz) ile `6-6` (Şeş-Şeş) arasındaki tüm $(a, b)$ ($0 \le a \le b \le 6$) kombinasyonlarından oluşan **28 adet taş**.
- **Oyuncu Sayısı:** 2 oyuncu (`0, 1`) veya 4 oyuncu (`0, 1, 2, 3`, tekli veya `0-2 / 1-3` eşli).
- **Dağıtım:**
  - Her oyuncuya **7'şer taş** dağıtılır:
    - **2 Kişilikte:** `2 × 7 = 14` taş dağıtılır, kalan **14 taş** kapalı **Pazar / Banka (`boneyard`)** olarak ortada durur (`minDrawStockRemaining: 2` ise son 2 taş pazardan çekilemez, kapalı kalır).
    - **4 Kişilikte:** `4 × 7 = 28` taşın tamamı dağıtılır (pazarda taş kalmaz, `boneyard = []`).
- **İlk Başlayan Oyuncu:**
  - İlk elde elinde en büyük çifti (`6-6`, yoksa `5-5`, ..., `0-0`; kimsede çift yoksa en ağır taşı `6-5`) bulunduran oyuncu **o taşı masanın ortasına koyarak** oyuna başlar!
  - Sonraki ellerde bir önceki eli kazanan oyuncu istediği taşla başlar.

### 2. Tur Akışı Adım Adım
1. Sırası gelen oyuncu (`turn`):
   - Masadaki açık uçlardan (`openEnds`) en az biriyle eşleşen bir taşı elinde varsa, o taşı uygun uca ekler (`{ type: 'play', tileId, end: 'left' | 'right' | 'up' | 'down' }`).
   - Eğer elinde masadaki açık uçlara uyan **hiçbir taş yoksa**:
     - **2 Kişilikte (Pazarda çekilebilir taş varken):** Oyuncu uyan bir taş bulana veya pazar sınırına (`minDrawStockRemaining`) ulaşana kadar pazardan taş çeker (`{ type: 'draw' }`). Çektiği taş uyarsa hemen aynı turda oynar!
     - **Pazar Boşsa (veya 4 Kişilikte):** Oyuncu **`{ type: 'pass' }`** geçer ve sıra bir sonraki oyuncuya geçer.
2. **Çift Taşların Yerleşimi:**
   - Çift taşlar (`a === b`, örn. `4-4`) zincire dikey (enlemesine) yerleştirilir.
3. **Elin Bitmesi:**
   - **Normal Bitiş ("Domino"):** Bir oyuncunun elinde `0` taş kaldığında (`hand.length === 0`) el anında biter.
   - **Kilitlenme ("Kilit / Bağlanma"):** Masadaki tüm oyuncular arka arkaya pas geçtiğinde (ve pazarda çekilebilir taş kalmadığında) el kilitlenir ve biter.

### 3. Geçerli / Geçersiz Hamle Kuralları ve Tüm Kenar Durumlar
1. **Elde Oynanabilir Taş Varken Pazar Çekme veya Pas Geçme Yasağı:**
   - Oyuncunun elinde açık uçlardan birine uyan en az 1 taş varsa **pazardan taş çekemez ve pas geçemez**!
2. **5 ve Katları Puanlı Varyant (`variant: 'besinKatlari'` / Aznif / All Fives) Uç Hesabı:**
   - Her taş oynandıktan sonra masadaki açık uçların toplamı (`openEndsSum`) hesaplanır:
     - Normal (çift olmayan) bir uçtaki taş, dışarı bakan ucunun sayısını (`0..6`) verir.
     - Uçta henüz tek tarafı açık olan dikey bir **çift taş (`a-a`)** duruyorsa, o uç **`2 × a`** (taşın üzerindeki iki yarıdaki toplam nokta sayısı, örn. `6-6` ise `12`, `4-4` ise `8`) olarak toplama katılır!
     - **İlk Taş Çift İse:** Masaya atılan ilk taş örneğin `5-5` ise toplam `10` eder ve başlayan oyuncuya anında `+10` puan yazar! (`6-4` atılırsa `6 + 4 = 10` puan yazar!).
     - **Spinner (Dört Uçlu İlk Çift — `spinnerMode: 'firstDouble'`):** Masaya atılan ilk çift taşın önce sağ ve sol kolları (`left` ve `right`) doldurulur; sağ ve sol kolları kapandıktan sonra üst ve alt kolları (`up` ve `down`) da açılarak 4 uçlu haç şeklini alabilir.
   - Eğer `openEndsSum > 0` ve `openEndsSum % 5 === 0` (`5, 10, 15, 20, 25, 30, 35`) ise, hamleyi yapan oyuncu (veya takımı) **anında `openEndsSum` kadar puan** kazanır!
3. **Ayaz (`0-0`) Özel Kuralı (`ayazPenalty`):**
   - El bittiğinde bir oyuncunun elinde `0-0` (Ayaz) taşı kalmışsa:
     - Eğer elinde `0-0` yanında başka taşlar da varsa (örn. `0-0` ve `4-2`), `0-0` `0` puan sayılır (veya `ayazPenalty` ayarlarına göre değerlendirilir).
     - Eğer oyuncunun elinde **tek başına `0-0`** kalmışsa, `ayazPenalty` (varsayılan Klasik'te **`10` puan**, 5'in Katları'nda **`20` puan**) değerinde sayılır!

### 4. Puanlama Tablosu, Cezalar, Bitiş Koşulu ve Beraberlik Bozma

| Varyant | Durum | Puanlama Kuralları |
| :--- | :--- | :--- |
| **Klasik Türk Usulü (`klasikCezali`)** | **Normal Bitiş (Domino)** | Biten oyuncu **`0` ceza** alır (veya rakiplerin elinde kalan taşların toplam sayısını **artı puan** olarak kendine yazar). Kaybedenler elinde kalan taşların nokta toplamını (`sum(a + b)`, tek `0-0` ise `10`) yazar. |
| **Klasik Türk Usulü (`klasikCezali`)** | **Kilitlenme (Bağlanma)** | Her oyuncunun elindeki taşların nokta toplamı hesaplanır. **En düşük toplama sahip oyuncu** eli kazanır ve rakiplerin el toplamı ile kendi el toplamı arasındaki farkı kazanır (veya diğerleri kendi el toplamını ceza olarak yazar). En düşük toplamda eşitlik varsa kimse puan almaz. |
| **5 ve Katları Puanlı (`besinKatlari`)** | **Oyun İçi Anlık Puan** | Her hamlede açık uçların toplamı `5`'in katıysa (`5, 10, 15, 20...`) anında haneye `+openEndsSum` eklenir. |
| **5 ve Katları Puanlı (`besinKatlari`)** | **El Sonu Puanı** | Eli bitiren (veya kilitte en düşük kalan) oyuncu, rakiplerin elinde kalan taşların toplamının **en yakın 5'in katına yuvarlanmış** değerini (örn. `12 → 10`, `13 → 15`) artı puan olarak kendi hanesine ekler! |

- **Bitiş Koşulu:** `targetScore` (varsayılan `101` veya `151`) puana ulaşan oyuncu/takım maçı kazanır.

### 5. Yaygın Ev Kuralları ve Varyantlar (Ayarlar)

| Ayar Adı | Varsayılan | Olası Değerler | Ne Değiştirir? |
| :--- | :--- | :--- | :--- |
| `variant` | `'klasikCezali'` | `'klasikCezali'`, `'besinKatlari'` | Klasik el sonu puanlı domino veya 5 ve katları oyun içi puanlı domino. |
| `seats` | `2` | `2`, `4` | 2 kişilik (pazarlı) veya 4 kişilik (pazarsız). |
| `partnerMode` | `true` (4 kişide) | `true`, `false` | 4 kişilikte karşılıklı eşli mod. |
| `ayazPenalty` | `10` | `0`, `10`, `20` | Elde tek başına `0-0` (Ayaz) kalmasının puan değeri. |
| `minDrawStockRemaining` | `2` (2 kişide) | `0`, `2` | Pazarda çekilemez olarak bırakılacak kapalı taş sayısı. |
| `spinnerMode` | `'none'` | `'none'`, `'firstDouble'` | İlk çiftin 4 yöne kol açıp açamayacağı. |

### 6. Süre / Zaman Aşımı ve Oyuncu Ayrılınca Ne Olur
- **Süre:** Hamle başına **20 sn**.
- **Zaman Aşımı (`quickMove`):** Oynanabilir taş varsa en yüksek noktalı taşı oynar; yoksa pazardan çeker veya pas geçer.
- **Oyuncu Ayrılması:** Bot devralır.

### 7. Gizli Bilgi (`viewFor`)
- **Gönderilenler:** Kendi `hand` taşları, rakiplerin `handCount` sayısı, pazardaki taş
*(Önceki yanıttan devam — **OYUN 11: DOMİNO** §7'den itibaren)*

### 7. Gizli Bilgi (`viewFor`)
- **Gönderilenler:** Oyuncunun kendi `hand` taşları, rakiplerin elindeki taş sayısı (`handCount`), pazardaki kalan taş sayısı (`boneyardCount`), masadaki zincir (`boardChain`) ve açık uçların değerleri (`openEnds`), açık uçların anlık toplamı (`openEndsSum`), her oyuncunun/takımın anlık skoru. El bittiğinde (`phase === 'finished'`) tüm oyuncuların kalan elleri (`revealedHands`) açılır.
- **Gizlenenler:** Rakiplerin ellerindeki taşlar ve pazardaki (`boneyard`) kapalı taşların kimlikleri/sırası.

### 8. Bot Stratejisi İpuçları (Acemi / Usta)
- **Acemi (`easy`):** Açık uçlara uyan ilk taşı veya en büyük noktalı taşı oynar; 5'in katları hesabını gözetmez.
- **Usta (`hard`):**
  - **5 ve Katları Modunda (`besinKatlari`):** Yasal hamleler içinden `newOpenEndsSum % 5 === 0` yapan ve en yüksek anlık puanı (`15, 20...`) getiren hamleyi birinci öncelikle seçer.
  - **Taş Sayma ve Bloklama:** Her sayıdan (`0..6`) toplam 8 uç (7 taş) olduğunu bilir; masada çıkmış taşları ve rakibin hangi sayılarda pas geçtiğini (`missingNumbers[opponent]`) kaydeder. Rakibin pas geçtiği sayıyı her iki uca da getirerek eli kilitlemeye çalışır.
  - **Ağır Taş ve Çift Yönetimi:** Elinde çok sayıda bulunan rengi/sayıyı korur, tek olan çift taşları (`6-6`, `5-5`) elinde kalmaması için erken eritir.

### 9. Test Senaryoları Listesi (25 Somut Test Durumu)
1. **[DOM-T01] 28 Taşlık Deste Doğrulaması:** `createDominoSet()` → `0-0`'dan `6-6`'ya kadar tam 28 benzersiz taş (7 çift + 21 normal taş, toplam nokta sayısı `168`).
2. **[DOM-T02] 2 Kişilik Dağıtım:** `seats: 2` → Koltuk 0 ve 1'de 7'şer taş, pazarda (`boneyard`) `14` taş.
3. **[DOM-T03] 4 Kişilik Dağıtım:** `seats: 4` → 4 oyuncuda 7'şer taş, pazarda `0` taş.
4. **[DOM-T04] İlk Elde En Büyük Çift (`6-6`) Sahibinin Başlaması:** Koltuk 2'nin elinde `6-6` varsa `turn === 2` olur ve ilk hamlede `6-6` oynanır.
5. **[DOM-T05] Çift Yoksa En Ağır Taşın Başlaması:** 2 kişilik oyunda iki oyuncuda da hiç çift yoksa, en yüksek noktalı taşa (`6-5`, `6-4` vb.) sahip oyuncu başlar.
6. **[DOM-T06] Uyan Taşı Doğru Uca Ekleme:** Masada `6-6` varken sıradaki oyuncu `6-3` taşını oynar → Açık uçlar `[6, 3]` olur.
7. **[DOM-T07] Uymayan Taşı Oynama Reddi:** Açık uçlar `[6, 3]` iken oyuncu `4-2` oynamak ister → `{ ok: false, error: 'Bu taş seçilen uca uymuyor' }`.
8. **[DOM-T08] Elde Uyan Taş Varken Pazardan Çekme Reddi:** Açık uçlar `[6, 3]` ve oyuncunun elinde `3-1` varken `{ type: 'draw' }` gönderir → `{ ok: false, error: 'Elinizde oynayacak taş varken pazardan çekemezsiniz' }`.
9. **[DOM-T09] Elde Uyan Taş Varken Pas Geçme Reddi:** Oyuncunun elinde uyan taş varken `{ type: 'pass' }` gönderir → `{ ok: false }`.
10. **[DOM-T10] Elde Uyan Taş Yokken Pazardan Çekme:** 2 kişilikte açık uçlar `[6, 6]`, oyuncuda `6`'lı taş yok ve pazarda 10 taş var → `{ type: 'draw' }` kabul edilir, oyuncunun eline 1 taş eklenir, sıra hâlâ aynı oyuncudadır.
11. **[DOM-T11] Pazar Sınırı (`minDrawStockRemaining: 2`) Dolunca Pas Geçme:** Pazarda 2 taş kaldığında ve oyuncunun elinde hâlâ uyan taş yoksa → `draw` reddedilir, `{ type: 'pass' }` kabul edilir ve sıra rakibe geçer.
12. **[DOM-T12] 5 ve Katları Modunda İlk Taş `5-5` Puanı:** `variant: 'besinKatlari'`, ilk oyuncu `5-5` açar → `openEndsSum === 10`, oyuncuya anında `+10` puan yazılır.
13. **[DOM-T13] 5 ve Katları Modunda İlk Taş `6-4` Puanı:** İlk oyuncu `6-4` açar → `6 + 4 = 10`, oyuncuya anında `+10` puan yazılır.
14. **[DOM-T14] 5 ve Katları Modunda Uçtaki Çiftin Çift Sayılması:** Bir uçta tek normal `3`, diğer uçta dikey `6-6` çifti var → `openEndsSum = 3 + 12 = 15`, hamleyi yapan oyuncu anında `+15` puan kazanır!
15. **[DOM-T15] 5 ve Katları Modunda Çiftin Arkası Kapanınca Tek Sayılması:** `6-6` çiftinin açık ucuna `6-2` eklendiğinde artık uçlarda `3` ve `2` vardır → `openEndsSum = 3 + 2 = 5`, oyuncu `+5` puan kazanır (`6-6` artık içeride kaldığı için sayılmaz).
16. **[DOM-T16] 5'in Katı Olmayan Uç Toplamında 0 Puan:** Açık uçlar `4` ve `3` (`toplam 7`) → Anlık puan `0`.
17. **[DOM-T17] Spinner (4 Uçlu İlk Çift — `spinnerMode: 'firstDouble'`):** İlk çiftin (`4-4`) sağ ve sol uçları dolduktan sonra `up` ve `down` uçlarına da `4`'lü taşlar eklenebilir ve 4 açık ucun toplamı hesaba katılır.
18. **[DOM-T18] Son Taşını Oynayarak Normal Bitiş ("Domino"):** Koltuk 0 son taşını oynar (`hand.length === 0`) → `phase === 'finished'`, `winner === 0`.
19. **[DOM-T19] Klasik Modda El Sonu Puanı:** Koltuk 0 bitti; Koltuk 1'in elinde `6-5` (11) ve `4-2` (6) kaldı → Koltuk 0 `+17` puan kazanır (veya cezalı modda Koltuk 1'e `+17` ceza yazılır).
20. **[DOM-T20] Elde Tek Başına `0-0` (Ayaz) Kalması (`ayazPenalty: 10`):** Koltuk 0 bittiğinde Koltuk 1'in elinde yalnızca `[0-0]` kalmıştır → `0` değil, `10` puan (`besinKatlari`'nda `20` puan) olarak hesaplanır!
21. **[DOM-T21] Elde `0-0` Yanında Başka Taş Varken `0-0`'ın 0 Sayılması:** Koltuk 1'in elinde `[0-0, 3-2]` kalmıştır → Toplam `0 + 5 = 5` puan olarak hesaplanır.
22. **[DOM-T22] Herkes Pas Geçince Elin Kilitlenmesi (Bağlanma):** 4 kişilik oyunda 4 oyuncu arka arkaya `pass` geçer → `phase === 'finished'`, el kilitlenir; el toplamı en düşük olan oyuncu kazanır.
23. **[DOM-T23] Kilitlenmede Eşit El Toplamı:** Kilitlenen elde Koltuk 0 ve Koltuk 1'in ikisinin de el toplamı `8` ise → `winner === null`, el sonu fark puanı kimseye verilmez.
24. **[DOM-T24] 5 ve Katları Modunda El Sonu Yuvarlama:** Rakibin elinde `13` nokta kaldıysa en yakın 5'in katı olan `15`'e, `12` nokta kaldıysa `10`'a yuvarlanarak kazananın puanına eklenir.
25. **[DOM-T25] Gizli Bilgi (`viewFor`) Sızıntı Testi:** `viewFor(state, 0)` içinde rakibin taşları ve pazardaki `boneyard` dizisi **asla yer almaz**; yalnızca `boneyardCount` ve `handCount` gönderilir.

### 10. 60+ Kullanıcı İçin Arayüzde Gösterilmesi Gereken Yardımcı Bilgiler
- **Canlı Uç Toplamı Rozeti:** Ekranın üst ortasında masadaki açık uçların sayıları ve toplamı büyük rakamlarla görünmeli: **"Açık Uçlar: 3 + 12 = 15 (+15 Puan!)"**.
- **Otomatik Yönlendirme (Kıvrılan Zincir):** Domino zinciri uzadıkça taşlar küçülmek yerine ekran etrafında U şeklinde kıvrılmalı; oyuncunun elindeki bir taş seçildiğinde masada bağlanabileceği uç(lar) yeşil kutuyla parlamalı ve yanında `"Buraya koyarsan Uç Toplamı: 10 (+10 Puan)"` önizlemesi çıkmalı!

---

## BÖLÜM 3: Bölgelere / Kahvehanelere Göre Değişen ve Kullanıcıya Sorulması Gereken Kurallar (Doğrulanmalı Listesi)

Aşağıdaki kurallar Türkiye'de kahvehaneden kahvehaneye ve bölgeden bölgeye farklı uygulandığı için masayı kurarken **Ayar Seçeneği (`Opts`)** olarak sunulmalı; ürün sahibinin varsayılan (`defaultOptions`) tercihi için **DOĞRULANMALI** olarak işaretlenmiştir:

| # | Oyun | Tartışmalı / Bölgesel Kural | Seçenek A (Önerilen Varsayılan) | Seçenek B (Alternatif Kahvehane Usulü) | Durum |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **101 Okey** | **Elde kalan gerçek okeyin cezası** | Sadece sabit **101** yazar (kendi sayısını yazmaz). | `101 + okeyin kendi sayısı` yazar (mevcut `tiles.ts` davranışı). | **DOĞRULANMALI** |
| 2 | **101 Okey** | **Başkası açmışken tek turda bitmek "Elden" sayılır mı?** | **Evet (`eldenScope: 'self'`)**, biten oyuncu daha önce açmamışsa elden sayılır (`×2`). | **Hayır (`eldenScope: 'table'`)**, masada hiç kimse açmamış olmalıdır (mevcut `game.ts` davranışı). | **DOĞRULANMALI** |
| 3 | **101 Okey** | **Yandan alınan taşla açamama durumu** | Henüz açmamış oyuncu o taşla açamıyorsa yandan taşı **hiç alamaz** (`strictSidePickup: true`). | Taşı alabilir, açamazsa elinde tutar ve `+101` ceza yer (`strictSidePickup: false`, mevcut `game.ts` davranışı). | **DOĞRULANMALI** |
| 4 | **101 Okey** | **Eşli 101'de eşin perine işleme izni** | Oyuncu kendi elini açmadan ortağının açtığı perlere taş **işleyemez** (önce kendisi de 101/çift açmalıdır). | Ortağı açtıysa kendisi açmadan da ortağının perlerine işleyebilir (bazı ev kuralları). | **DOĞRULANMALI** |
| 5 | **Düz Okey** | **Gösterge ne zaman gösterilebilir?** | İlk turda **taş atmadan önceki herhangi bir anda** (taş çektikten sonra da) gösterilebilir. | Yalnızca **taş çekmeden önce** gösterilebilir (mevcut `canShowIndicator` davranışı). | **DOĞRULANMALI** |
| 6 | **Pişti** | **Dağıtımdaki ilk 4 kartta Vale varsa / tek kart kalırsa** | İlk 4 kart üst üste olduğu için ilk hamlede pişti olmaz; 3 kapalı kart ilk alana gösterilir. | 3 kapalı kart kimseye gösterilmez, sadece el sonunda sayılır. | **DOĞRULANMALI** |
| 7 | **Batak** | **Dönen renk yokken ve yerdeki kozu geçemiyorken koz atma (Alttan Çakma)** | Elde dönen renk yoksa, yerdeki kozu geçemese bile elindeki **küçük kozu atmak zorunludur**. | Yerdeki kozu geçemiyorsa koz atmak zorunda değildir, başka renk atabilir. | **DOĞRULANMALI** |
| 8 | **Batak** | **Eşli Batak'ta ortağın elini açması (Dummy)** | İhaleyi alan oyuncunun ortağı elini masaya **açık** serer ve ihaleyi alan yönetir. | Ortağın eli kapalı kalır, herkes kendi elini oynar. | **DOĞRULANMALI** |
| 9 | **King (Rıfkı)** | **Kupa Almaz ve Rıfkı'da renk yokken kupa/Rıfkı atma zorunluluğu** | Dönen renk yoksa eldeki Rıfkı (`K♥`) veya Kupa'yı atmak **zorunludur**. | Serbesttir, istediği kağıdı atabilir. | **DOĞRULANMALI** |
| 10 | **Tavla** | **Gülbara'da çift zar zinciri ("Çift Üstü Çift")** | Klasik çift zar (sadece atılan çift 4 kez oynanır). | Atılan çiftten `6-6`'ya kadar tüm çiftler zincirleme oynanır, oynanamayanı rakip oynar. | **DOĞRULANMALI** |
| 11 | **Domino** | **Puanlama sistemi varsayılanı** | Klasik Türk usulü (el sonu kalan taş toplamı). | Aznif / 5 ve Katları (oyun içi açık uçların 5 ve katları toplamı). | **DOĞRULANMALI** |

---

## BÖLÜM 4: Kaynak Listesi (URL)

1. **101 Okey ve Düz Okey Kuralları, Cezaları ve Varyantları:**
   - Türkiye Barolar Birliği Turnuva Okey / 101 Kuralları: `https://www.barobirlik.org.tr`
   - Okey 101 Çetele & Resmi Ceza Kuralları (İşlek, Okey Çalma, Çift Açma, Katlamalı): `https://okey101cetele.com`
   - Okey & 101 Kuralları Rehberi: `https://okey.gg` / `https://kurallar.net`
2. **Pişti Kuralları (2 Kişilik, 4 Kişilik, Eşli):**
   - Vikipedi — Pişti (İskambil Oyunu) Kuralları ve Puanlama: `https://tr.wikipedia.org/wiki/Pi%C5%9Fti`
3. **Batak Kuralları (İhaleli, Eşli, Gömmeli, Koz Maça):**
   - Vikipedi — Batak (İskambil Oyunu) ve Varyantları: `https://tr.wikipedia.org/wiki/Batak_(oyun)`
4. **King (Rıfkı) Kuralları, Cezalar ve Puanlama Tablosu:**
   - Vikipedi — King (Rıfkı) Kuralları ve Ceza/Koz Tablosu: `https://tr.wikipedia.org/wiki/King_(oyun)`
   - King Puanlama ve Ceza Zorunlulukları: `https://rekabet.app` / `https://zipi.games`
5. **Konken ve 51 (Elli Bir) Kuralları:**
   - Vikipedi — Konken ve Rummy Ailesi: `https://tr.wikipedia.org/wiki/Konken`
   - Klasik 10 Kağıt Konken (Mecburcu/Rölans) ve 14 Kağıt 51 Farkları: `https://kartoyunlari.tr` / `https://masa.io`
6. **Papaz Kaçtı Kuralları:**
   - Geleneksel Papaz Kaçtı (Papaz Kimde) Kuralları: `https://www.hurriyet.com.tr` / `https://www.milliyet.com.tr`
7. **Tavla, Gülbara, Tapa, Mars ve Konçina Kuralları:**
   - Dünya Tavla Federasyonu Türkiye Temsilciliği (WBF Turkey — Klasik Modern Tavla Kuralları): `https://www.wbfturkey.com`
   - BrainKing — Backgammon, Plakoto (Tapa / Hapis Tavlası) ve Gülbara Kuralları: `https://brainking.com`
   - Türkiye Geleneksel Spor Dalları Federasyonu (TGSDF): `https://www.gsdf.gov.tr`
8. **Türk Daması Resmi Kuralları:**
   - Türkiye Dama Federasyonu (TÜDAF — Resmi Türk Daması Turnuva Yönetmeliği, Zorunlu En Çok Taş Alma, Dama Çıkma ve Gayyım Kuralları): `https://www.turkdamasi.org.tr`
   - Vikipedi — Türk Daması: `https://tr.wikipedia.org/wiki/T%C3%BCrk_damas%C4%B1`
9. **Domino (Klasik ve 5'in Katları / Aznif) Kuralları:**
   - Vikipedi — Domino ve Puanlı Varyantlar (Muggins / All Fives / Aznif): `https://tr.wikipedia.org/wiki/Domino`
