# A7-SONNET raporu
Dal feat/kahve-a7s. Tüm A7-OPUS alan erişimleri `app/src/components/a7adapter.ts` içinde (birleşmede gerçek tiplere çevrilecek).

## Yapılanlar
- NoticePanel (GameScreen'de, dokunmayı engellemez, 5 sn, ⚠ + koyu kırmızı/sarı kenar, 26 pt); ilk mount'taki eski bildirim gösterilmez (noticeMsLeft>0 ise gösterilir).
- Geri sayım: useSecondsLeft, noticeMsLeft süresince görüneni sabit tutar, sonra devam eder.
- Yandan alma onayı: 101 + açmamış + ıskarta; tek kapı `draw()` (dokunma ve sürükleme). Evet, al / Vazgeç.
- Lobby maç uzunluğu seçici (6 seçenek, ≥56 dp, sarmalanır, 16 pt), AsyncStorage `okey101.matchEnd`, quickPlay/createRoom `options:{matchEnd}` (düzde yok). Salon'a `matchEnd` prop'u.
- RoundResult: 101'de `matchOver` (adaptör, yoksa false) iken "Maç bitti!" + sıralama, birincil "Yeni maç" (nextRound), ikincil "Masadan kalk".
- i18n: 14 yeni anahtar (tr tam, 12 dilde İngilizce).

## Elle deneme
1. Lobby: 6 seçici görünür, seçim uygulama yeniden açılınca korunur; büyük sistem yazısında iki satıra sarar.
2. 101 masasında açmadan soldan taş al (dokunma ve sürükle): diyalog çıkar; Vazgeç → hiçbir şey; Evet → taş alınır. Düz okeyde ve açtıktan sonra diyalog yok.
3. Bir bot işlek atınca (Opus dalı birleşince) herkeste panel 5 sn, sayaç bu sürede sabit.
4. Maç bitince (Opus `matchOver`) sıralama + Yeni maç / Masadan kalk.
