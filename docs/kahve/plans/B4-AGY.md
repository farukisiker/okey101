DURUM: ONAYLANDI 2026-11-16 (Fable), notlarla:
1. GameShell artık feat/kahve'de (B6 birleşti; bu dala merge edildi): `app/src/components/GameShell.tsx` (+ `roundSummary.ts`, `SummaryTable.tsx`).
   PistiScreen/BatakScreen kendi başlık ve el sonu ekranını YAZMAZ; GameShell'i kullanır (title, secondsLeft, opponents slotu, status, summary, notice).
   Ekranlar oyun alanı + rakip panelleri + durum satırı + Hand verir. `hideHeader` gerekmez.
2. Batak ilk sürüm: sadece ihaleli tekli (BidDialog + TrumpDialog). Koz Maça / Eşli UI'si YAPILMAZ (motor da ilk sürümde yok).
3. i18n: bu görev için istisna: yeni anahtarları doğrudan `app/src/i18n/tr.ts` ve `locales/en.ts`'e (gerçek Türkçe/İngilizce), diğer 11 dile İngilizce yer tutucu olarak ekle
   (A5 düzeni: dosya sonunda `// Kartlar (B4): English placeholder, translated in phase D`). Ekranlarda düz Türkçe metin YOK, hepsi `t()` ile. i18n-istek-agy.md gerekmez.
4. Sesler cardSfx.ts üzerinden kalsın (feedback.ts değişmez). Ses üretim betiğini repoya koyma; sadece .wav'lar.
5. "Kartı Oyna" ana düğmesi + iki dokunuş birlikte olabilir; ikisi aynı onPlayCard'a gider.

# B4-AGY Lider Planı: Kart Görselleri (`CardView`, `Hand`) ve Pişti / Batak Oyun Ekranları

> **Lider:** Argon (`gemini-4-argon-high`)  
> **İşçi Model:** Flash (`gemini-3.8-flash-high`)  
> **Worktree / Dal:** `C:/Users/mfaru/okey101/kahve-agy` (`feat/kahve-agy`)  
> **Görev Kâğıdı:** `docs/kahve/tasks/B4-AGY.md`

---

## 1) Anladığım Kapsam (En Fazla 5 Madde) ve Kapsam Dışı

### Anladığım Kapsam
1. **SVG'siz Kart Görselleri ve El Bileşeni (`app/src/components/cards/**`):** `react-native-svg` veya yeni bir native modül **eklemeden**, yalnızca React Native `View`, `Text` ve Unicode takım sembolleri (`♠ ♥ ♦ ♣`) ile en az okey taşı (`TileView`) büyüklüğünde ve okunaklılığında `CardView`, `CardBack` ve `Hand` bileşenlerini geliştirmek. `Hand` bileşeninde 60+ yaş ergonomisine uygun **iki aşamalı dokunma** (ilk dokunuş kartı seçer ve yukarı kaldırır, ikinci dokunuş oynar), isteğe bağlı sürükle-bırak (`DragSource` + `dropZones` kalıbı) ve oynanamayan kartları (`legalCardIds` dışındakileri) sönükleştirme (`opacity: 0.42`) desteği sunmak.
2. **Pişti Oyun Ekranı (`app/src/screens/PistiScreen.tsx`):** 2 veya 4 kişilik (tekli/eşli) Pişti masası; ortada en üst kartı açık ve altındaki kart sayısını büyük rozetle (`"Yerde: N kart"`, tek kart varken `"Pişti fırsatı!"`) gösteren orta yığın, rakip panelleri (eldeki kart sayısı, toplanan kart sayısı, yapılan pişti sayısı), durum/puan satırı, eldeki eşleşen kart vurgusu ve `"PİŞTİ! (+10 / +20)"` kutlama bandı.
3. **Batak Oyun Ekranı ve Diyaloglar (`app/src/screens/BatakScreen.tsx`, `BidDialog.tsx`, `TrumpDialog.tsx`):** 4 koltuklu Batak masası; ortada 4 oyuncunun attığı kartları koltuk yönüne göre gösteren el alanı (`TrickArea`), üst şeritte sabit koz ve ihale göstergesi (`"Koz: ♠ Maça · İhale: İsim (7)"`), oyuncu panellerinde `"Aldığı: W / B"` el sayaçları, `≥ 56 dp` dokunma hedefli **İhale Diyaloğu** (`minBid..13` ve `"Pas"`) ile 4 dev takım düğmeli **Koz Seçim Diyaloğu** (`♠ Maça`, `♥ Kupa`, `♦ Karo`, `♣ Sinek`).
4. **Sahte Veri Katmanı ve Geliştirme Önizleme Ekranı (`fakeTypes.ts`, `cards-preview/**`):** `@kahve/cards`, `@kahve/pisti` ve `@kahve/batak` motorları birleşene kadar `B1-CODEX.md` sözleşmesiyle (`Suit = 'S'|'H'|'D'|'C'`, `Rank = 2..14`, `Card = { id: number; suit: Suit; rank: Rank }`) birebir uyumlu tek merkezli `fakeTypes.ts` oluşturmak ve tüm durumları (Pişti 2/4 kişi, Pişti anı, Batak ihale/koz/löve/el sonu) test etmeye yarayan bağımsız `CardsPreviewScreen.tsx` bileşenini yazmak.
5. **Sesler, 60+ Erişilebilirlik ve i18n Önerileri (`card-*.wav`, `i18n-istek-agy.md`):** Yeni bağımlılık eklemeden her biri `< 50 KB` boyutunda `card-play.wav` (kart atma) ve `card-take.wav` (kart/el toplama) ses dosyalarını üretip `feedback.ts`'teki mevcut ses/titreşim ayarına (`isSoundOn()`, `buzz()`) bağlamak; **1280×800 yatay tablette (ALFA_8TX)** ve **6 inç yatay telefonda** sıfır taşma, `≥ 15 pt` yazı, `≥ 56 dp` dokunma hedefi kurallarını doğrulamak; yeni çeviri anahtarlarını `docs/kahve/i18n-istek-agy.md` dosyasına yazmak.

### Kapsam Dışı (Dokunulmayacaklar)
- **Oyun Motorları ve Sunucu:** `shared/**`, `server/**`, `packages/**` (saf kural motorları Codex ve Opus'un sorumluluğunda; UI katmanı kural hesaplamaz, yalnızca `view` verisini gösterir ve `onAction(a)` çağırır).
- **Ağ, Kök Gezinme ve Mevcut Okey Kodu:** `app/src/net/**`, `app/src/App.tsx`, `app/src/screens/GameScreen.tsx`, `TileView.tsx`, `Rack.tsx` ve diğer okey bileşenlerine dokunulmaz (`cards-preview` ve ekranları `App.tsx`'e bağlamak B5'te Opus'un işidir).
- **Dil Dosyaları ve Paket Yapılandırması:** `app/src/i18n/**` dosyalarına doğrudan yazılmaz; `package.json`, `pnpm-workspace.yaml` ve `pnpm-lock.yaml` değiştirilmez (`react-native-svg` dahil hiçbir paket eklenmez).
- **Git Push / Merge:** Uzak depoya (`origin`) push veya başka dala merge yapılmaz.

---

## 2) Alt Görevler Tablosu

| Alt Görev | İşçi Model | Dosyalar | Çalıştıracağı Komut |
| :--- | :--- | :--- | :--- |
| **B4.1 — Sahte Tipler, Ölçü Hesaplayıcısı ve `<50 KB` Sesler** | `gemini-3.8-flash-high` | `app/src/components/cards/fakeTypes.ts`<br>`app/src/components/cards/cardLayout.ts`<br>`app/src/components/cards/cardSfx.ts`<br>`app/assets/sounds/card-play.wav`<br>`app/assets/sounds/card-take.wav` | `corepack pnpm --filter app typecheck` |
| **B4.2 — `CardView`, `CardBack` ve `Hand` Bileşenleri** | `gemini-3.8-flash-high` | `app/src/components/cards/CardView.tsx`<br>`app/src/components/cards/Hand.tsx`<br>`app/src/components/cards/index.ts` | `corepack pnpm --filter app typecheck` |
| **B4.3 — `PistiScreen` ve Pişti Masa Bileşenleri** | `gemini-3.8-flash-high` | `app/src/components/cards/CardOpponentPanel.tsx`<br>`app/src/components/cards/PistiCenterPile.tsx`<br>`app/src/screens/PistiScreen.tsx` | `corepack pnpm --filter app typecheck` |
| **B4.4 — `BatakScreen`, `TrickArea` ve İhale/Koz Diyalogları** | `gemini-3.8-flash-high` | `app/src/components/cards/BidDialog.tsx`<br>`app/src/components/cards/TrumpDialog.tsx`<br>`app/src/components/cards/TrickArea.tsx`<br>`app/src/screens/BatakScreen.tsx` | `corepack pnpm --filter app typecheck` |
| **B4.5 — `cards-preview` Ekranı, i18n İstekleri ve Rapor** | `gemini-3.8-flash-high` | `app/src/screens/cards-preview/mockData.ts`<br>`app/src/screens/cards-preview/CardsPreviewScreen.tsx`<br>`docs/kahve/i18n-istek-agy.md`<br>`docs/kahve/reports/B4-AGY.md` | `corepack pnpm --filter app typecheck` (`+ kökte corepack pnpm typecheck && corepack pnpm test`) |

---

## 3) Bileşen Ağacı, Kesin TypeScript Props Tipleri ve Ekran Ölçüleri (dp)

### 3.1 Bileşen Ağacı

```
app/src/
├── components/cards/
│   ├── fakeTypes.ts            # @kahve/cards, @kahve/pisti, @kahve/batak birleşene kadar tek tip/veri kaynağı
│   ├── cardLayout.ts           # useCardGameLayout(handCount): 1280x800 tablet ve 6" telefon dp hesaplayıcısı
│   ├── cardSfx.ts              # card-play.wav & card-take.wav oynatıcı (feedback.ts isSoundOn/buzz uyumlu)
│   ├── CardView.tsx            # CardView (açık kart) + CardBack (kapalı sırt) — saf View/Text/Unicode
│   ├── Hand.tsx                # Eldeki kartlar: 1. dokunuş kaldırır, 2. dokunuş oynar + DragSource + sönük kartlar
│   ├── CardOpponentPanel.tsx   # Pişti/Batak rakip paneli (kart sayısı, kasa/pişti veya alınan el/ihale, süre saati)
│   ├── PistiCenterPile.tsx     # Pişti orta yığın (üst kart açık, altındaki kart sayısı rozeti, bırakma hedefi)
│   ├── TrickArea.tsx           # Batak 4 koltuklu orta löve alanı (Güney/Doğu/Kuzey/Batı kart yuvaları)
│   ├── BidDialog.tsx           # Batak İhale Diyaloğu (4/5..13 + Pas, ≥56 dp düğmeler)
│   ├── TrumpDialog.tsx         # Batak Koz Seçim Diyaloğu (4 büyük takım düğmesi: ♠ ♥ ♦ ♣)
│   └── index.ts                # Dışa aktarımlar
├── screens/
│   ├── PistiScreen.tsx         # Pişti oyun ekranı (Başlık · Orta Yığın & Kasa Özeti · Eylem/Durum · Hand)
│   ├── BatakScreen.tsx         # Batak oyun ekranı (Başlık+Koz · TrickArea · Eylem/Durum · Hand + Diyaloglar)
│   └── cards-preview/
│       ├── mockData.ts         # Pişti (2/4 kişi, pişti anı) ve Batak (ihale, koz, löve, el sonu) sahte durumları
│       └── CardsPreviewScreen.tsx # Geliştirme önizleme ve durum geçiş ekranı
```

### 3.2 Kesin TypeScript Tip ve Props İmzaları

```ts
// app/src/components/cards/fakeTypes.ts
import type { GameNotice } from '@kahve/core';
import type { ViewStyle } from 'react-native';

/** B1-CODEX @kahve/cards ile birebir aynı temel tipler */
export type Suit = 'S' | 'H' | 'D' | 'C';
export type Rank = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14; // 11=J, 12=Q, 13=K, 14=A

export interface Card {
  id: number;   // 0..51 benzersiz sabit kimlik
  suit: Suit;
  rank: Rank;
}

// ---- 1. CardView & CardBack ----

export interface CardViewProps {
  card: Card;
  /** Kartın dp cinsinden dış genişliği (yükseklik = Math.round(width * 1.38)). */
  width: number;
  /** İlk dokunuşta seçilmiş (yukarı kalkmış ve altın çerçeveli) durum. */
  selected?: boolean;
  /** Oynanamayan kart (Batak'ta geçerli hamleler dışında kalan): %42 opaklık ve hafif aşağıda. */
  disabled?: boolean;
  /** Pişti'de yerdeki kartı alabilen / pişti yapabilen kart için yeşil çerçeve ipucu. */
  highlighted?: boolean;
  /** Kartın üst köşesinde kısa rozet (ör. Pişti'de "PİŞTİ" veya "+3"). */
  badgeText?: string;
  style?: ViewStyle;
}

export interface CardBackProps {
  width: number;
  /** Deste/yığın üzerinde gösterilecek kart adedi etiketi. */
  count?: number;
  style?: ViewStyle;
}

// ---- 2. Hand ----

export interface HandProps {
  cards: Card[];
  /** Kart genişliği (dp). */
  cardWidth: number;
  /** Kartlar arası yatay adım (dp); 13 kartlı Batak'ta dar ekranlarda hafif bindirme sağlar. */
  cardStep: number;
  /** Şu an seçili (havaya kalkmış) kartın id'si. */
  selectedCardId: number | null;
  /** Sıra oyuncuda mı? False ise dokunuş sadece seçer veya devre dışıdır, kart oynatmaz. */
  canPlay: boolean;
  /** Motorun bildirdiği oynanabilir kart id listesi (yalnızca görsel ipucu; dışındakiler soluk). */
  playableCardIds?: readonly number[];
  /** Pişti'de yerdeki kartla eşleşen (yeşil vurgulu) kart id listesi. */
  highlightedCardIds?: readonly number[];
  /** Sürükle-bırak hedef bölge anahtarı (ör. 'center-pile' veya 'trick-area'). */
  dropZoneKey?: string;
  /** İlk dokunuşta kart seçildiğinde / seçim kaldırıldığında çağrılır. */
  onSelectCard(cardId: number | null): void;
  /** Seçili karta ikinci kez dokunulduğunda veya hedef bölgeye bırakıldığında çağrılır. */
  onPlayCard(cardId: number): void;
  /** Güvenli alan alt ve yan taşma payları (ahşap/koyu şerit ekran kenarına kadar uzanır). */
  bleedLeft?: number;
  bleedRight?: number;
  bleedBottom?: number;
}

// ---- 3. PistiScreen Tipleri ve Props ----

export interface PistiPlayerPublic {
  seat: number;
  name: string;
  handCount: number;
  capturedCount: number;
  pistiCount: number;
  totalScore: number;
  connected?: boolean;
  isBot?: boolean;
}

export interface PistiLastCapture {
  seat: number;
  card: Card;
  isPisti: boolean;
  isJackPisti: boolean;
  pointsEarned: number; // Normal pişti 10, Vale piştisi 20
  capturedCount: number;
}

export interface PistiRoundResult {
  scores: number[];          // Bu el alınan puanlar
  totals: number[];          // Maç toplam puanları
  winnerSeats: number[];     // Eli/maçı önde bitiren koltuk(lar)
  matchOver: boolean;
  breakdown?: {
    seat: number;
    cardsCount: number;
    pistiPoints: number;
    cardPoints: number;
    majorityBonus: number;
  }[];
}

export interface PistiView {
  phase: 'playing' | 'finished';
  seat: number;
  turn: number;
  seats: 2 | 4;
  partnerMode: boolean;
  targetScore: number;
  hand: Card[];
  deckCount: number;
  /** Ortadaki yığında bulunan toplam kart sayısı (açık üst kart dahil). */
  centerCount: number;
  /** Ortadaki yığının en üstündeki açık kart (yığın boşsa null). */
  topCard: Card | null;
  /** Oyuncunun elinde şu an oynanabilir kart kimlikleri. */
  playableCardIds: number[];
  players: PistiPlayerPublic[];
  lastCapture: PistiLastCapture | null;
  turnMsLeft?: number | null;
  noticeMsLeft?: number;
  notices?: GameNotice[];
  result: PistiRoundResult | null;
}

export type PistiAction = { type: 'play'; cardId: number };

export interface PistiScreenProps {
  view: PistiView;
  seat: number;
  onAction(action: PistiAction): void | Promise<void>;
  onNextRound?(): void | Promise<void>;
  onLeave?(): void;
}

// ---- 4. BatakScreen ve Diyalog Tipleri & Props ----

export interface BatakPlayerPublic {
  seat: number;
  name: string;
  handCount: number;
  tricksWon: number;
  bid: number | null;        // null = henüz konuşmadı, 0 = Pas, 4..13 = teklif
  passed: boolean;
  totalScore: number;
  connected?: boolean;
  isBot?: boolean;
}

export interface TrickCard {
  seat: number;
  card: Card;
}

export interface BatakRoundResult {
  scores: number[];
  totals: number[];
  winnerSeats: number[];
  matchOver: boolean;
  declarerSeat: number | null;
  contractBid: number;
  declarerSucceeded: boolean;
}

export interface BatakView {
  phase: 'bidding' | 'selectingTrump' | 'playing' | 'finished';
  variant: 'ihaleli' | 'kozMaca' | 'esli';
  seat: number;
  turn: number;
  hand: Card[];
  /** Sıra oyuncudayken yasal olarak atabileceği kartların id listesi (dışındakiler soluk). */
  legalCardIds: number[];
  players: BatakPlayerPublic[];
  /** İhale durumu */
  minBid: number;            // Varsayılan 5 (ayar ile 4)
  highestBid: number;        // Henüz teklif yoksa 0
  highestBidder: number | null;
  canPass: boolean;
  /** Koz ve masa durumu */
  trump: Suit | null;
  trumpBroken: boolean;
  currentTrick: TrickCard[];
  lastTrickWinner: number | null;
  round: number;
  targetRounds: number;
  turnMsLeft?: number | null;
  noticeMsLeft?: number;
  notices?: GameNotice[];
  result: BatakRoundResult | null;
}

export type BatakAction =
  | { type: 'bid'; amount: number }
  | { type: 'pass' }
  | { type: 'selectTrump'; suit: Suit }
  | { type: 'play'; cardId: number };

export interface BatakScreenProps {
  view: BatakView;
  seat: number;
  onAction(action: BatakAction): void | Promise<void>;
  onNextRound?(): void | Promise<void>;
  onLeave?(): void;
}

export interface BidDialogProps {
  visible: boolean;
  minBid: number;            // 4 veya 5
  highestBid: number;        // Mevcut en yüksek ihale; <= highestBid olan sayılar disabled olur
  highestBidderName: string | null;
  canPass: boolean;
  scale: number;             // Tablet ölçek katsayısı (s)
  onBid(amount: number): void;
  onPass(): void;
}

export interface TrumpDialogProps {
  visible: boolean;
  winningBid: number;
  scale: number;
  onSelectTrump(suit: Suit): void;
}
```

### 3.3 Cihaz Bazlı Kesin Ölçüler (`dp`) — 1280×800 Yatay Tablet vs 6 İnç Yatay Telefon

`TASARIM.md` §3'teki `s = clamp(W / 852, 1, 1.6)` formülü ve `cardHeight = round(cardWidth * 1.38)` oranı kullanılarak hesaplanan ölçüler:

| Bileşen / Bölge | 1280×800 Yatay Tablet (`ALFA_8TX`, `s = 1.50`) | 6 İnç Yatay Telefon (`852×393` / `812×375`, `s = 1.00`) | 60+ Kuralları ve Notlar |
| :--- | :--- | :--- | :--- |
| **Kullanılabilir Alan (`usable × H`)** | `1280 × 800 dp` (kenar boşluğu `16 dp` → `1248 dp`) | `764 × 372 dp` (`812×375`'te `724 × 354 dp`) | Taşma (`overflow`) kesinlikle yok |
| **1. Kat: Başlık Şeridi (`headH`)** | `72 dp` (`y = 6..78`) | `48 dp` (`y = 4..52`, butonlarda `hitSlop: 4` ile `56 dp`) | Çık (sol üst), Ses, Rakipler, Sağ Bilgi Kutusu |
| · Çık / Ses Butonları | `96 × 72 dp` / `72 × 72 dp` (yazı `24 pt`) | `64 × 48 dp` / `48 × 48 dp` (dokunma `≥ 56 dp`, yazı `20 pt`) | Çık onay diyaloğu açar |
| · Rakip Paneli (`CardOpponentPanel`) | `260 × 72 dp` (isim `22 pt`, meta `18 pt`) | `156 × 48 dp` (isim `18 pt`, meta `15 pt`) | Pişti: `4 kart · 18 top. · 1 Pişti`<br>Batak: `Aldığı: 3/7 · 12 puan` |
| · Sağ Üst Bilgi Kutusu (Koz / Kasa) | `216 × 72 dp` | `136 × 48 dp` | Batak: `Koz: ♠ Maça · İhale: 7`<br>Pişti: `Deste: 24 · Sen: 14 kart` |
| **2. Kat: Orta Masa Alanı (`zoneH`)** | **Pişti:** `458 dp` · **Batak:** `478 dp` | **Pişti:** `146 dp` · **Batak:** `156 dp` | Diyaloglar ve orta kartlar bu katta ortalanır |
| · Pişti Orta Yığın Kartı (`PistiCenterPile`) | `96 × 132 dp` + `180 × 56 dp` `"Yerde: N kart"` rozeti | `64 × 88 dp` + `140 × 44 dp` `"Yerde: N kart"` rozeti | Yerde 1 kart varken altın/yeşil `"Pişti fırsatı!"` |
| · Batak Orta Löve (`TrickArea`) | `420 × 290 dp` alan içinde 4 kart × `84 × 116 dp` | `280 × 150 dp` alan içinde 4 kart × `56 × 77 dp` | Güney/Doğu/Kuzey/Batı yönlü yerleşim |
| **3. Kat: Eylem ve Durum Şeridi (`actH`)** | `72 dp` (`gap = 12 dp`) | `56 dp` (`gap = 8 dp`) | Tüm butonlar `≥ 56 dp` yüksekliğinde |
| · Sol Yardımcı Buton (`Diz` / `Son El`) | `156 × 72 dp` (yazı `22 pt`) | `110 × 56 dp` (yazı `20 pt`) | Eldeki kartları takım/değer sırasına dizer |
| · Orta Durum / Pişti Vurgusu Kutusu | `860 × 72 dp` (durum yazısı `28 pt` kalın) | `440 × 56 dp` (durum yazısı `22 pt` kalın) | `"SIRA SENDE — KART AT"` / `"PİŞTİ! +10"` |
| · Sağ Ana Eylem Butonu (`Kartı Oyna`) | `208 × 72 dp` (birincil vurgu, yazı `24 pt`) | `164 × 56 dp` (birincil vurgu, yazı `20 pt`) | Yalnızca kart seçiliyken aktif (tek ana eylem) |
| **4. Kat: El Şeridi (`Hand`)** | **Pişti:** `180 dp` · **Batak:** `160 dp` | **Pişti:** `110 dp` · **Batak:** `100 dp` | Alt kenara dayalı ahşap/koyu şerit |
| · **Pişti El Kartı (4 kart)** | **`104 × 144 dp`** (köşe harfi `35 pt`, orta `58 pt`) | **`68 × 94 dp`** (köşe harfi `23 pt`, orta `38 pt`) | Okey taşından (`72×99` / `48×66`) daha büyük |
| · **Batak El Kartı (13 kart)** | **`90 × 124 dp`** (adım `92 dp`, boşluklu tam sığar) | **`56 × 77 dp`** (adım `54..56 dp`, dokunma `≥ 56 dp`) | Okey taşından (`72×99` / `48×66`) daha büyük |
| **Diyaloglar (`BidDialog` / `TrumpDialog`)** | | | |
| · `BidDialog` (`4/5..13` + `Pas`) | Kart `680 × 340 dp`; 5×2 sayı ızgarası (`112 × 68 dp` butonlar) + `Pas` (`220 × 68 dp`) | Kart `520 × 250 dp`; 5×2 sayı ızgarası (`88 × 56 dp` butonlar) + `Pas` (`160 × 56 dp`) | Mevcut ihaleden küçük/eşit sayılar pasif (`disabled`) |
| · `TrumpDialog` (4 Büyük Takım Düğmesi) | Kart `640 × 300 dp`; 4 takım butonu `136 × 140 dp` (sembol `52 pt`, ad `22 pt`) | Kart `500 × 220 dp`; 4 takım butonu `108 × 110 dp` (sembol `38 pt`, ad `18 pt`) | `♠ Maça`, `♥ Kupa`, `♦ Karo`, `♣ Sinek` |

---

## 4) `react-native-svg` Olmadan Kart Çizimi (`View` / `Text` / Unicode)

Yeni native modül yasağı doğrultusunda `CardView` ve `CardBack` yalnızca standart React Native `View` ve `Text` bileşenleriyle aşağıdaki yapıda çizilir:

1. **Kart Gövdesi ve Kontrast (`CardView`):**
   - **Zemin:** `colors.tile` (`#fbf6e9` sıcak fildişi — 60+ yaş göz kamaşmasını önler), `borderColor: '#c9bfa6'`, `borderWidth: 1.5`, `borderRadius: Math.round(width * 0.12)`.
   - **Takım Sembolleri ve Renkleri:**
     - `H` (Kupa): `'♥'`, renk `tileColors.red` (`#d0312d` — fildişi üzerinde 5.8:1 kontrast).
     - `D` (Karo): `'♦'`, renk `tileColors.red` (`#d0312d`).
     - `S` (Maça): `'♠'`, renk `tileColors.black` (`#1d1d1d` — fildişi üzerinde 14.5:1 kontrast).
     - `C` (Sinek): `'♣'`, renk `tileColors.black` (`#1d1d1d`).
     - Renk körü kullanıcılar için 4 takımın Unicode geometrisi (`♠ ♥ ♦ ♣`) birbirinden tamamen farklıdır; ayrıca diyaloglarda ve durum satırında takım adı (`Maça`, `Kupa`, `Karo`, `Sinek`) açıkça yazılır.
2. **İç Yerleşim (Çok Büyük Köşe Harfi + Dev Takım Simgesi):**
   - **Sol Üst Köşe Bloku (`position: 'absolute', top: width * 0.05, left: width * 0.08`):**
     - **Değer (`rankLabel`: `'A' | 'K' | 'Q' | 'J' | '10' | '9' .. '2'`):** `fontSize: Math.max(18, Math.round(width * 0.35))`, `fontWeight: '900'`, `includeFontPadding: false`. `'10'` değerinde iki basamağın sıkışmaması için `letterSpacing: -1.5` ve `fontSize: Math.round(width * 0.31)` uygulanır.
     - **Köşe Altı Küçük Takım Simgesi:** Değerin hemen altında `fontSize: Math.max(14, Math.round(width * 0.22))`, `marginTop: -3`.
   - **Sağ Alt / Merkez Dev Takım Simgesi (`position: 'absolute', bottom: width * 0.05, right: width * 0.08`):**
     - `fontSize: Math.max(26, Math.round(width * 0.54))`, `lineHeight: Math.round(width * 0.58)`.
     - Böylece kartlar elde yan yana dizildiğinde sol üstteki dev rakam/harf ve küçük takım simgesi her zaman açıkta kalır; kartın tamamı göründüğünde ise merkez/sağ alttaki dev takım simgesi uzaktan bile okunur.
3. **Etkileşim Durumları:**
   - **Seçili (`selected: true`):** `borderColor: colors.accent` (`#f2b632`), `borderWidth: 4`, `transform: [{ translateY: -14 }, { scale: 1.08 }]`, `zIndex: 20` (`TileView.selected` ile aynı fiziksel his).
   - **Devre Dışı / Oynanamaz (`disabled: true`):** `opacity: 0.42`, `backgroundColor: '#e6dec8'`, `transform: [{ translateY: 4 }]`.
   - **Eşleşen Kart (`highlighted: true`):** `borderColor: colors.ok` (`#5fd07d`), `borderWidth: 3`.
4. **Kapalı Kart Sırtı (`CardBack`):**
   - Dış `View`: `#fbf6e9` zemin, `1.5 dp` `#c9bfa6` çerçeve.
   - İç `View`: `margin: Math.max(3, Math.round(width * 0.07))`, `backgroundColor: '#7a1f2b'` (kahvehane bordosu), `borderColor: '#f2b632'` (`1.5 dp` altın çerçeve), ortada `#f2b632` renginde `♦` Unicode motifi; `count` prop'u verilmişse ortada koyu rozet içinde `≥ 16 pt` kalın kalan kart sayısı.

---

## 5) Ses Planı (`< 50 KB`, Yeni Bağımlılık Olmadan Üretim)

1. **Üretilecek Dosyalar (`app/assets/sounds/`):**
   - `app/assets/sounds/card-play.wav`: Kart atma / masaya koyma sesi (`~95 ms`, tok kağıt darbesi + kısa sürtünme zarfı, **~4.3 KB**).
   - `app/assets/sounds/card-take.wav`: Yerdeki kartları toplama / pişti / löve alma sesi (`~170 ms`, çift katmanlı kağıt toplama hışırtısı + yumuşak vurgu, **~7.6 KB**).
2. **Yeni Bağımlılık Olmadan Üretim Yöntemi:**
   - Hiçbir harici paket veya ses kütüphanesi kurmadan, yerleşik Node.js (`Buffer` ile standart 44-byte RIFF/WAVE PCM `16-bit mono 22050 Hz` başlığı + deterministik üstel sönümlü band-pass gürültü ve sinüs darbesi) tek seferlik çalıştırılarak `.wav` dosyaları doğrudan `app/assets/sounds/` altına yazılır.
   - `22050 Hz × 2 byte × 0.17 sn ≈ 7.5 KB` olduğu için her iki dosya da **50 KB sınırının çok altındadır** (`< 10 KB`).
3. **`feedback.ts` ile Uyum (`app/src/components/cards/cardSfx.ts`):**
   - `app/src/feedback.ts` dosyası `SAHİP OLDUĞUN YOLLAR` dışında olduğu için `feedback.ts` değiştirilmez.
   - `app/src/components/cards/cardSfx.ts` modülü `feedback.ts` içinden `isSoundOn`, `buzz` ve `feedback` fonksiyonlarını import eder; `expo-audio`'nun `createAudioPlayer` API'si ile `card-play.wav` ve `card-take.wav` seslerini önyükler.
   - Oyuncu veya bot kart attığında `isSoundOn()` açık ise `card-play.wav` çalar (oyuncunun kendi hamlesinde `+ buzz('light')`); kart/löve toplandığında `card-take.wav` çalar (`+ buzz('medium')`), Pişti yapıldığında `card-take.wav` + `feedback('open')` (`buzz('success')`) tetiklenir.

---

## 6) Riskler ve Açık Sorular

1. **Motor Tipleri (`@kahve/cards`, `@kahve/pisti`, `@kahve/batak`) ile `fakeTypes.ts` Eşlemesi:**
   - `fakeTypes.ts` içindeki `Suit`, `Rank` ve `Card` tipleri `B1-CODEX.md` ile birebir aynı (`'S'|'H'|'D'|'C'`, `2..14`, `{ id, suit, rank }`) tanımlanmıştır. Codex'in `B2` (Pişti) ve `B3` (Batak) planlarında `PistiView` / `BatakView` alan adlarında küçük isimlendirme farkları olursa, tüm ekranlar tiplerini tek yerden (`fakeTypes.ts`) aldığı için B5 entegrasyonunda tek dosyada yeniden dışa aktarımla (`re-export` / tip adaptörü) sıfır ekran değişikliğiyle bağlanacaktır.
2. **`GameShell.tsx` (B6-SONNET) ile Paralel Geliştirme:**
   - `GameShell.tsx` şu an `feat/kahve-b6` dalında Claude Sonnet tarafından geliştiriliyor ve `feat/kahve-agy` dalında henüz mevcut değil. `PistiScreen` ve `BatakScreen` kendi üst başlık (`Çık`, `Ses`, `CardOpponentPanel`, `Koz/Kasa` kutusu) ve el sonu özet görünümünü kendi içinde barındıracak, aynı zamanda `hideHeader?: boolean` prop'u ile B5/B6 birleştiğinde `GameShell` içine doğrudan sarılabilir yapıda olacaktır.
3. **`feedback.ts` Dosyasına Doğrudan Ekleme Tercihi (Açık Soru):**
   - Görev kâğıdında `feedback.ts` sahipli yollar arasında sayılmadığı için sesleri `app/src/components/cards/cardSfx.ts` üzerinden `feedback.ts`'in `isSoundOn()` ve `buzz()` fonksiyonlarına bağladık. Fable, `card-play.wav` ve `card-take.wav` kaynaklarının doğrudan `app/src/feedback.ts` içindeki `SOURCES` nesnesine eklenmesini tercih ederse onay notunda belirtmesi yeterlidir.
4. **Batak Varyantlarının Diyalog Kapsamı:**
   - İlk sürümde `B4-AGY.md` gereği 4 kişilik İhaleli Batak (`BidDialog` 4/5..13 + Pas ve `TrumpDialog` 4 takım), Koz Maça (ihalesiz sabit ♠ koz gösterimi) ve Eşli Batak desteklenecektir. Gömmeli Batak'a özgü "4 kart gömme" ara ekranı kapsam dışı tutulmuştur.

---

## 7) Tahmini Commit Listesi

Tüm commit'ler `feat/kahve-agy` dalında küçük, bağımsız ve her adımda `corepack pnpm --filter app typecheck` yeşil olacak şekilde atılacaktır (push yapılmaz):

1. `feat(cards): add fakeTypes, responsive cardLayout, and <50KB card wav sounds`
2. `feat(cards): add SVG-free CardView, CardBack, and two-tap/drag Hand component`
3. `feat(pisti): add PistiScreen with center pile, opponent stats, and pisti banner`
4. `feat(batak): add BatakScreen with TrickArea, BidDialog, and TrumpDialog`
5. `feat(cards-preview): add CardsPreviewScreen, i18n key requests, and B4 report`
