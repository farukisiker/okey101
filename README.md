# Okey 101

iOS ve Android için 4 kişilik çok oyunculu Okey 101. Boş koltuklara bot oturur.

```
shared/  Oyun kuralları (saf TypeScript, arayüzden bağımsız) + Vitest testleri
server/  Node + Express + Socket.io, otoriter oyun sunucusu, oda/sıra yönetimi, bot
app/     Expo + React Native arayüzü (yatay ekran, sürükle-bırak ıstaka)
```

## Çalıştırma

```bash
pnpm install
pnpm server            # :3001 (PORT, BOT_DELAY_MS, TURN_TIMEOUT_MS ile ayarlanır)
pnpm app               # Expo; telefonda Expo Go / dev build ile aç
pnpm test              # shared + server testleri
pnpm typecheck         # tüm paketler
```

Telefondan bağlanırken sunucu adresi `localhost` olamaz: lobideki "Sunucu"
alanına bilgisayarın yerel IP'sini yaz (ör. `http://192.168.1.20:3001`) ya da
`EXPO_PUBLIC_SERVER_URL` ile başlat. Android emülatöründe `http://10.0.2.2:3001`.

> Not: `.npmrc` içinde `node-linker=hoisted` var; pnpm 11+ bu ayarı
> `pnpm-workspace.yaml` içinden okuduğu için orada da `nodeLinker: hoisted` var.

## Mimari

- Sunucu otoriterdir: tüm oyun durumu sunucudadır. İstemci yalnızca hamle
  (`draw`, `open`, `meld`, `addToMeld`, `discard`) gönderir ve kendi elini görür
  (`viewFor` diğer oyuncuların elini göndermez).
- Kural motoru `shared/src/game.ts` içinde saf bir reducer'dır
  (`applyAction(state, seat, action)`); sunucu ve botlar aynı kodu kullanır.
- Istakadaki dizilim istemcide kalır; yan yana duran taşlar bir grup sayılır,
  "Aç" bu grupları sunucuya gönderir.

## Kurallar (uygulanan hali)

- 106 taş: 4 renk × 1–13 × 2 set + 2 sahte okey.
- Gösterge açılır, okey = göstergenin bir üstü (13 ise 1).
- Başlayan 22, diğerleri 21 taş alır; başlayan taş çekmeden atar.
- Per: aynı sayı farklı renk (3–4 taş) ya da aynı renk ardışık seri (en az 3);
  13-1 geçişi yok.
- Okey joker yerine geçer; sahte okey, okey taşının kendisi (renk/sayı) olarak oynar.
- Açma: per/serilerle en az 101 sayı. Açtıktan sonra yeni per indirilebilir ve
  masadaki perlere taş işlenebilir. Atmak için elde en az bir taş kalmalıdır.
- Sıra: ortadan ya da soldaki oyuncunun son attığı taştan çek, bir taş at.
  Yerden alınan taş o el kullanılmazsa +101 ceza; aynı taş geri atılamaz.
- Ortadaki taşlar bitince el berabere biter.
- Puan (düşük iyi): bitiren −101; açmış oyuncular elde kalan taşların toplamı
  (elde kalan okey 101); açamayan 202. Okeyle bitirmek ve elden bitirmek
  (aynı elde açıp bitirmek) puanları ayrı ayrı ikiye katlar.
- Sırasını süresinde (varsayılan 60 sn) oynamayan oyuncu için otomatik çek-at
  yapılır; bağlantısı kopan oyuncunun yerine bot oynar, geri gelince koltuğunu alır.

Kapsam dışı (şimdilik): çift açma, okeyi masadan geri alma, işlenebilir taşı
atma cezası.
