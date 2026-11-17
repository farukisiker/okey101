# C4-OC · `docs/oyunlar/tavla.md`

Görev kâğıdı: `docs/kahve/tasks/C4-CLINE-OC.md`, yalnız **C4b**. Dal: `feat/kahve-oc`.
Kaynak yalnız motor kodu (`packages/tavla/src/*.ts`) ve `docs/kahve/reports/C1-CODEX.md`.
C4a (sim + sızıntı testleri) bu turda yapılmadı; Cline'ın işi.

## Yapılanlar

1. `docs/oyunlar/tavla.md` — 60+ okuyucu için sade Türkçe, `batak.md` ile aynı yapı:
   genel bakış, dizilim, açılış zarı, zar ve hamle (çift zarda 4 hamle), kapı ve kırma,
   kırık pulun önce girmesi, iki zarı oynama zorunluluğu + büyük zar kuralı (iki örnek ve
   tersi), toplama (eşit/büyük zar ve "geride pul varken" örnekleri), oyun sonu, tek/mars/
   konçina puanları, maç sonu, süre, Geri al/Tamam/Pas, bot seviyeleri, AYARLAR tablosu,
   "İlk Sürümde Olmayanlar".
2. `README.md` — "Kurallar (uygulanan hali)" bölümüne Batak'ın altına `### Tavla` alt başlığı:
   tek satır özet + `docs/oyunlar/tavla.md` linki (+5 satır).
3. Bu rapor.

Başka dosyaya dokunulmadı (motor, test, app, sim yok). Komut çalıştırılmadı, commit yapılmadı.

## Motordan birebir alınanlar

| Belge | Kaynak |
|---|---|
| Ayar tablosu: `variant`, `targetScore` (`1/3/5/7`, varsayılan 5), `koncinaPoints` (`2/3`, varsayılan 3) | `options.ts` `defaultOptions` / `normalizeOptions` |
| `variant` her zaman `'klasik'`; bilinmeyen anahtar atılır, bozuk değer varsayılana döner | `options.ts` |
| 30 sn tur, ilk tur 45 sn | `definition.ts` `clock: {baseMs: 30000, firstTurnFactor: 1.5}` |
| Açılış zarı: birer zar, eşitte yeniden, büyük atan başlar ve o iki zarı oynar | `rules.ts` `create` |
| Dizilim 24/13/8/6 = 2/5/3/5, 15 pul, iki tarafta 167 pip | `board.ts` `initialBoard`, C1 raporu (T01) |
| Çift zarda 4 hamle | `dice.ts` `diceToPlay` |
| Kapı (2+ pul), kırma, bar önceliği, beyazın 25−zar / siyahın zar hanesine girişi | `board.ts` `canMove`/`doMove`, `rules.ts` `checkStep` |
| İki zarı oynama zorunluluğu, büyük zar kuralı, artan zarın yanması | `rules.ts` `turnCtx`/`checkStep`, `board.ts` `maxPlayable` |
| Toplama: hepsi evde + bar boş; eşit zar; büyük zar yalnız en yüksek haneden; kırılınca durur | `board.ts` `allHome`/`canMove` |
| Son pulda anında bitiş | `rules.ts` `applyInner` |
| Tek 1 / mars 2 / konçina `koncinaPoints` (varsayılan 3) | `rules.ts` `gameResult` |
| Maç: hedef puana ulaşan kazanır | `scoring.ts` `matchOver` |
| Kolay/Orta/Zor bot | `bot.ts` `choose`, `evaluate`, `HARD_WIDTH`, C1 raporu |
| Hamle ipuçları, tek dokunuşla çok zarlı hedef ("8 (3+5)") | `view.ts` `checkerMoves`, `types.ts` `CheckerMove` |

Örnekler uydurulmadı; motor testlerindeki pozisyonlardan sadeleştirildi: iki zar zorunluluğu
T09, büyük zar + tersi T10, toplamada "geride pul" T14, "büyük zar en yüksek haneden" T15,
çift zarda ara hane T12 (`packages/tavla/test/rules.test.ts`). Hata metinleri motordan
("Büyük zarı oynamalısınız", "Hamleniz tamamlanmadı").

## Notlar

- Belgede süre, bot seviyesi ve `variant` dışındaki hazırlıklar ayar gibi yazılmadı; süre
  `definition.ts` sabiti, bot seviyesi masa seçimi, `variant` normalize ile sabit.
- "İlk sürümde yok": çift zarlama küpü, Gülbara, Tapa. Gülbara/Tapa `options.ts` yorumundaki
  "reserved, not playable" ifadesine dayanıyor; ayrı `variant` değeri tiplerde yok.
- Batak'taki "uzatma eli" benzeri bir bölüm yok: tavlada puan yalnız kazanana yazıldığı için
  beraberlik doğmuyor; belgede bunun yerine bu cümle var.
- Kontrol: tablo değerleri `options.ts` ile karşılaştırıldı; linkler `README.md` içinde
  göreli ve mevcut dosyaya gidiyor.
