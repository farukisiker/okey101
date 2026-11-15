KARAR: GERİ GÖNDER

- **P2 — Bot alınmış kartları ortada sayıyor.** [bot.ts:18](C:/Users/mfaru/okey101/kahve-codex/packages/pisti/src/bot.ts:18): geçmiş boş ortadan yürütülüyor; açılışı alan ilk Vale yanlışlıkla `openPile` içinde kalıyor. Bellekte çalıştırdığım örnekte gerçek orta `[♠2,♠3,♠4]`, botun hesapladığı orta `[♠J,♠2,♠3,♠4]` oldu. Bu hayali puan nedeniyle hard, elindeki ♥J’yi harcıyor. Ortanın hesabı gerçek toplama sınırlarıyla düzeltilmeli; regresyon testi eklenmeli.
- **P2 — Açılışın açık kartı bot hafızasından kayboluyor.** [setup.ts:19](C:/Users/mfaru/okey101/kahve-codex/packages/pisti/src/setup.ts:19), [rules.ts:32](C:/Users/mfaru/okey101/kahve-codex/packages/pisti/src/rules.ts:32), [bot.ts:7](C:/Users/mfaru/okey101/kahve-codex/packages/pisti/src/bot.ts:7): başlangıç geçmişi boş; ilk toplamada yalnız üç kapalı kart kaydediliyor. Başlangıçta açık olan dördüncü kart, üstü örtülünce görünümden kayboluyor. Medium/hard daha önce görülmüş kartı bilinmeyen sayıyor. Bu açık bilgi kalıcı tutulmalı; `secret` kartlar korunmalı.
- **Test kanıtındaki eksik:** [bot.test.ts:19](C:/Users/mfaru/okey101/kahve-codex/packages/pisti/test/bot.test.ts:19) medium/hard için aynı beklentileri sınarken geçmiş üzerinden gerçek orta hesabını doğrulamıyor. [simulation.test.ts:20](C:/Users/mfaru/okey101/kahve-codex/packages/pisti/test/simulation.test.ts:20) geçerlilik ve deterministik devamı güçlü biçimde kanıtlıyor; stratejik hesabın doğruluğunu kanıtlamıyor. Yukarıdaki iki durum ve gerekçeli medium/hard karar farkı test edilmeli.

Diğer inceleme sonuçları:

- **Sahiplik uygun:** yalnız izinli kaynaklar, testler ve rapor değişmiş. Dosya düzenlemedim.
- **Kurallar uygun:** boşta Vale, normal toplama, 10/20 pişti, açılışta pişti olmaması, kart puanları, çoğunluk/eşitlik, son alan, yeniden dağıtım, redraw ve eşli puan hesabında engelleyici hata bulmadım.
- **Gizlilik uygun:** rakip/ortak eli, deste sırası ve kapalı kimlikler görünümde yok; reveal/secret ayrımı korunuyor.
- **Normalizasyon uygun:** bilinmeyen alanlar atılıyor; bozuk değerler varsayılana dönüyor; iki kişide eşli kapanıyor.
- 200 seed kabulü geçti. Bu, onaylı B2 planını karşılıyor; PROMPT_LOCAL’daki tüm B aşaması için **1000 seed** ve ölçülmüş **%85 kapsam** henüz kanıtlanmış değil.

Kendim çalıştırdığım komutların gerçek çıktı özetleri:

```text
> corepack pnpm --filter @kahve/pisti test
$ vitest run --passWithNoTests
 Test Files  7 passed (7)
      Tests  37 passed (37)
   Start at  01:49:38
   Duration  14.07s (tests 95%, import 3%, transform 2%)
Çıkış: 0

> corepack pnpm --filter @kahve/pisti typecheck
$ tsc --noEmit
Çıkış: 0
```

Kök komutlar ortamın PATH sorunu nedeniyle başarısız:

```text
> corepack pnpm test
'pnpm' is not recognized as an internal or external command,
operable program or batch file.
[ELIFECYCLE] Test failed. See above for more details.

> corepack pnpm typecheck
'pnpm' is not recognized as an internal or external command,
operable program or batch file.
[ELIFECYCLE] Command failed with exit code 1.
```

Aynı betiklerin gövdelerini doğrudan çalıştırdım: toplam **363 test geçti**, tüm workspace typecheck’leri geçti.

```text
> corepack pnpm -r --filter @okey/shared --filter @okey/server --filter './packages/*' --filter app test
server test:  Test Files  9 passed (9)
server test:       Tests  65 passed (65)
server test: Done
Çıkış: 0

> corepack pnpm -r typecheck
server typecheck: Done
app typecheck: Done
Çıkış: 0
```