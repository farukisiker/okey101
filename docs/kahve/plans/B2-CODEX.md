DURUM: ONAYLANDI 2026-11-16 (Fable). Not: publicHistory görünümde kalabilir (açık bilgi; bot sayımı için). Maç toplamları host RoomInfo.totals; eşli [A,B,A,B] host tarafından koltuk başına toplanır (çift sayım yok).

**1) Kapsam**
- B2: `@kahve/pisti` saf TS motoru; 2/4 tekli, 4 eşli, dağıtım/toplama/pişti, puanlama, botlar ve gizli bilgi koruması.
- Bir round, 52 kartlık elin tamamıdır; ara dağıtımlar `apply` içinde, maç toplamları ve yeni el başlatma host’tadır.
- Kapsam dışı: B3, UI, katalog/sunucu entegrasyonu, çekirdek, cards değişikliği; manifest/tsconfig/lockfile Fable’a aittir.
- Bu tur yalnız plan; ORKESTRA §3.3 uyarınca Fable onayından önce işçi başlatılmaz. Astra kod yazmaz.

**2) Alt görevler**

| İş | İşçi | Dosyalar | Komutlar |
|---|---|---|---|
| B2.1 Tipler, ayarlar, kurulum | gpt-6.1-sol | `packages/pisti/src/{types,options,setup}.ts`, `test/setup.test.ts` | Paket test + typecheck |
| B2.2 Hamleler, dağıtım, puan | gpt-6.1-sol | `packages/pisti/src/{rules,scoring}.ts`, `test/rules.test.ts` | Paket test + typecheck |
| B2.3 Görünüm, bot, adaptör | gpt-6.1-sol | `packages/pisti/src/{view,bot,definition,index}.ts`, `test/{view,bot,definition}.test.ts` | Paket test + typecheck |
| B2.4 Kabul ve rapor | gpt-6.1-sol | `packages/pisti/test/{simulation,contract}.test.ts`, `docs/kahve/reports/B2-CODEX.md` | Paket ve kök test + typecheck |

Paket komutları: `corepack pnpm --filter @kahve/pisti test` ve `corepack pnpm --filter @kahve/pisti typecheck`; kök: `corepack pnpm test` ve `corepack pnpm typecheck`.
İşler sırayla yürür; Sol çıktıları raporlar, Astra diff/sahiplik incelemesi yapar ve kabul komutlarını yeniden çalıştırır.

**3) Arayüzler ve dışa aktarımlar**
Tüketilenler: `@kahve/cards` Card/shuffleDeck/deal/sameRank/sortHand; `@kahve/core` GameDefinition/Rng/TurnClock/ViewContext. Dışa aktarım: aşağıdaki tipler ve `pistiDef`.
```ts
type PistiOptions = { seats: 2|4; partnerMode: boolean; targetScore: 51|101|151; hiddenCards: 'reveal'|'secret'; openingJack: 'redraw'|'allow'; pistiPoints: number; jackPistiPoints: number; acePoints: number; jackPoints: number; clubTwoPoints: number; diamondTenPoints: number; mostCardsPoints: number };
type PistiAction = { type: 'play'; cardId: number };
type Capture = { seat: number; cardId: number; isPisti: boolean; isJackPisti: boolean; points: number };
type PublicAction = { turnNumber: number; seat: number; card: Card; revealedCards: Card[] };
type PistiState = { options: PistiOptions; round: number; dealer: number; turn: number; turnNumber: number; phase: 'playing'|'finished'; players: { seat: number; name: string; hand: Card[] }[]; deck: Card[]; centerPile: Card[]; hiddenOpeningCardIds: number[]; captured: Card[][]; pistis: { cardId: number; isJack: boolean }[][]; lastCapturer: number|null; publicHistory: PublicAction[]; lastAction: PublicAction|null; lastCapture: Capture|null; result: { scores: number[] }|null };
type PistiView = { options: PistiOptions; round: number; dealer: number; seat: number; turn: number|null; turnNumber: number; phase: 'playing'|'finished'; hand: Card[]; topCard: Card|null; centerCount: number; deckCount: number; playableCardIds: number[]; players: { seat: number; name: string; team: number; handCount: number; capturedCount: number; pistiCount: number }[]; publicHistory: PublicAction[]; lastAction: PublicAction|null; lastCapture: Capture|null; result: { scores: number[] }|null; clock: TurnClock|null };
```
`pistiDef: GameDefinition<PistiState,PistiAction,PistiView,PistiOptions>`; bütün veri düz JSON, `totalScore` yoktur.
`id='pisti'`, `group='kagit'`, `status='active'`, `seatChoices=[2,4]`, `titleKey='game.pisti'`.
`defaultOptions`: seats=2, partnerMode=false (**4 kişide de**), targetScore=151, hiddenCards='reveal', openingJack='redraw'; puanlar sırasıyla 10/20/1/1/2/3/3.
`normalizeOptions`: bilinmeyen alanları atar, bozuk alanı kendi varsayılanına döndürür; puanlar negatif olmayan güvenli tamsayı; iki kişide eşli kapalı. `seats(opts)=opts.seats`.
`clock={baseMs:30000,firstTurnFactor:2}`; süre host’ta, bot seviyesi `botMove` parametresinde; seçeneklere mükerrer alan eklenmez.
`create`: verilen RNG ile karıştırır; dealer=round%seats, başlangıç=(dealer+1)%seats; ortaya 3 kapalı+1 açık, başlangıç koltuğundan sırayla dörder kart; kalan 40/32.
`openingJack='redraw'`: açık Vale kalan destenin ortasına yerleştirilip sıradaki kart açılır, Vale geldikçe tekrarlanır; kart kaybı/ek RNG yok; 'allow' Vale’yi bırakır.
`isAction`: nesne, type='play', cardId 0..51 tamsayı; bozuk girdide false. `apply`: koltuk/sıra/evre/el üyeliğini doğrular; değiştirmeden yeni state veya `{ok:false,error}` döndürür, kötü girdide fırlatmaz.
`apply`: boş yere kart bırakır; eş değer/Vale dolu ortayı alır; yalnız tek kartta eş değer pişti, J/J vale piştisi; J/diğer normal toplama; açılıştaki dört kart pişti değildir.
`apply`: eller bitince otomatik dörder dağıtır, ortayı korur; deste ve eller bitince artanları son alana piştisiz verir, sonucu hesaplar; lastCapturer=null ise orta kalır, puanlar sıfır.
`turn`: oynarken `{seat:turn,key:turnNumber,first:turnNumber===0}`, bitince null; her hamlede key artar. `refillsClock`: daima false; `noticeOf`: eklenmez.
`renameSeat`: yalnız seçilen oyuncunun adını yeni state’te değiştirir; sıra/RNG değişmez.
`viewFor`: yalnız kendi elini ve açık bilgiyi kopyalar; geçersiz koltukta el/oynanabilir liste boş; playableCardIds sadece kendi sırasında tüm el kimlikleridir; ctx.clock yoksa null.
Görünümde rakip/ortak eli, deste sırası, seed/RNG, ham kasa ve kapalı kimlikler yoktur; reveal ilk toplamayı `lastAction.revealedCards` ve açık geçmişe ekler; secret kimlikleri el sonunda da açılmaz.
`lastCapture` yalnız son gerçek toplamayı anlatır; points yalnız pişti bonusudur (0/10/20 veya ayar), gizli kart değerini sızdırmaz; olay ayrımı lastAction.turnNumber ile yapılır; pistiCount vale piştilerini de içerir.
`botMove`: easy verilen RNG ile rastgele geçerli; medium açık kart sayımı, pişti önceliği, düşük pişti riski ve Vale tasarrufu; hard kalan değer olasılıkları, kasa değeri ve eşli durumu da değerlendirir; yalnız view verisini kullanırlar.
`quickMove`: deterministik pişti/eşleşme/Vale toplama önceliği; alamıyorsa en düşük pişti riski, sonra küçük rank/id; her zaman geçerli hamle.
`roundOver`: phase==='finished'; `scoreRound`: sonuç puanlarının kopyası; kart değerleri ile pişti bonusları ayrı, çoğunluk yalnız tek lidere; eşitlikte çoğunluk puanı yok.
Eşli: 0–2 ve 1–3 kasa/bonusları birleştirilir, çoğunluk takım bazındadır; scoreRound=[A,B,A,B]; görünümde sayaçlar koltuk bazında, team eşli için seat%2, teklide seat.
`matchOver`: tekli toplamlar veya eşlide yalnız temsilciler 0/1 karşılaştırılır; hedefe ulaşmış benzersiz lider varsa true, lider eşitliğinde uzatma; ortak toplamları tekrar toplanmaz, rounds sonucu etkilemez.

**4) Testler, riskler ve açık noktalar**
§9 seçimi: PIS-T01–08 kurulum/toplama; T09–11 kart+pişti puanı; T12–18 dağıtım/son alan/çoğunluk/eşli; T19–22 ret/hedef/uzatma; T23–25 gizlilik/Usta. T04 allow ile, hamle fikstürleri gerçek başlangıç sırasıyla kurulur.
Ek kabul: redraw ardışık Valeler, reveal/secret, seçenek normalizasyonu, quickMove/saat/renameSeat, değişmezlik; 200 seed bot-bot tüm mod/seviye dağılımında tamamlanma, 52 kart korunumu ve sıfır geçersiz hamle.
JSON gidiş-dönüş sonrası aynı devam/sonuç; gizli kart permütasyonlarında aynı view ve aynı RNG ile aynı bot kararı; olay/geçmiş/puan üzerinden sızıntı yok. Kapsam ≥%85; ölçüm yoksa test–kural eşleme tablosu.
Riskler: eski ön tasarımın 20000 saati/4 kişide eşli varsayımı geçersiz; PROMPT_LOCAL + Fable notları esas. Secret kartların puanı yalnız sonuçta açıklanır; eşli puanın host’ta iki kez toplanmaması entegrasyon sözleşmesidir.

**5) Tahmini commit listesi**
`feat(pisti): add options and deterministic setup` → `feat(pisti): implement captures and scoring` → `feat(pisti): add private views bots and game definition` → `test(pisti): verify simulations privacy and contracts`.
Sol commit’siz bırakır; Astra review sonrası Fable commit eder (**yazar: Sol, inceleyen: Astra**).