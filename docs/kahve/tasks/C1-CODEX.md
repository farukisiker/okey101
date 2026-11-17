GÖREV: C1-CODEX  FAZ: C
AMAÇ: `@kahve/tavla` saf TS klasik tavla motoru (GameDefinition uygular): hamle dizisi üretimi, zorunlu iki zar / büyük zar, kırık pul önceliği, toplama kuralları, mars/konçina, seed'li zar, Acemi/Orta/Usta bot.
OKU: PROMPT_LOCAL.md §3 "C Aşaması" (BAĞLAYICI), docs/kahve/arastirma/KURALLAR_argon.md OYUN 9 (yalnız Klasik; Gülbara/Tapa YOK) ve §9 testleri (T01, T04–T19, T25),
     docs/kahve/MASTER_PLAN.md §5, packages/game-core/src/{types,rng,clock}.ts, packages/batak/src/* (adaptör ve bot örneği), ORKESTRA §2–3
SÖZLEŞME: packages/tavla/src/types.ts (C0, Fable, DONDURULDU) ve packages/game-core/src/types.ts. Değiştirme; eksik → docs/kahve/requests/codex-tavla-<konu>.md
WORKTREE: C:/Users/mfaru/okey101/kahve-codex (önce `git merge feat/kahve`)
SAHİP OLDUĞUN YOLLAR: packages/tavla/src/** (types.ts hariç), packages/tavla/test/**, docs/kahve/reports/C1-CODEX.md
DOKUNMA: types.ts dosyaları, shared/**, server/**, app/**, packages/catalog/**, diğer paketler, package.json, lockfile

KURALLAR (bağlayıcı özet):
- Dizilim: Beyaz (koltuk 0) 24:2, 13:5, 8:3, 6:5 → 1'e doğru, ev 1..6. Siyah (koltuk 1) 1:2, 12:5, 17:3, 19:5 → 24'e doğru, ev 19..24. points[p] >0 beyaz, <0 siyah.
- Açılış: `create` her koltuğa birer zar atar, eşitse yeniden; büyük atan başlar ve bu iki zarı oynar (dice = [koltuk0 zarı, koltuk1 zarı], openingRoll aynı).
  Her oyun (round) böyle başlar. Zarlar yalnız `rngState` üzerinden (create'in rng'sinden tohumlanan mulberry32 sayacı; Math.random YOK).
- Hamle: kapıya (rakibin ≥2 pulu) basılamaz; tek rakip pulu kırılır → bar. Barda pul varken önce hepsi girer (Beyaz 25-zar, Siyah zar hanesine).
- Zorunluluk: mümkünse iki zar (çiftte mümkün olan en çok, en fazla 4) oynanır; yalnız biri oynanabiliyorsa büyük zar zorunlu (yalnız küçük oynanabiliyorsa küçük).
  `step` ancak oynanan kısım bir yasal azami dizinin öneki kalıyorsa kabul. `commit` ancak tam yasal dizide (hiç hamle yoksa 0 adımla "Pas").
- Toplama: 15 pulun hepsi evde iken; zar tam haneye denk gelirse o haneden; o hane boşsa ve geride pul varsa ev içinde ilerletmek zorunlu;
  geride pul yoksa en gerideki haneden toplar. Toplarken kırılan pul eve dönene kadar toplama durur.
- Bitiş: 15 pulu toplayan kazanır. Rakip ≥1 topladıysa tek (1); hiç toplamadıysa mars (2); hiç toplamadı VE kazananın evinde veya barda pulu varsa konçina (koncinaPoints).
  Çift zarlama küpü yok. scoreRound = [p,0] / [0,p]. matchOver: herhangi toplam ≥ targetScore.
- Sıra: commit → lastTurn kaydı, turnNumber++, sıra rakibe, rakibin zarı hemen atılır (turnStart = board). Kazanma anında phase 'finished', turn null.
- Undo: son adımı geri alır (turnStart + steps[0..n-2] yeniden oynanır), commit'e kadar sınırsız.

GameDefinition (`tavlaDef`): id 'tavla', group 'tavla', status 'active', seatChoices [2], titleKey 'game.tavla', seats()=2.
  defaultOptions {variant:'klasik', targetScore:5, koncinaPoints:3}; normalizeOptions bilinmeyeni atar, bozuk alanı varsayılana döndürür, variant daima 'klasik'.
  clock {baseMs:30000, firstTurnFactor:1.5}. turn → {seat, key: turnNumber, first: turnNumber===0}; refillsClock false; noticeOf yok; renameSeat yalnız adı değiştirir.
  isAction: bozuk girdide false (from 'bar' ya da 1..24 tamsayı, die 1..6). apply hiç fırlatmaz, girdiyi değiştirmez; hatada {ok:false,error}.
  viewFor: rngState ASLA; pips her koltuk için; moves/canCommit/mustPass/canUndo yalnız kendi sırasında (değilse boş/false); geçersiz koltukta seat -1; ctx.clock yoksa null.
  `moves`: önce yasal tek adımlar, sonra aynı pulun art arda zarlarla gidebildiği hedefler (her biri yasal azami dizinin öneki; ara hane kapalıysa yok). Yinelenen (from,to) bir kez, en kısa zar listesiyle.
  botMove (her çağrıda TEK aksiyon döndürür: sıradaki adım ya da commit; mevcut adımlardan devam eden dizileri değerlendirir):
    easy: rng ile rastgele yasal tam dizi. medium: pozisyon değerlendirmesi (yarış/pip farkı, açık pul cezası (vurulma olasılığı × uzaklık), kapı ve blok ödülü, ev kapıları, kırık rakip ödülü).
    hard: medium değerlendirmesi + rakibin 21 zar olasılığı üzerinden 1 zar derinliğinde beklenen değer. Hamle başına < 50 ms (orta sınıf telefonda; testte Node'da ölç).
  quickMove: deterministik; tam dizi tamamsa commit, değilse mevcut adımları sürdüren ilk yasal dizinin sıradaki adımı, hamle yoksa commit.

KABUL: `corepack pnpm --filter @kahve/tavla test` + typecheck yeşil; KURALLAR §9 T01, T04–T19, T25 (+ zorunlu iki zar ve büyük zarın ters durumları, çift zarda kapalı ara hane,
  toplamada kırılma, konçina 2/3, mars) testleri; seed'li bot-bot 200 oyun (her seviye karışık) geçersiz hamle 0, 30 pul korunumu, her oyun biter;
  JSON gidiş-dönüş sonrası aynı devam; viewFor'da rngState yok (JSON metninde de); aynı seed aynı zarlar; hamle üretimi 50 ms altı ölçümü (en kötü: çift zar, çok pul); kapsam ≥ %85
  (ölçüm yoksa test–kural eşleme tablosu). Kökte test/typecheck yeşil.
SÜREÇ: Astra önce plan (docs/kahve/plans/C1-CODEX.md, ≤40 satır) → Fable onayı → Sol yazar → Astra review → Fable commit (yazar: Sol, inceleyen: Astra). Rapor: docs/kahve/reports/C1-CODEX.md.
