DURUM: ONAYLANDI 2026-11-16 (Fable) — B1 aynen. B2/B3 ön tasarımına erken notlar (ayrı planlarda uygulanacak):
- Saat: Pişti ve Batak `{ baseMs: 30000, firstTurnFactor: 2 }` (okey ile aynı; 60+ için tutarlılık).
- Pişti 4 kişide varsayılan TEKLİ (`partnerMode: false`), eşli ayar. Hedef 151, hiddenCards 'reveal', openingJack 'redraw' (kullanıcı: genel kabul görenle başla).
- Batak "geçemiyorsa koz atmak zorunlu değil" seçeneği için iki boolean yerine tek ayar: `voidTrump: 'always' | 'ifCanOvertrump' | 'never'`, varsayılan 'always'.
- Bölgesel varsayılanlar artık "öneri" değil, uygulanır (MASTER_PLAN §4e); Faz B sonunda kullanıcıya listelenecek.

## 1) Kapsam ve kapsam dışı

**Görev: B1-CODEX — `@kahve/cards`**

1. JSON uyumlu `Suit`, `Rank`, `Card` tipleri ve sabit kimlikli, jokersiz 52 kartlık deste.
2. `@kahve/core` RNG sözleşmesiyle deterministik karıştırma ve girdiyi değiştirmeyen dağıtım.
3. Löve üstünlüğü karşılaştırması ve değer eşleştirme.
4. Kart etiketi, takım rengi ve tutarlı el sıralaması.
5. Birim testleri, JSON gidiş-dönüş doğrulaması, kapsam kanıtı ve B1 teslim raporu.

**Kapsam dışı:** Pişti/Batak uygulaması ve botları, UI, katalog/sunucu entegrasyonu, yeni bağımlılıklar, çekirdek sözleşmesi değişiklikleri. B2 ve B3 aşağıda yalnızca erken görüş için tasarlanmıştır; ayrı plan/onay gerektirir. Bu tur dosya yazımı, işçi başlatılması, merge, test çalıştırılması veya commit yapılmaz.

## 2) Alt görevler

Onaydan sonra Fable çalışma dalını `feat/kahve` ile günceller; mevcut paket iskeleti korunur. İşler aşağıdaki sırayla yürür; ortak dosyalarda eşzamanlı yazım yapılmaz.

| Alt görev | İşçi model | Dosyalar | Test komutu |
|---|---|---|---|
| B1.1 — Kart tipleri, kimlik eşlemesi, deste, etiket ve renk | gpt-6.1-sol | `packages/cards/src/{types,deck,display}.ts`, `packages/cards/test/{deck,display}.test.ts` | `corepack pnpm --filter @kahve/cards test` |
| B1.2 — Karıştırma ve dağıtım; sınır ve değişmezlik testleri | gpt-6.1-sol | `packages/cards/src/deck.ts`, `packages/cards/test/deck.test.ts` | `corepack pnpm --filter @kahve/cards test` |
| B1.3 — Löve karşılaştırması, değer eşleştirme ve el sıralaması | gpt-6.1-sol | `packages/cards/src/{compare,sort}.ts`, `packages/cards/test/{compare,sort}.test.ts` | `corepack pnpm --filter @kahve/cards test` |
| B1.4 — Dışa aktarımlar, sözleşme testleri ve teslim raporu | gpt-6.1-sol | `packages/cards/src/index.ts`, `packages/cards/test/contract.test.ts`, `docs/kahve/reports/B1-CODEX.md` | `corepack pnpm --filter @kahve/cards test`; `corepack pnpm --filter @kahve/cards typecheck`; `corepack pnpm test`; `corepack pnpm typecheck` |

Her işçi kendi test ve paket typecheck çıktısını raporlar. Astra diff’i, dosya sahipliğini ve kapsamı inceler; paket ve kök kontrollerini bağımsız tekrarlar.

Kabul testleri: 52 benzersiz kimlik ve takım/değer çifti; aynı seed için aynı karıştırma; kart kaybı/tekrarı olmaması; boş, sıfır, eşitsiz ve yetersiz dağıtım; girişlerin değişmemesi; karşılaştırmanın kozlu/kozsuz tüm sınıfları; sıralama ve etiketler; JSON gidiş-dönüş. Kapsam hedefi ≥%85; coverage altyapısı yoksa görev kâğıdındaki alternatif olan test–kural eşleme tablosu raporlanır, ölçülmemiş yüzde iddia edilmez. Bot-bot ve `viewFor` testleri B1’e uygulanamaz; B2/B3’te paket başına 200 oyun, OpenCode tarafında 1000 seed doğrulaması yapılır.

## 3) Tüketilen arayüzler ve tam dışa aktarım imzaları

**Tüketilen sözleşme:** `@kahve/core` üzerinden `Rng = () => number` ve `shuffle<T>(items: readonly T[], rng: Rng): T[]`. B1 bir `GameDefinition` uygulamaz. `newSeed`, saat, koltuk veya katalog bağımlılığı eklenmez.

Aşağıdaki bildirimler önerilen API sözleşmesidir; bu tur uygulanmaz:

```ts
import type { Rng } from '@kahve/core';

export type Suit = 'S' | 'H' | 'D' | 'C';

export type Rank =
  | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
  | 11 | 12 | 13 | 14;

export interface Card {
  id: number;
  suit: Suit;
  rank: Rank;
}

export type HandOrder = 'asc' | 'desc';

export interface DealResult {
  hands: Card[][];
  remaining: Card[];
}

export declare function fullDeck(): Card[];

export declare function shuffleDeck(rng: Rng): Card[];

export declare function deal(
  deck: readonly Card[],
  counts: readonly number[],
): DealResult;

export declare function compare(
  a: Card,
  b: Card,
  lead: Suit,
  trump?: Suit,
): -1 | 0 | 1;

export declare function sameRank(a: Card, b: Card): boolean;

export declare function suitColor(suit: Suit): 'red' | 'black';

export declare function cardLabel(card: Card): string;

export declare function sortHand(
  hand: readonly Card[],
  order: HandOrder,
): Card[];
```

**Davranış sözleşmesi:**

- **Kimlik:** takım sırası `S,H,D,C`; `id = takımİndeksi × 13 + (rank − 2)`. `S2=0`, `SA=12`, `C2=39`, `CA=51`. Her `fullDeck()` çağrısı yeni dizi ve kart nesneleri üretir.
- **Karıştırma:** `shuffle(fullDeck(), rng)`; yalnız verilen RNG kullanılır. 52 kart için çekirdeğin mevcut davranışıyla 51 rastgele değer tüketilir.
- **Dağıtım:** deste başı indeks `0`’dır. `counts[i]` kadar kart, sırayla ve kesintisiz blok olarak `hands[i]`’ye ayrılır; kalan sıra korunur. `[4,4]` ilk oyuncuya ilk dört, ikinciye sonraki dört kartı verir. Koltuk yönü ve başlangıç koltuğu oyun motorunun sorumluluğudur. Boş liste ve sıfır adet geçerlidir; negatif, kesirli, sonlu olmayan adet veya toplamın desteyi aşması `RangeError` üretir. Girdi değiştirilmez.
- **Karşılaştırma:** pozitif sonuç `a` üstün, negatif sonuç `b` üstün demektir. Öncelik koz → açılan takım → diğer takımlar. Koz veya açılan takım içindeki kartlarda büyük değer kazanır; As en büyüktür. İki kart da koz/açılan takım dışında ise `0` döner: ikisi de löve kazanamaz. Aynı kart da `0` verir. Kazanan, açılış kartından başlanıp yalnız pozitif sonuçta değiştirilerek bulunur.
- **Sıralama:** takım sırası her zaman `S,H,D,C`; `asc` takım içinde `2→A`, `desc` `A→2`. Yeni dizi döner; eşit anahtarların giriş sırası korunur. `compare` el sıralamak için kullanılmaz.
- **Sunum:** `cardLabel` örnekleri `A♠`, `J♥`, `10♦`, `2♣`; renk `H/D` için kırmızı, `S/C` için siyahtır. `sameRank` yalnız sayısal değeri karşılaştırır.

**B2 Pişti ön tasarımı:** `PistiState` düz JSON olarak `options, round, dealer, turn, turnNumber, phase: 'playing'|'finished', players[{name,hand}], deck, centerPile, hiddenOpeningCardIds, captured, pistis, lastCapturer: number|null, publicHistory, lastAction, result` alanlarını taşır; maç toplamları host’ta kalır, bir round 52 kartın tamamının oynanmasıdır. Tek aksiyon `{type:'play', cardId:number}` olur; yeniden dağıtım ve son kartların son alana aktarılması `apply` içinde otomatik gerçekleşir. `PistiOptions` önerisi: `seats:2|4=2`, `partnerMode:boolean=false` (dört oyuncu seçilip alan verilmezse `true`, iki oyuncuda zorunlu `false`), `targetScore:51|101|151=151`, `hiddenCards:'reveal'|'secret'='reveal'`, `openingJack:'redraw'|'allow'='redraw'`, `pistiPoints:number=10`, `jackPistiPoints:number=20`, `acePoints:number=1`, `jackPoints:number=1`, `clubTwoPoints:number=2`, `diamondTenPoints:number=3`, `mostCardsPoints:number=3`; puan alanları sonlu, negatif olmayan tamsayılara normalize edilir. Açılıştaki dört kartın alınması pişti değildir; `secret` kartları toplayana da açıklamaz, el sonunda sayılır. `pistiDef: GameDefinition<PistiState,PistiAction,PistiView,PistiOptions>` güncel çekirdek sözleşmesini uygular; önerilen `clock={baseMs:20000,firstTurnFactor:2}`, `refillsClock=false`, `noticeOf` yoktur; pişti ve izin verilen açılış kartı gösterimi `lastAction` ile sunulur. Görünüm yalnız kendi eli, kamuya açık olaylar ve sayıları taşır; botların kart sayımı da yalnız bu bilgiye dayanır. Eşli puan iki ortak koltuğa aynı takım puanı olarak yazılır; maç karşılaştırması takım başına tek temsilci kullanır, eşit liderlikte uzar.

**B3 Batak ön tasarımı:** `BatakState` alanları `options, round, dealer, turn, turnNumber, phase:'bidding'|'selectingTrump'|'playing'|'finished', players[{name,hand}], bids, passed, highestBid, declarer:number|null, trump:Suit|null, trumpBroken, currentTrick[{seat,card}], completedTricks, tricksWon, lastAction, result` olur. İlk sürüm aksiyonları `{type:'bid',amount:number}`, `{type:'pass'}`, `{type:'selectTrump',suit:Suit}`, `{type:'play',cardId:number}`; ileride Koz Maça için `{type:'declare',tricks:number}` ayrılır. `BatakOptions` önerisi: `variant:'ihaleli'|'kozMaca'|'esli'='ihaleli'`, `targetRounds:5|7|9|11|13=9`, `minBid:4|5=5`, `forcedDealerBid:4|5=4`, `mustRaise:boolean=true`, `mustTrumpWhenVoid:boolean=true`, `mustOvertrump:boolean=true`, `trumpLeadNeedsBreak:boolean=true`, `zeroTrickPenalty:'bid'|'fixed5'|'none'='bid'`, `partnerDummy:boolean=false`; oyuncu sayısı sabit dört olur. İlk sürüm yalnız ihaleli tekliyi çalıştırır; diğer varyantlar ayar tasarımında ayrılır, uygulanmadan oynanabilir sunulmaz. `batakDef: GameDefinition<BatakState,BatakAction,BatakView,BatakOptions>` için önerilen saat `25000/2`, saat yenileme `false`; görünüm kendi eli, açık ihale/löve bilgileri ve `legalCardIds` içerir. Renge uyma önce gelir; başka oyuncu koz çakmışsa açılan rengi büyütmek gerekmez; geçemese de koz atma varsayılan olarak zorunludur. İhaleci tutturursa aldığı el, batarsa eksi ihale; diğerleri aldığı el, sıfır çeken ayara göre ceza alır. Botlar yalnız kendi eli ve açık geçmişi kullanır; dokuz el sonunda liderlik eşitse uzatma önerilir.

## 4) Riskler ve açık sorular

- **Kaynak önceliği:** bağlayıcı kurallar `PROMPT_LOCAL.md`; donmuş teknik sözleşme mevcut `types.ts`; bölgesel seçeneklerde güncel `MASTER_PLAN §4e` esas alınır. Araştırmadaki `201` Pişti hedefi, string kart kimliği ve varsayılan açık ortak eli taşınmaz.
- **B1’de onaylanacak API kararları:** blok dağıtım, `DealResult` alan adları, `HandOrder` anlamı, sabit kimlik eşlemesi ve löveye etkisiz iki kartın `compare` sonucunun `0` olması. Bunlar B2/B3 ve kart görünümünün ortak beklentisini belirler.
- **Yardımcı hata davranışı:** `deal` programlama hatasında istisna üretebilir; oyunların `apply` metodu ise geçersiz ağ girdisinde asla istisna üretmemelidir. B2/B3 doğrulamaları bu ayrımı koruyacak.
- **Bölgesel tercihler henüz kesin değil:** `hiddenCards='reveal'`, `openingJack='redraw'`, zorunlu alttan çakma ve `partnerDummy=false`, §4e’nin önerileridir. Kullanıcı yanıtı varsayılanları değiştirebilir; B1’i engellemez.
- **B3 kural boşlukları:** herkes pas geçtiğinde zorunlu ihalenin `4` olması, maçın dokuz el sürmesi ve uzatma araştırma kaynaklı önerilerdir. Ayrıca “yalnız geçemediğinde koz atmama” seçeneği mevcut iki boolean ile tam temsil edilmiyor; B3 planında ayrı ayar gerekip gerekmediği kararlaştırılmalı.
- **Saat sözleşmesi:** araştırmadaki `BaseGameOptions` doğrudan alınamaz; mevcut `GameDefinition.clock` seçeneklere bağlı fonksiyon değildir, bot seviyesi de `botMove` parametresidir. Masa bazında süre ayarı istenirse çekirdek değiştirilmeden `docs/kahve/requests/codex-clock-options.md` üzerinden Fable’a sözleşme talebi hazırlanır.
- **Teslim koşulları:** paket iskeleti mevcut; manifest, tsconfig, kök dosyalar ve lockfile Fable’ın sorumluluğundadır. B1 testleri bu tur çalıştırılmadı; başarı veya kapsam sonucu henüz yoktur.

## 5) Tahmini commit listesi

1. `feat(cards): add card types, stable deck ids and labels`
2. `feat(cards): add deterministic shuffle and immutable dealing`
3. `feat(cards): add trick comparison and hand sorting`
4. `test(cards): verify public contract and document B1 acceptance`

Her adım ilgili testleriyle birlikte hazırlanır. Sol değişiklikleri commit’siz bırakır; Astra inceleme ve yeniden testleri tamamlar; commit’leri **yazar: Sol, inceleyen: Astra** bilgisiyle Fable oluşturur. B2/B3 için bu listede uygulama veya commit yoktur.