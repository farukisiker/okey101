# A7-OPUS raporu: okey kural güncellemesi + ceza bildirimi (Opus 5.5, feat/kahve-a7)

Plan: `docs/kahve/plans/A7-OPUS.md` (Fable onayı 15.11.2026). types.ts dokunulmadı; protocol.ts'e sadece Fable'ın 11fe405'i (merge) geldi.

## Yapılanlar
| Karar | Yer | Not |
|---|---|---|
| 1 elde okey | `shared/tiles.ts handPenalty` | gerçek okey `sum`'a girmez; `okeys×101` çarpılmaz. Sahte okey aynen. `RoundResult.tsx` aynı fonksiyonu kullandığı için otomatik doğru. |
| 5 gösterge | `shared/game.ts canShowIndicator` | `turnPhase` şartı kalktı: ilk turunda taş atana kadar. Düz bot zaten önce buna bakıyor. |
| 6 uç okey | `shared/melds.ts okeySwap` + `endOkey` | orta kuralı aynen; eklenen 13 + en yüksek gerçek 12 veya eklenen 1 + en düşük gerçek 2 ve yedek (boşluk dışı) okey → serbest. `addableTiles` ve bot otomatik faydalanır. |
| 7 işlek | `shared/game.ts isIslek`, `discard` dalı | `GameState.islek` (createGame varsayılan 'opened'); bitiş taşı ve okey hariç; çift perler sayılmaz. |
| 8 maç sonu | `catalog/okey.ts okeyMatchOver`, `Room.matchOver()`/`nextRound`, `useLocalGame` | el sayısı `round − matchStart`; `RoomInfo.matchOver` v2'ye gider, v1'den silinir. |
| Bildirim | `penalize()` → `GameState.notice`, `PlayerView.notice/islek/noticeMsLeft` | reason: islek, okeyDiscard, sideTileUnused, okeyTaken; id el içinde 1'den artar. Adaptör `noticeOf`, `renameSeat`; Room'un okey'e özel rename dalı kalktı (replay de renameSeat). |
| Dondurma | `Room.freezeForNotice`, `shared/clock.ts freezeClock`, `useLocalGame.tick` | yeni id → `frozenUntil = now + noticeMs`, saat deadline'ı kaydırılır; bot gecikmesi `max(botDelay, frozenUntil−now)`; view `now = max(now, frozenUntil)` ile donuk. `noticeMs` varsayılanı saat açıksa NOTICE_MS, saatsizde 0. |
| İstemci | `useOkey.quickPlay/createRoom(..., options?)`, `matchOver`; `useLocalGame.begin(name, mode, options?)`, `matchOver` | dış arayüz geriye uyumlu. |
| Bot | `shared/bot.ts chooseDiscard` | işlek olmayan en iyi taşı seçer (tembel kontrol), kalmazsa atar; quickMove de aynı. |

## Testler
Kök `pnpm test`: core 41, shared 104, catalog 61, server 65 = **271** (214 + 57 yeni), art arda iki tam koşu yeşil. `pnpm typecheck` yeşil.
Yeni: `shared/test/a7-rules.test.ts` (34), `packages/catalog/test/okey-options.test.ts` (11), `server/test/notice-freeze.test.ts` (10), `server/test/notice-wire.test.ts` (2).

Değişen mevcut testler (Fable onaylı listeyle aynı, başka değişiklik yok):
- `shared/test/game.test.ts:235` yorum, `:245`, `:276` 107→102, `:266-267` 113→103 (K1)
- `shared/test/pairs.test.ts:147`, `:162` yorum, `:163` 117→107, `:168/:173/:182` 8→3 (K1)
- `shared/test/duz.test.ts:61` ad, `:77-79` çekişten sonra gösterebilir (K5)
- `packages/catalog/test/catalog.test.ts:47-51` yeni alanlar, `:56` tam seçenek, `:66` none→false + varsayılan 5 el→true (K8)
- Fable onayıyla (inceleme 2): sadece test başına süre `20_000` eklendi: `server/test/bot.test.ts` "pairs openers lay only pairs..." ve `packages/catalog/test/clock-equivalence.test.ts` 101 (40 el) ve düz (5 el) taramaları. Gövdeler aynen.

## Açık noktalar / bilinen farklar
1. **12-O-O + 13:** motor bu üçlüyü 12'li set okur (eşit puan, set önce), bu yüzden uç kuralı değil set kuralı uygulanır (alınmaz). Planındaki örnek yerine 10-12-O-O + 13 testi var; ayrıca 12-O-O'nun set okunduğu ayrı testte belgelendi.
2. **v1 istemci (1.0.1):** v1 view'dan `notice/islek/noticeMsLeft`, v1 RoomInfo'dan `matchOver` silinir. Sunucu saati v1 masada da donar ama eski istemcinin geri sayımı donmayı göstermez (görsel fark, süre kaybı yok).
3. **Yük altında yavaş testler (çözüldü: yukarıdaki 20 s süreler):** tam kök koşularında yük altında iki kez mevcut ağır testler 5 s varsayılan süreyi aştı: `server/test/bot.test.ts` "pairs openers lay only pairs..." (`Test timed out in 5000ms`) ve bir kez `packages/catalog/test/clock-equivalence.test.ts` 101/düz taramaları. İkisi de seed'li ve deterministik; tek başına her seferinde geçiyor, sonraki 3 tam koşu yeşil. A/B ölçümünde (bot.test, 3'er koşu) taban 1.9–3.9 s, A7 1.9–2.1 s: ölçülebilir yavaşlama yok. Yeni testlerimden kaynaklanmıyor; düzeltilmedi (Fable'ın gördüğü yükte zaman aşımıyla aynı tür).
4. **Bir eylemde birden çok ceza (inceleme 2):** `GameState.notices` / `PlayerView.notices` = son eylemin yazdığı bütün bildirimler (id sırasıyla; sonraki eylemde boşalır), `notice` = elin son bildirimi (noticeOf). Dondurma = `noticeMs × (yeni id − son görülen id)`: iki ceza → 10 s; `noticeMsLeft` toplam kalanı verir (Room ve useLocalGame). v1'den `notices` de silinir. Sonnet'in arayüzü `notices`'e geçmeli.
5. Karar 4 (eşli) için kod yok; MASTER_PLAN §4c'de not zaten var.
