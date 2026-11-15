GÖREV: A7-OPUS  FAZ: A (okey kural güncellemesi, kullanıcı kararı 15.11.2026)
AMAÇ: Kullanıcının onayladığı okey kural değişikliklerini, ceza bildirimini (GameNotice) ve bildirim süresince saat/bot dondurmayı uygulamak.
OKU: docs/kahve/MASTER_PLAN.md §4c (sorular) ve aşağıdaki KARARLAR, packages/game-core/src/types.ts (GameNotice, NOTICE_MS, noticeOf, renameSeat: yeni),
     shared/src/{game,melds,tiles,bot,duz}.ts, shared/test/*, packages/catalog/src/okey.ts, server/src/room.ts, app/src/net/{useLocalGame,useOkey}.ts,
     docs/kahve/arastirma/KURALLAR_argon.md Bölüm 0.1 ve OYUN 1 §3–4 (bilgi için; bağlayıcı olan KARARLAR'dır)
SÖZLEŞME: types.ts @ 07b7842 (değiştirme)
WORKTREE: C:/Users/mfaru/okey101/kahve-a7 (dal feat/kahve-a7)
SAHİP OLDUĞUN YOLLAR: shared/src/** ve shared/test/** (kullanıcı onayıyla bu görev için açık), packages/catalog/src/okey.ts + catalog testleri,
     server/src/**, app/src/net/**, yeni test dosyaları
DOKUNMA: types.ts, protocol.ts, app ekranları/bileşenleri (Sonnet: A7-SONNET), i18n dosyaları, package.json, lockfile

KARARLAR (kullanıcı):
1. Elde kalan gerçek okey (açmış oyuncu, el sonu), kullanıcının sözü: "Elinde kalan sayı + okey cezası olacak".
   Ceza = (okey dışındaki taşların toplamı) × bugünkü çarpanlar + her okey için 101. Okeyin kendi sayı değeri toplama EKLENMEZ.
   Örnek: el 3 + 5 + okey → (3+5) × çarpan + 101. İki okey → toplam + 202. Sahte okey değişmez (okeyin sayısını yazar).
2. Elden: değişmez (masada başka kimse açmamışken).
3. Yandan alınan taşla açamamak: kural değişmez (alır, açamazsa +101). Onay diyaloğu Sonnet'te (istemci). Sende: bot bu kararı bugünkü gibi verir.
4. Eşli 101: ortağın perine işlemek için kendisi açmış olmalı. Eşli mod henüz yok: sadece MASTER_PLAN'a not, kod yok.
5. Düz gösterge: ilk turunda taş atana kadar her an (taş çektikten sonra da). `canShowIndicator` buna göre; bot da faydalanır.
6. Seri ucundaki okey: sayı sınırı yönü kesinleştiriyorsa alınır. Örnek: Mavi 11-12-Okey → okey 13'tür, Mavi 13 işleyen okeyi alır;
   Okey-Mavi 2-3 → okey 1'dir, Mavi 1 alır. Okey-Mavi 5-6 gibi iki yöne okunabilen uç okey alınmaz (bugünkü gibi). Ortadaki okey kuralı aynen.
   Okey alma cezası (`OKEY_TAKEN_PENALTY`, ev kuralı) ve çiftteki okeyin alınamaması aynen.
7. İşlek: masadaki açık bir pere işlenebilecek taşı yere atmak +101 ceza. Ayar `islek: 'off' | 'opened' | 'all'`, VARSAYILAN 'opened'
   (sadece açmış oyuncu; açmamış oyuncu zaten işleyemez). Çift perlere taş işlenmediği için onlar işlek sayılmaz. Bitiş taşı ve okey atma kendi kurallarında kalır.
8. 101 maç sonu: ayar `matchEnd: { kind: 'none' } | { kind: 'hands'; n: 5 | 7 | 11 } | { kind: 'points'; limit: 501 | 1001 }`.
   VARSAYILAN `{ kind: 'hands', n: 5 }` (Fable önerisi, kullanıcıya bildirilecek). 'points': biri limite ulaşınca biter. Düz okeyin maç sonu değişmez.
   Ayarlar `OkeyOptions` içinde (`normalizeOptions` bozuk girdiyi varsayılana çevirir).

CEZA BİLDİRİMİ:
- Her canlı ceza (el içinde yazılan: işlek, okey atma, yandan alınıp kullanılmayan taş, okeyi alınan perin sahibi) GameState'e bir bildirim yazar:
  `{ id, seat, reason, amount }`, reason kodları TAM OLARAK: 'islek' | 'okeyDiscard' | 'sideTileUnused' | 'okeyTaken'. id el içinde 1'den artar.
- `PlayerView.notice: GameNotice | null` (son bildirim; herkes görür). Okey adaptörü `noticeOf` ve `renameSeat` uygular; Room'daki okey'e özel rename dalı kalkar.
- Host dondurma (Room ve useLocalGame): yeni bildirim id'si görülünce NOTICE_MS boyunca sıradaki oyuncunun saati durur (kalan süre korunur, sonra devam),
  botlar ve otomatik hamle de bekler. View'da `turnMsLeft` donmuş değeri gösterir; ek alan `noticeMsLeft?: number` istemci paneli için.
  RoomOptions'a `noticeMs` (varsayılan NOTICE_MS); mevcut testler DEĞİŞMEDEN yeşil kalmalı: süre gerekirse saat kapalıyken (`turnTimeoutMs: 0`)
  dondurmanın botları bekletmemesi önerisini planında değerlendir.
- v1 istemci (mağazadaki 1.0.1) yeni alanları yok sayar; compat-v1 testleri değişmeden geçmeli. Eski istemcide geri sayım donmayı göstermez: bilinen fark, rapora yaz.
- İstemci kancaları: `OkeyClient.quickPlay(name, mode, options?)` ve `createRoom(..., options?)` isteğe bağlı `options` alır (protokol v2 `options` alanı);
  useLocalGame de alır. Dış arayüz geriye uyumlu.

BOT: işlek atmaktan kaçınır (mümkünse; başka taş yoksa atar), uçtaki kesin okeyi alır, Düz'de göstergeyi taş çektikten sonra da gösterebilir.

TEST (hepsi zorunlu): her karar için birim testleri (1, 5, 6, 7 kapsamı ve sınırları, 8'in tüm seçenekleri), bildirim id/alanları, viewFor'da notice,
dondurma (sahte zamanlayıcı ile: saat durur, NOTICE_MS sonra kalan süreyle devam, bot beklemesi), bot işlek kaçınma (seed'li senaryo), adaptör eşdeğerliği hâlâ yeşil.
Mevcut testlerden davranışı bilerek değişen (ör. okey eldeyken puan) olursa: testi değiştirmeden önce planında madde madde listele, Fable onaylar.
KABUL: kökte `pnpm test` ve `pnpm typecheck` yeşil, test sayısı ≥ 214 + yeniler.
SÜREÇ: Önce plan (≤25 satır) → Fable onayı → kod. Küçük commit'ler feat/kahve-a7, push YOK. Rapor: docs/kahve/reports/A7-OPUS.md
