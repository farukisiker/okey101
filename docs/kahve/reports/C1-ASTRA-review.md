# C1 Tavla motoru: Astra ikinci göz (19.11.2026)

İnceleme sonucu: **1 doğrulanmış kural hatası, 1 performans testi açığı**. Kod değiştirmedim; kaynakları inceledim ve bellekte çalıştırılan somut senaryolarla doğruladım. Tam Vitest paketini çalıştırmadım.

Gösterim: B=Beyaz, S=Siyah; `hane:adet`. Belirtilmeyen haneler boş, bar aksi belirtilmedikçe sıfır; eksik pullar toplanmış.

1. **[P2 — Doğrulandı] Son pulda büyük zar zorunluluğu atlanıyor.**
   Konum: `packages/tavla/src/board.ts:182`, `board.ts:252`, `rules.ts:82`.
   Senaryo: B `{1:1}`, offB=14; S `{24:15}`; sıra B, zar `[1,2]`.
   Beklenen: Yalnız bir zar kullanılabildiğinden 2 zorunlu; 1 reddedilmeli (`docs/oyunlar/tavla.md:83`).
   Gerçek: `maxPlayable` kazanmayı iki zar kullanılmış sayıyor; büyük zar filtresi çalışmıyor ve `step(1,1)` kabul ediliyor.
   Görünüm etkisi: `packages/tavla/src/view.ts:26` aynı hedefi tekilleştirince yalnız `{from:1,to:'off',dice:[1]}` sunuyor.
   Bot etkisi: `packages/tavla/src/bot.ts:175`, `bot.ts:185`; Orta, Zor ve quickMove küçük zarı seçti.
   Kolay botun adaylarında da bu hamle var. Motor kabul etse de belgeye göre yasa dışı.
   Test açığı: `packages/tavla/test/rules.test.ts:212` siyahın aynalı konumunda küçük zarla bitirmeyi zaten kabul ettiriyor.
   Simülasyon yalnız `apply.ok` denetlediğinden bu ortak kural hatasını yakalayamaz (`test/simulation.test.ts:38`).

2. **[P2 — Doğrulandı] Süre testi, her çağrı için 50 ms koşulunu ölçmüyor.**
   Konum: `packages/tavla/test/bot.test.ts:33`, `bot.test.ts:114`; üretimde `src/bot.ts:175`.
   Senaryo: B `{24,22,20,18,16,14,13,11,10,9,8,7,5,4,2}` hanelerinde birer;
   S `{1,3,6,12,15,17,19,21,23}` hanelerinde birer, offS=6; sıra B, zar `[1,1]`.
   Beklenen: Tekil çağrı süreleri değerlendirilerek 50 ms aşımı yakalanmalı.
   Gerçek: Beş ölçümün minimumu kullanılıyor; diğer dört çağrının aşımı testi düşürmüyor. Kolay bot da süre kontrolünde yok.
   `HARD_NODES` yalnız rakip aramasını sınırlıyor; aday üretimi ve sıralama bu bütçenin dışında.
   Yerel sekizer çağrıda maksimumlar Kolay 7,47 / Orta 15,49 / Zor 15,01 ms: **gerçek süre ihlali doğrulamadım**; telefon bütçesi belirsiz.

3. **[Test eksikleri — mevcut davranış doğru]**
   `packages/tavla/test/rules.test.ts:143`: Tam zarla toplamanın geride pul varken serbest olması ayrıca sınanmıyor.
   Senaryo: B `{6:1,3:1}`, S `{24:15}`, zar `[3,2]`; beklenen ve gerçek: 3’teki pul 3 ile toplanabiliyor.
   `packages/tavla/test/rules.test.ts:150`: Siyahın büyük zarla en uzaktaki pulu toplaması ayrıca sınanmıyor.
   Senaryo: S `{21:1,22:1,23:1}`, B `{1:15}`, sıra S, zar `[6,5]`; beklenen ve gerçek: 21’den 6 ile toplama kabul.
   `packages/tavla/test/rules.test.ts:189`: Tek puanın bar/konçina koşuluna üstünlüğü ayrıca sınanmıyor.
   Senaryo: B `{1:1}`, S `{24:13}`, barS=1, offS=1, zar `[2,3]`; beklenen ve gerçek: B bitirince tek, 1 puan.
   `packages/tavla/test/rules.test.ts:218`: Hedefin aşılması sınanmıyor.
   Aynı bitişte önceki toplam `[4,0]`, hedef 5, rakip hiç toplamamışsa mars sonrası `[6,0]`; `matchOver([6,0])` beklenen gibi true.

Diğer kontroller: Azami zar kullanımı, çiftte dört adım, kapalı ara hane, kırık önceliği ve en uzaktaki puldan toplamada ek hata saptamadım. Tek/mars/konçina ayrımı, konçina 2/3 ve maç eşiği doğru görünüyor. `viewFor` normal motor durumlarında seed/rngState taşımıyor (`packages/tavla/src/view.ts:67`). Bitişte ham durumdaki `turn` sayısal kalması hata değil: dondurulmuş sözleşme bunu istiyor; dışarıdaki `turn()` ve görünüm null dönüyor.


## Fable kararı
- Bulgu 1 (son pul, zar [1,2]): kural hatası değil; son pul iki zarla da toplanabiliyor, oyun biter, sonuç ve puan aynı (gnubg da böyle sayar). Davranış testle belgelendi, docs/oyunlar/tavla.md'ye bir cümle eklendi.
- Bulgu 2 (süre testi en iyi 5 ölçümü alıyor): bilinçli (gürültü), yerel en kötü ~15 ms; telefonda ölçüm UI geçişine not.
- Bulgu 3: dört eksik test eklendi (tavla 55 test).
- Çeviri çapraz kontrolü (Codex, ja/ko/zh/hi/ru kart/tavla terimleri): 9 düzeltme uygulandı (ko 2, hi 4, ru 1, zh 2).
