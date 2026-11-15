DURUM: ONAYLANDI 2026-11-15 (Fable)
FABLE NOTLARI:
- `leftOf` ayrıca dışa aktarılmaz; sadece `prevSeat(seat, n)`.
- `pick(rng, [])` → `undefined` (dönüş tipi `T | undefined`). Geçersiz n/koltuk ve farklı uzunluktaki diziler önkoşul; davranışı JSDoc'ta yazın, test gerekmez.
- Referans import yolu düzeltmeniz doğru (`../../../../shared/src/tiles`); sadece testte, üretim kodunda değil.
- Dört alt görev tek Sol çalıştırmasında sırayla yapılır (aynı worktree, commit çakışmasın).

# A1-CODEX — Lider planı

## 1. Anladığım kapsam

1. `@kahve/core` içine mevcut okey uygulamasıyla birebir aynı mulberry32 RNG ve Fisher–Yates karıştırma algoritmasını eklemek; çalışma zamanında `shared` bağımlılığı oluşturmamak.
2. `randomInt`, `pick` ve yalnızca ev sahibinin kullanacağı `newSeed` yardımcılarını eklemek.
3. Oyuncu sayısını parametre alan koltuk/sıra yardımcılarını ve girdilerini değiştirmeyen `sumTotals` fonksiyonunu eklemek.
4. Yeni fonksiyonları `src/index.ts` üzerinden dışa aktarmak; mevcut donmuş tip dışa aktarımlarını korumak.
5. Eşdeğerlik ve sınır testlerini tamamlamak; paket ve kök test/typecheck sonuçlarını, kapsam kanıtını ve commit kimliklerini raporlamak.

**Kapsam dışı:** `types.ts`, `shared/**`, `server/**`, `app/**`, bütün `package.json` dosyaları ve kilit dosyası; okey adaptörü, katalog, oyun kuralları, botlar, UI, protokol, bağımlılık ekleme, push ve entegrasyon dalına merge.

Astra kod yazmaz ve dosya düzenlemez. Bu aşamada yalnızca plan sunulur; ORKESTRA §3.3 gereği Fable onayından önce işçi başlatılmaz. Onaydan sonra uygulama `feat/kahve-codex` dalında yürütülür; görev başındaki `feat/kahve` güncellemesi işçi tarafından yapılır.

## 2. Alt görevler

Dosya yolları depo köküne göredir. İlk iki işin dosyaları ayrıdır; ortak `index.ts` yalnızca üçüncü işte düzenlenir.

| Alt görev | İşçi model | Dokunacağı dosyalar | Çalıştıracağı test komutu |
|---|---|---|---|
| RNG ve rastgele seçim yardımcıları; 10.000 değer eşdeğerliği, shuffle ve sınır testleri | `gpt-6.1-sol` | `packages/game-core/src/rng.ts`, `packages/game-core/test/rng.test.ts` | `corepack pnpm --filter @kahve/core test`; `corepack pnpm --filter @kahve/core typecheck` |
| Koltuk/sıra ve toplam yardımcıları; n=2/n=4 tablo testleri, değişmezlik testleri | `gpt-6.1-sol` | `packages/game-core/src/seats.ts`, `packages/game-core/src/scores.ts`, `packages/game-core/test/seats.test.ts`, `packages/game-core/test/scores.test.ts` | `corepack pnpm --filter @kahve/core test`; `corepack pnpm --filter @kahve/core typecheck` |
| Dışa aktarımlar, paket giriş noktası testi ve bütünleşik doğrulama | `gpt-6.1-sol` | `packages/game-core/src/index.ts`, `packages/game-core/test/exports.test.ts` | `corepack pnpm --filter @kahve/core test`; `corepack pnpm --filter @kahve/core typecheck`; `corepack pnpm test`; `corepack pnpm typecheck` |
| Kapsam kanıtı ve teslim raporu | `gpt-6.1-sol` | `docs/kahve/reports/A1-CODEX.md` | Sağlayıcı mevcutsa `corepack pnpm --filter @kahve/core test --coverage`; yoksa yeni paket kurmadan test–davranış eşlemesi |

Her işçi kendi test/typecheck çıktısının son satırlarını teslim eder. Astra diff’i ve dosya sahipliğini denetler, paket ve kök kontrollerini bağımsız olarak yeniden çalıştırır. Kabul: test sayısı **en az 93 + yeni testler**, bütün kontroller yeşil ve kapsam hedefi **≥%90**. Ölçüm aracı yoksa ölçülmüş yüzde iddia edilmez; kapsanan dallar raporda gerekçelendirilir.

## 3. Tükettiği arayüzler ve eklediği dışa aktarımlar

### Tüketilen arayüzler

Üretim kodunun tükettiği tek proje tipi, `types.ts @ 2d1c37b` sözleşmesidir:

```ts
export type Rng = () => number;
```

Testlerde referans alınacak mevcut `shared/src/tiles.ts` arayüzleri:

```ts
export type Rng = () => number;
export function seededRng(seed: number): Rng;
export function shuffle<T>(items: T[], rng?: Rng): T[];
```

`shared/src/game.ts` içindeki dört koltuklu davranış referansları:

```ts
export const leftOf: (seat: number) => number;
export const nextSeat: (seat: number) => number;
```

Bunlar üretim koduna import edilmez. Core, algoritmaları kendi içinde taşır. `GameDefinition` ve diğer donmuş tiplerde değişiklik yapılmaz.

### `@kahve/core` üzerinden eklenecek imzalar

```ts
export function seededRng(seed: number): Rng;
export function shuffle<T>(items: readonly T[], rng: Rng): T[];
export function randomInt(rng: Rng, n: number): number;
export function pick<T>(rng: Rng, items: readonly T[]): T | undefined;
export function newSeed(): number;

export function nextSeat(seat: number, n: number): number;
export function prevSeat(seat: number, n: number): number;
export function seatOrder(start: number, n: number): number[];
export function partnerOf(seat: number, n: number): number;

export function sumTotals(totals: number[], round: number[]): number[];
```

**Önerilen davranış sözleşmesi:**

- `seededRng`: seed’i `>>> 0` ile normalize eder; mevcut mulberry32 işlem sırası aynen korunur.
- `shuffle`: girdiyi kopyalar; sondan başa Fisher–Yates uygular. Boş/tek elemanlı dizide RNG çağırmaz, diğerlerinde `length - 1` kez çağırır.
- `randomInt`: pozitif tamsayı `n` için tek RNG çağrısıyla `Math.floor(rng() * n)` döndürür.
- `pick`: boş dizide RNG çağırmadan `undefined`, dolu dizide tek RNG çağrısıyla bir eleman döndürür.
- `newSeed`: tek `Math.random()` çağrısıyla `[0, 2³²)` aralığında tamsayı üretir; kurallar tarafından çağrılmaz.
- Koltuk yardımcıları geçerli koltuk indeksleri ve pozitif tamsayı `n` ile çalışır. `seatOrder` başlangıç koltuğu dahil, `nextSeat` yönünde bütün koltukları birer kez döndürür.
- `partnerOf`: dört kişide `(seat + 2) % 4`, `n !== 4` durumunda istisnasız `-1` döndürür.
- `sumTotals`: eşit uzunluklu dizileri indeks bazında toplar ve yeni dizi döndürür; iki girdi de korunur.

## 4. Riskler ve açık sorular

| Konu | Planlanan yaklaşım / Fable’a açık karar |
|---|---|
| `leftOf` adlandırması | MASTER_PLAN A1 satırında `leftOf`, görev kâğıdında `prevSeat` isteniyor. Görev kâğıdı esas alınarak yalnızca `prevSeat(seat, n)` eklenecek. Ek `leftOf` dışa aktarımı isteniyor mu? |
| Belirsiz sınır davranışları | `pick` için boş dizide `undefined` öneriliyor. Geçersiz `n`/koltuklar ve farklı uzunluktaki toplam dizileri için görev tanımı yok; plan geçerli girdileri önkoşul kabul ediyor. Fable farklı davranış istiyorsa uygulama öncesinde netleştirilmeli. |
| RNG eşdeğerliği | Birden fazla seed için ilk 10.000 değer birebir karşılaştırılacak; sıfır, negatif ve 32-bit sınır seed’leri kapsanacak. Shuffle için aynı seed/girdi sonucu, RNG çağrı sayısı, permütasyon ve girdi değişmezliği doğrulanacak. |
| Referans import yolu | `packages/game-core/test/` içinden doğru yol `../../../shared/src/tiles` değil, `../../../../shared/src/tiles` olur. Doğrudan karşılaştırma tercih edilir; çalışmazsa görevde izin verilen, kaynağı belirtilmiş ilk 20 değer fikstürü kullanılır ve sınırlama raporlanır. |
| Kök test kapsamı | Mevcut kök script `--filter "./packages/*"` içeriyor; core zaten kapsanıyor. `package.json` değişikliği gerekmiyor. |
| Kapsam sağlayıcısı ve PATH | Eksik coverage paketi kurulmaz. `pnpm` PATH sorunu çıkarsa görev kâğıdındaki geçici shim yöntemi kullanılır; depo manifestleri değiştirilmez. |
| Donmuş sözleşme | Tip eksiği çıkarsa işçi `docs/kahve/requests/codex-<konu>.md` üzerinden istek iletir; `types.ts` değiştirilmez. |
| Teslim kanıtı | Testler bu planlama aşamasında çalıştırılmadı. Başarı ve kapsam iddiaları yalnızca uygulama sonrası gerçek çıktılarla raporlanacak. |

## 5. Tahmini commit listesi

1. `feat(core): add deterministic RNG and random helpers`  
   RNG yardımcıları ve eşdeğerlik/sınır testleri.
2. `feat(core): add seat order and score total helpers`  
   Koltuk, sıra ve toplam yardımcıları ile testleri.
3. `feat(core): export A1 helpers from package entry`  
   Giriş noktası dışa aktarımları ve API testi.
4. `docs(kahve): report A1-CODEX validation results`  
   Değişen dosyalar, uygulama commit kimlikleri, gerçek test/typecheck son satırları, kapsam kanıtı ve bilinen eksikler.

Commit’ler işçi tarafından `feat/kahve-codex` dalında oluşturulur. Astra review sonucunu Fable’a sunar; push ve entegrasyon merge’ü bu görevin dışındadır.
