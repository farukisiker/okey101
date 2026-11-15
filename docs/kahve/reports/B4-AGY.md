# B4-AGY Görev Raporu: Kart Görselleri (`CardView`, `Hand`) ve Pişti / Batak Oyun Ekranları

> **İşçi Model:** Flash (`gemini-3.8-flash-high`)  
> **Lider / Onay:** Argon (`gemini-4-argon-high`) & Fable  
> **Dal / Worktree:** `C:/Users/mfaru/okey101/kahve-agy` (`feat/kahve-agy`)  
> **Tarih:** 2026-11-16  

---

## 1. Özet

B4 görevi kapsamında Pişti ve Batak oyunları için SVG gerektirmeyen saf React Native (`View` + `Text` + Unicode `♠ ♥ ♦ ♣`) kart görsel sistemi, 60+ yaş ergonomisine uygun `CardView`, `CardBack`, iki aşamalı dokunmalı `Hand` bileşeni, `PistiScreen`, `BatakScreen` (tekli ihaleli) ve geliştirici önizleme ekranı (`CardsPreviewScreen`) tamamlanmıştır.

Fable'ın onay notları doğrultusunda:
- B6'dan birleşen `GameShell.tsx` (+ `roundSummary.ts`, `SummaryTable.tsx`) üst çatı olarak kullanılmış; başlık, sayaç, rakip şeridi, durum satırı ve el sonu özeti `GameShell` üzerinden verilmiştir.
- Batak ilk sürüm olarak ihaleli tekli (`BidDialog` + `TrumpDialog`) şeklinde kodlanmıştır.
- i18n anahtarları doğrudan `app/src/i18n/tr.ts` ve `app/src/i18n/locales/en.ts` dosyalarına gerçek metinlerle, diğer 11 locale dosyasına (`de`, `es`, `fr`, `hi`, `id`, `it`, `ja`, `ko`, `pt`, `ru`, `zh`) ise İngilizce yer tutucu olarak eklenmiştir.
- Headless ortam gereği harici komut gerektiren `.wav` dosyaları oluşturulmamış; `app/src/components/cards/cardSfx.ts` eksik dosya import hatası vermeyecek şekilde esnek bir kaynak kayıt mekanizmasıyla (`registerCardAudioSource`) korunmuştur. Ses açık olduğunda haptik geri bildirimler (`buzz('light')`, `buzz('medium')`, `buzz('success')`) eksiksiz çalışmaktadır.

---

## 2. Oluşturulan ve Düzenlenen Dosyalar

### Oluşturulan Dosyalar (B4.1 – B4.5)
1. `app/src/components/cards/fakeTypes.ts`: B1-CODEX sözleşmesiyle uyumlu `Suit`, `Rank`, `Card` tipleri, Pişti ve Batak görünüm/eylem tipleri ve yardımcı fonksiyonlar (`rankLabel`, `suitSymbol`, `suitColor`, `sortCards`, `createDeck`).
2. `app/src/components/cards/cardLayout.ts`: 1280×800 yatay tablet (`s = 1.50`, ALFA_8TX) ve 6" yatay telefon (`s = 1.00`) için dinamik kart, el adımı, masa alanı ve rakip paneli boyut hesaplayıcısı (`useCardLayout`).
3. `app/src/components/cards/cardSfx.ts`: `feedback.ts` ile uyumlu ses ve haptik yönetim katmanı (`cardPlayFeedback`, `cardTakeFeedback`). Eksik `.wav` dosyaları için korumalı kayıt mekanizması.
4. `app/src/components/cards/CardView.tsx`: `react-native-svg` olmadan çalışan saf `CardView` ve `CardBack` bileşenleri. Seçili (yukarı kalkan altın çerçeveli), devre dışı (soluk %42), eşleşen/fırsat (yeşil çerçeveli) durumları.
5. `app/src/components/cards/Hand.tsx`: Eldeki kartları gösteren, 60+ ergonomisine uygun iki aşamalı dokunma (1. dokunuş kaldırır, 2. dokunuş oynar) destekli el bileşeni.
6. `app/src/components/cards/CardOpponentPanel.tsx`: Pişti (eldeki kart, toplanan kart, pişti sayısı) ve Batak (eldeki kart, alınan el, teklif/pas, toplam puan) durumlarını gösteren yüksek kontrastlı rakip paneli.
7. `app/src/components/cards/PistiCenterPile.tsx`: Pişti orta yığını; açık üst kart, 2+ kartta hafif açılı deste efekti, "Pişti fırsatı!" / "Yerde: N kart" rozeti.
8. `app/src/components/cards/BidDialog.tsx`: Batak İhale Diyaloğu; `4/5..13` arası ≥56 dp dokunma hedefleri, mevcut tekliften küçük/eşit teklifleri devre dışı bırakma, "Pas" butonu.
9. `app/src/components/cards/TrumpDialog.tsx`: Batak Koz Seçim Diyaloğu; 4 dev takım butonu (`♠ Maça`, `♥ Kupa`, `♦ Karo`, `♣ Sinek`).
10. `app/src/components/cards/TrickArea.tsx`: Batak 4 koltuklu löve alanı; Güney (Sen), Batı (Sol), Kuzey (Karşı), Doğu (Sağ) yönlü kart yuvaları ve isim etiketleri.
11. `app/src/components/cards/index.ts`: Tüm kart bileşen ve tiplerinin tek merkezden dışa aktarımı.
12. `app/src/screens/PistiScreen.tsx`: `GameShell` ile entegre Pişti oyun ekranı.
13. `app/src/screens/BatakScreen.tsx`: `GameShell` ile entegre Batak oyun ekranı.
14. `app/src/screens/cards-preview/mockData.ts`: Pişti (başlangıç, fırsat, pişti anı, el sonu) ve Batak (ihale, koz seçimi, löve oynama, el sonu) mock durumları.
15. `app/src/screens/cards-preview/CardsPreviewScreen.tsx`: Geliştirme ve test önizleme ekranı + 52 kartlık galeri görünümü.
16. `docs/kahve/reports/B4-AGY.md`: Bu rapor.

### Düzenlenen Dil Dosyaları
- `app/src/i18n/tr.ts`: Gerçek Türkçe kart metinleri.
- `app/src/i18n/locales/en.ts`: Gerçek İngilizce kart metinleri.
- `app/src/i18n/locales/{de, es, fr, hi, id, it, ja, ko, pt, ru, zh}.ts`: TypeScript `Dict = Record<Key, string>` sözleşmesi için İngilizce yer tutucu metinler.

---

## 3. Bileşen Ağacı ve Ekran Ölçüleri

### Bileşen Ağacı
```
GameShell (Başlık · Geri · Ses · Kalan Süre · Rakipler · Durum · El Sonu Özeti)
└── PistiScreen / BatakScreen
    ├── Top Info Row (Deste Sayacı veya Batak Koz / İhale Rozeti)
    ├── Center Area
    │   ├── PistiCenterPile (Pişti: En üst açık kart + Deste arkası + "Pişti fırsatı!" rozeti)
    │   └── TrickArea (Batak: Güney, Batı, Kuzey, Doğu yönlü 4 kart yuvası)
    ├── ActionBar ("Diz" Butonu · Durum/İpucu Metni · "Kartı Oyna" Butonu)
    ├── Hand (Eldeki kartlar: CardView listesi, iki aşamalı dokunma, solukluk filtresi)
    ├── BidDialog (Batak ihale modalı - aktifken)
    ├── TrumpDialog (Batak koz seçim modalı - aktifken)
    └── ConfirmDialog (Masadan çıkış onayı)
```

### Kesin Ölçüler (dp)

| Alan / Bileşen | 1280×800 Yatay Tablet (`ALFA_8TX`, `s = 1.50`) | 6 İnç Yatay Telefon (`852×393` / `812×375`, `s = 1.00`) |
| :--- | :--- | :--- |
| **Kullanılabilir Alan** | `1248 × 800 dp` | `764 × 372 dp` |
| **Başlık Şeridi (`GameShell.bar`)** | `72 dp` yükseklik | `48 dp` yükseklik (`hitSlop` ile `≥ 56 dp`) |
| **Rakip Paneli (`CardOpponentPanel`)** | `240 × 68 dp` (Yazı: 22 pt / 18 pt) | `160 × 52 dp` (Yazı: 18 pt / 15 pt) |
| **Pişti El Kartı (4 kart)** | `102 × 141 dp` (Köşe harfi 33 pt, Takım 55 pt) | `68 × 94 dp` (Köşe harfi 22 pt, Takım 37 pt) |
| **Batak El Kartı (13 kart)** | `84 × 116 dp` (Adım: 88 dp, yatay sığar) | `56 × 77 dp` (Adım: 54..56 dp, dokunma ≥ 56 dp) |
| **Pişti Orta Yığın Kartı** | `96 × 132 dp` + 34 dp rozet | `64 × 88 dp` + 34 dp rozet |
| **Batak Orta Löve Alanı** | `268 × 215 dp` (4 kart × `84 × 116 dp`) | `179 × 142 dp` (4 kart × `56 × 77 dp`) |
| **Eylem Şeridi Butonları** | Yükseklik: `72 dp`, Yazı: `22 pt` | Yükseklik: `56 dp`, Yazı: `20 pt` |
| **İhale / Koz Butonları** | Yükseklik: `78 dp`, Genişlik: `78 dp` | Yükseklik: `56 dp`, Genişlik: `56 dp` |

---

## 4. 60+ Ergonomisi ve Erişilebilirlik Doğrulaması

1. **Yazı Boyutları:**
   - En küçük metin `font.small` (`15 pt`). Kart köşe değerleri `≥ 16 pt` (tablette `33 pt`), orta simgeler `≥ 26 pt` (tablette `55 pt`), başlık ve durum metinleri `≥ 18–28 pt`.
2. **Dokunma Hedefleri:**
   - Tüm butonlar ve diyalog elemanları `≥ 56 dp` yükseklik/genişlik standardına uymaktadır.
   - Kartlarda `hitSlop: { top: 8, bottom: 8, left: 4, right: 4 }` ile dar adımlarda bile dokunma güvenliği sağlanmıştır.
3. **İki Aşamalı Dokunma:**
   - İlk dokunuş kartı seçer, yukarı kaldırır (`translateY: -14`, altın çerçeve `borderWidth: 4`).
   - İkinci dokunuş kartı oynar.
   - Alternatif olarak "Kartı Oyna" ana butonu da seçili kartı masaya sürer (Fable notu #5).
4. **Görsel Kontrast ve Renk Körü Desteği:**
   - Sıcak fildişi zemin (`#fbf6e9`) göz yorgunluğunu engeller.
   - Kupa/Karo kırmızı (`#d0312d`), Maça/Sinek siyah (`#1d1d1d`).
   - Renk körü oyuncular için 4 takımın Unicode geometrisi tamamen farklıdır ve diyaloglarda açıkça isimleri (`Maça`, `Kupa`, `Karo`, `Sinek`) yazılmaktadır.
   - Pişti'de yerde kart varken elde eşleşen kartlar veya Vale yeşil çerçeveyle (`#5fd07d`) vurgulanır.
   - Batak'ta kurallara göre atılamayacak kartlar `%42` opaklıkla sönükleştirilir.

---

## 5. İnceleme Düzeltmeleri (Review fixes - Argon B4 İncelemesi)

Argon'un B4 inceleme raporundaki 6 bulgunun tümü eksiksiz olarak giderilmiştir:

1. **Oynanamaz Kartların Oynanmasının Engellenmesi (Finding 1):**
   - `app/src/components/cards/Hand.tsx`: `handleCardPress` içinde `!canPlay || !isPlayable` kontrolü eklendi; oynanamaz/yasal olmayan kartların ilk dokunuşla seçilmesi ve ikinci dokunuşla oynanması tamamen engellendi.
   - `app/src/screens/PistiScreen.tsx` & `BatakScreen.tsx`: "Kartı Oyna" butonu (`disabled={!isSelectedPlayable}` / `disabled={!isSelectedLegal}`), orta yığın dokunma aksiyonu ve `handlePlayCard` fonksiyonu doğrudan `view.playableCardIds` / `view.legalCardIds` kontrolüne bağlandı. Ayrıca eldeki kart kural dışı kaldığında seçimin derhal sıfırlanması için reaktif `useEffect` koruması eklendi.

2. **6 İnç Yatay Telefonda Dikey Taşmanın Önlenmesi & Yerel Oyuncu İstatistikleri (Finding 2):**
   - `app/src/components/cards/cardLayout.ts`: `computeCardLayout` fonksiyonu `usableHeight` ve `GameShell` başlık/rakip/durum şeridinin kapladığı alanı (~144 dp) dikkate alacak şekilde güncellendi. Kompakt telefon ekranlarında (`usableHeight < 420 dp`) `cardWidth`, `trickCardWidth`, `centerPileCardWidth` ve `Hand` tepsi dikey dolgusu (`paddingTop: 6`, `minHeight: height + 16`) sınırlandırılarak toplam yükseklik ~210 dp bandında tutuldu ve taşma sıfırlandı.
   - `app/src/screens/BatakScreen.tsx`: `topInfoRow` (Koz / İhale rozetleri) `position: 'absolute', top: 6, left: 16` mutlak konumuna alınarak dikey akıştan düşürüldü.
   - `PistiScreen.tsx` & `BatakScreen.tsx`: `GameShell` zaten `status={statusText}` gösterdiğinden, eylem şeridi ortasındaki mükerrer durum satırı kaldırıldı. Yerine yerel oyuncunun kendi istatistikleri kompakt şekilde yerleştirildi:
     - Pişti: `t('pistiCapturedCount')` · `t('pistiCount')` · `t('pistiYourScore')` (örn: *12 kart aldı · 2 pişti · Puanın: 40*)
     - Batak: `t('batakTricksWon')` / ihale · `t('cardsPoints')` (örn: *Aldığı: 3 / 5 · 40 puan*)

3. **60+ Ergonomi Kuralları (Finding 3):**
   - **Dokunma Hedefi:** `PistiScreen.tsx` ve `BatakScreen.tsx`'teki `styles.actionBtn` `minHeight: 56` dp yapıldı (`Button.tsx` standardına eşitlendi).
   - **Yazı Boyutları:**
     - `app/src/components/cards/TrickArea.tsx`: `nameText` `font.small` (15 pt) yapıldı (12 pt'den yükseltildi).
     - `app/src/components/cards/CardOpponentPanel.tsx`: `declarerChipText` `font.small` (15 pt) yapıldı (12 pt'den yükseltildi).
     - `app/src/components/cards/CardView.tsx`: `badgeText` `Math.max(15, Math.round(width * 0.22))` (15 pt), `CardBack` `countText` `Math.max(16, Math.round(width * 0.28))` (≥ 16 pt) olarak güncellendi.
   - **Metin Küçültme (adjustsFontSizeToFit):** `CardOpponentPanel.tsx`'ten `adjustsFontSizeToFit minimumFontScale={0.75}` kaldırıldı; yazıların 11.25 pt'ye küçülmesi önlendi.
   - **Mükerrer İsim:** `CardOpponentPanel.tsx`'te oyuncu panelinde kendi adını tekrarlayan `t('batakContract', { name, n })` yerine doğrudan ihale miktarını gösteren `t('batakContractBid', { n: bid })` anahtarı kullanıldı.

4. **Sabit Türkçe Dizgilerin `t()` Üzerinden Yönlendirilmesi (Finding 4):**
   - `CardView.tsx`: `' (seçili)'` erişilebilirlik eki `t('cardsSelectedA11y')` yapıldı.
   - `TrickArea.tsx`: `Koltuk ${seat + 1}` yedek etiketi `t('cardsSeatFallback', { n: seat + 1 })` yapıldı.
   - `CardOpponentPanel.tsx`: `t('batakContractBid', { n: bid })` anahtarı bağlandı.
   - `CardsPreviewScreen.tsx`: Sekme etiketleri (`cardsPreviewPistiInit`, `cardsPreviewPistiOpp`, `cardsPreviewPistiCeleb`, `cardsPreviewPistiDone`, `cardsPreviewBatakBid`, `cardsPreviewBatakTrump`, `cardsPreviewBatakPlay`, `cardsPreviewBatakDone`, `cardsPreviewGalleryTab`) ve galeri başlığı (`cardsPreviewGalleryTitle`) `t()` ile bağlandı.
   - Tüm yeni anahtarlar `app/src/i18n/tr.ts` (gerçek Türkçe), `app/src/i18n/locales/en.ts` (gerçek İngilizce) ve diğer 11 yerelleştirme dosyasına (`de`, `es`, `fr`, `hi`, `id`, `it`, `ja`, `ko`, `pt`, `ru`, `zh`) İngilizce yer tutucu olarak eklendi.

5. **`GameShell` `onNewMatch` ve `humanCount` Propları (Finding 5):**
   - `PistiScreen.tsx` ve `BatakScreen.tsx`'te `GameShell`'e `onNewMatch={onNextRound}` ve `humanCount={view.players.filter((p) => !p.isBot).length || 1}` propları eklendi. Maç sonu özet diyaloğundaki "Yeni maç" butonunun çalışması sağlandı.

6. **Kullanılmayan `dropZoneKey` Prop'unun Temizlenmesi (Finding 6):**
   - `app/src/components/cards/fakeTypes.ts` içindeki `HandProps` arayüzünden `dropZoneKey?: string;` kaldırıldı. İki aşamalı dokunma, orta yığın dokunuşu ve "Kartı Oyna" aksiyonları korundu.

---

## 6. Kabul ve Son Durum

- `shared/`, `server/`, `packages/`, `app/src/net/`, `App.tsx`, `GameScreen.tsx`, `feedback.ts`, `package.json` ve kilit dosyalara **kesinlikle dokunulmamıştır**.
- İzin verilen sınırlar (`app/src/components/cards/**`, `PistiScreen.tsx`, `BatakScreen.tsx`, `cards-preview/**`, `app/src/i18n/**`, `docs/kahve/reports/B4-AGY.md`) dışına çıkılmamıştır.
- Tüm dosyalar strict TypeScript kurallarına uygundur.
- Tekrar Argon ve Fable onayına sunulmuştur.
