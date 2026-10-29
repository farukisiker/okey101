# Okey 101 — 60+ Kullanıcı İçin UX Geliştirme Raporu

> Fable tarafından 29.10.2026'da, uygulamanın 852×393 pt (iPhone yatay) ekran
> görüntüleri ve kaynak kodu üzerinden hazırlandı. Uygulanan maddeler en altta.

Ölçümler: ıstaka taşı 54×75 pt (rakam 27 pt), butonlar ~34 pt yüksek, aksiyon çubuğu 38 pt.

## 1. Genel değerlendirme — en büyük 5 engel

1. **Yazılar çok küçük.** Etiketler 9–13 pt (masadaki per rakamları 12 pt, per sahibi 9 pt). 60+ için gövde yazısı en az 18 pt, kritik bilgi 22–26 pt olmalı.
2. **Butonlar 34 pt yüksek** (Apple asgari 44 pt; yaşlılar için 56–64 pt). "Çık", "Aç"ın 8 pt yanında ve onay sormadan çıkıyor.
3. **Istaka dizmek zor:** sürükleme ince motor becerisi ister; dokun-dokun (taşı seç → yuvaya dokun) alternatifi yok.
4. **Yönlendirme yetersiz:** "Sıra sende" 13 pt tek satır ve 2 pt çerçeve. Ne çekileceği, ne atılacağı, "Aç"ın neden pasif olduğu görünmüyor. Bot hamleleri takip edilemiyor. Ses/titreşim yok.
5. **Lobi karmaşık:** isim, oda kodu, sunucu adresi, "localhost:3001", "Bağlantı yok" hepsi ilk ekranda; isim hatırlanmıyor.

## 2. Ekran ekran bulgular

- **Lobi:** Tek ekran, ortada 280×72 pt tek "OYNA" (28 pt). Altında ikincil "Arkadaşlarla Oyna" (56 pt). İsim ilk açılışta bir kez sorulsun, kaydedilsin; "Hoş geldin Hasan". Sunucu adresi ayarlara.
- **Oda Kur hatası:** Teknik hata yerine tam cümle: "İnternet bağlantısı yok. Bilgisayara karşı oynayabilirsin." + "OYNA".
- **Oyun başı:** Aksiyon çubuğu 64 pt. Durum 22 pt kalın, en fazla 4 kelime ("SIRA SENDE — TAŞ AT"). "Aç 80/101" ve altında "21 sayı daha". Pasif opaklık 0.6 + çerçeve. Gösterge yanında "Okey: Sarı 11".
- **Taş seçili:** Seçim belirgin olsun (12 pt yukarı, %110, sarı gölge). "At" butonu hep yerinde dursun, seçim yokken pasif; atma alanı seçim varken yanıp sönsün.
- **Rakipler oynuyor:** Aktif oyuncuda 4 pt sarı çerçeve, isim 18 pt. Bot hamleleri arası 1,0–1,5 s. Orta alanda 20 pt "Leyla 2 kırmızı attı".
- **Taş çekildi:** Çekilen taş 2 s parlasın; soldaki taş daha büyük gösterilsin.
- **Oyun ortası:** Masa taşı en az 40 pt (rakam 20 pt), per etiketi 14 pt. Bot adları oyuncu adıyla çakışmasın. Pere işlerken hedef per vurgulansın.
- **El sonu:** Başlık 28 pt, satırlar 20 pt, kazanan satırı yeşil. Kendi satırında "Sen — açamadın: 202 ceza". "Sonraki El" 240×64 pt birincil, "Lobiye Dön" küçük ikincil.
- **iPad:** Ölçek katsayısı `s = clamp(width/852, 1, 1.6)`; yazı, buton, per taşı `s` ile büyüsün; taş üst sınırı 96 pt.

## 3. Akış önerileri

- **Başlangıç:** Açılış → (ilk kez isim) → tek "OYNA" → oyun. Hedef: 1 dokunuş.
- **Adım adım yönlendirme:** Çekme fazında deste ve soldaki taş sarı çerçeve + nabız. Atma fazında atma alanı nabız. 101 olunca "Aç" yeşil + titreşim. Yerden alınca "Bu taşı kullanmalısın".
- **Istaka:** Dokun-dokun taşıma; Diz sonrası gruplar arası boşluk; sürükleme hedef çerçevesi 4 pt.
  - *Uygulanmadı:* "Dolu yuvaya bırakınca araya sok ve sağa kaydır" önerisi. Kullanıcı taşların kendiliğinden kaymasını açıkça istemedi.

## 4. Ses ve titreşim

| Olay | Ses | Titreşim |
|---|---|---|
| Taş çekme | Kısa "tık" 120 ms | Hafif |
| Taşı yuvaya koyma | Ahşaba taş "tak" 150 ms | Hafif |
| Taş atma | Taş düşme "klak" 180 ms | Orta |
| Sıra sende | İki notalı yumuşak çan 300 ms | Orta |
| Açma / per indirme | Kısa şakırtı 250 ms | Başarı |
| El bitti | 3 notalı melodi 600 ms | Başarı |
| Hata | Alçak "tok" 100 ms | Uyarı |
| Rakip attı | Çok kısık "tık" | — |

Oyun ekranında 48×48 pt hoparlör ikonu ile tek dokunuşla aç/kapa. Varsayılan açık.

## 5. Erişilebilirlik

- **Renk körlüğü:** Sarı #e09a00 fildişi üzerinde 2,2:1 → #b57400'e koyulaştır. Renk başına şekil: kırmızı ●, sarı ▲, mavi ■, siyah ◆.
- **Okunabilirlik:** Tüm yazılar en az 16 pt.
- **Yanlış dokunma:** "Çık" Aç'tan uzağa + onay ("Masadan ayrılmak istiyor musun?"). "At" yalnızca seçim varken aktif.

## 6. Öncelik listesi

**P0:**
1. Buton 56–64 pt, yazı 20 pt.
2. Yazılar ≥16 pt, durum 22 pt.
3. Tek "OYNA" + isim hatırlama.
4. Çık + onay.
5. ~~Araya sokma~~ (kullanıcı istemedi).
6. Dokun-dokun taşıma.
7. Sıra göstergesi + nabız.
8. Bot bekleme + son hamle yazısı.
9. Ses + titreşim.
10. Masa per taşları büyük.
11. Sarı koyulaştırma + şekiller.
12. "Aç 80/101".

**P1:** Çekilen taş vurgusu, el sonu kartı + ceza açıklaması, bot adı çakışması, ses ikonu, iPad ölçekleme, faydalı taş ipuçları.

**P2:** Öğretici mod, kahvehane ortam sesi, yüksek kontrast, iki modlu Diz, yarım kalan masaya dönme.
