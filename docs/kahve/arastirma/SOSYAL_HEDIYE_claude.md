# Kahve Havası: Sesli Sohbet, Hediye Ekonomisi, Profil Fotoğrafı (Claude taslağı)

> Durum: TASLAK. Argon'un araştırmasıyla (`KAHVE_HAVASI_argon.md`) karşılaştırılıp Fable'ın MASTER_PLAN'ına **E Aşaması** olarak girecek.
> Rakamların bir kısmı üçüncü taraf kaynaklardan geliyor; "doğrulanmalı" işaretliler resmi sayfadan kontrol edilmeli.
> Hukuk ve vergi bölümleri bilgi amaçlıdır. Para ödemesine başlamadan önce mali müşavir ve avukat onayı şart.

---

## 1. Kırmızı çizgiyle ilişki ("gerçek parayla kumar yok")

Hediye ekonomisi kumar **değildir**. Ancak bu, şu şartlar korunursa geçerlidir:
- Hediye **oyun sonucuna bağlı olamaz.** "Kazanana hediye havuzu", "bahis", "masaya jeton koy" gibi şeyler yok.
- **Oyun puanı ≠ jeton.** Puan sanaldır; jetonla alınamaz, jetona ya da paraya çevrilemez.
- Para kazanılan tek yol **başkasından hediye almaktır**, oyun kazanmak değil. Mağaza metinlerinde de "okey oynayarak para kazan" denmez.
- Hediye oyunda avantaj sağlamaz (pay-to-win yok).

---

## 2. Rakipler nasıl yapıyor (özet)

| Uygulama | Model | Yayıncı / alıcı payı |
|---|---|---|
| TikTok LIVE | Coin (IAP) → hediye → Diamond → para | Coin'in görünen değerinin yaklaşık %50'si Diamond olur. Mağaza kesintisi öncesinden düşüldüğü için mobilde gerçek pay yaklaşık %30–35. Örnek: 100 $'lık iOS alımı → Apple 30 $ → kalan 70 $'ın yarısı yayıncıya (35 $). |
| Bigo Live | Diamond → Beans (yaklaşık 210 Beans = 1 $) | Kaynaklar %30–50 arasında değişiyor, ajans payı ayrıca düşülüyor (doğrulanmalı). |
| Yalla Ludo | Sesli odalar + hediyeler, Diamond IAP | Hediyeyi paraya çevirme kamuya açık değil (bulunamadı). |
| Apple kuralı (3.1.1) | İçerik üreticisine "bahşiş/hediye" **IAP ile** olmak zorunda | Apple kesintiyi alır. Üreticiye ne kadar aktarılacağı geliştiriciye kalmış. |

**Sonuç:** Piyasa standardı, alıcıya kullanıcının ödediği brüt tutarın yaklaşık **%25–35'i**. Biz bunu "net gelirin yüzdesi" olarak tanımlayıp zarar riskini sıfırlıyoruz (§4).

---

## 3. Para birimleri

| Birim | Nasıl elde edilir | Paraya döner mi |
|---|---|---|
| **Oyun puanı** | Oynayarak (mevcut) | Hayır |
| **Jeton** | Sadece IAP (RevenueCat, tüketilebilir ürün) | Hayır. Hediye almak için harcanır. |
| **Kazanç (TL)** | Ödenmiş jetonla alınmış hediye sana gelince | Evet: onaylı hesaba, bekletme süresinden sonra |
| **Bonus jeton** | Paket bonusu, kampanya, günlük ödül | Hediye alınabilir ama **kazanç üretmez** |

Önerilen hediyeler (60+ için tanıdık, kahvehane kültürü, tütün ve alkol yok):
Çay (10 jeton) · Simit (20) · Lokum (30) · Türk kahvesi (50) · Gül (100) · Çiçek buketi (300) · Tesbih (500) · Gümüş tesbih (1000) · Altın tesbih (3000).
Her hediyenin küçük bir animasyonu olur, alıcının profilinde "vitrin"de durur ve haftalık "Kahvenin gülü" listesine girer.

---

## 4. Zarar etmeyen matematik

### 4.1 Temel ilke: "lot muhasebesi"
Her jeton paketi alındığında RevenueCat webhook'u **gerçek net tutarı** verir (fiyat, vergi oranı, mağaza kesintisi).
Bu jetonlar bir **lot** olarak defterde durur: `{lotId, adet, jeton başı net TL, platform, satın alma tarihi}`.
Hediye gönderilince jeton FIFO sırasıyla lotlardan düşülür. Alıcıya yazılan kazanç:

```
kazanç = Σ (harcanan jeton × o lotun jeton başı net TL) × PAY
PAY = 0.40   (ayar; mağaza kesintisi %30 olursa da güvenli)
```

**Neden zarar edemeyiz?** Alıcıya giden para, bize gerçekten yatan paranın sabit bir yüzdesi.
Bonus/promosyon jetonunun net değeri 0 olduğu için kazanç üretmez. Ucuz bölge fiyatı ya da büyük paket indirimi otomatik olarak daha az kazanç yazar.
Böylece "1 gül = 15 TL" gibi sabit kur yüzünden açık verme riski yoktur.

### 4.2 Bir hediye örneği (Gül = 100 jeton, 1200 jeton = 499,99 TL'lik paketten)

| Adım | %15 mağaza (Small Business) | %30 mağaza |
|---|---|---|
| Kullanıcının ödediği (100 jetonluk kısım) | 41,67 TL | 41,67 TL |
| − KDV %20 (mağaza düşer varsayımı, doğrulanmalı) | 34,72 | 34,72 |
| − Mağaza kesintisi | **29,51** (net) | **24,31** (net) |
| Alıcıya (%40) | 11,81 TL | 9,72 TL |
| Bize kalan (sabit gider ve vergi öncesi) | 17,71 TL | 14,58 TL |
| Alıcının brüte oranı | %28 | %23 |

Alıcının payı TikTok ve Bigo bandında kalıyor.

### 4.3 Aylık senaryo (örnek: 10.000 aylık aktif kullanıcı, %2'si ödeme yapıyor, kişi başı 150 TL)

| Kalem | TL |
|---|---|
| Brüt jeton satışı | 30.000 |
| Net (KDV ve %15 mağaza sonrası) | 21.250 |
| Kazanç üreten hediyelerin oranı (alıcısı onaylı ya da onaylanacak) | %60 varsayım |
| Alıcılara ödenecek (%40 × 21.250 × 0,6) | −5.100 |
| İade/chargeback rezervi (net gelirin %10'u, 90 gün sonra serbest kalır) | −2.125 (geçici) |
| Sesli sohbet sunucusu (kendi LiveKit, küçük VPS) | −400 |
| Kimlik doğrulama (30 kişi × yaklaşık 1,5 $) | −1.600 |
| Ödeme kuruluşu / EFT ücretleri | −500 |
| Mali müşavir + şirket sabit gideri | −4.000 |
| Foto moderasyonu (çoğu ücretsiz katman) | yaklaşık 0 |
| **Vergi öncesi kalan** | **yaklaşık 7.500** (rezerv dönünce 9.600) |

**Başa baş noktası:** sabit giderler (yaklaşık 6.500 TL/ay) ÷ bize kalan oran (net'in yaklaşık %60'ı = brütün yaklaşık %42'si) ≈ **ayda 15.500 TL brüt hediye satışı**.

### 4.4 Zarar sigortaları (sisteme gömülü kurallar)
1. **Bekletme:** Bir ayın kazancı **ikinci ayın sonunda** ödenir (yaklaşık 60–90 gün). Apple iadeleri ve Google chargeback'leri bu süreye sığar.
2. **İade = geri alma:** İade edilen alımın lotu "geçersiz" olur. O lottan doğan kazanç alıcının bekleyen bakiyesinden düşülür, ödendiyse eksi bakiye olarak gelecekten kesilir. İade yapan göndericinin hediye hakkı askıya alınır.
3. **Ödeme havuzu tavanı:** Bir ayda ödenen toplam ≤ olgunlaşmış net gelirin %40'ı (lot kuralı bunu zaten sağlar; ikinci kilit).
4. **Açma şalteri:** Para ödemesi (E4) ancak son 3 ayın platform payı ≥ 1,5 × aylık sabit gider olduğunda açılır. O zamana kadar hediyeler **parasız** çalışır (sadece itibar ve vitrin), kazanç birikir. Kullanıcıya bunun açıkça yazılması gerekir.
5. **Minimum ödeme:** 500 TL. Altındaki tutar sonraki aya devreder. 12 ay hareketsiz ve onaysız bakiyenin akıbeti koşullarda yazılı olur (hukukçuya sorulacak).

---

## 5. Sahtekârlık ve yaşlı kullanıcıyı koruma

| Risk | Önlem |
|---|---|
| Kendi kendine hediye (ikinci hesap) | Aynı cihaz, IP veya ödeme hesabı arasındaki hediye kazanç üretmez. Cihaz parmak izi + hesap bağlantı grafiği. |
| Çalıntı kartla jeton → kendi hesabına hediye → para (kara para) | 60–90 gün bekletme, KYC, yeni hesabın günlük gönderim limiti, tek kaynaktan gelen yoğun kazanç bayrağı. |
| **Yaşlıya duygusal dolandırıcılık** ("arkadaş" sürekli hediye ister) | Kişi başı aylık harcama tavanı (varsayılan 1.000 TL, kullanıcı düşürebilir; yükseltmek 24 saat bekletmeli). Her hediyede **TL karşılığı büyük yazıyla** gösterilir. Aynı kişiye 7 günde X TL'yi aşınca "Bu kişiye bu hafta 750 TL hediye gönderdiniz" uyarısı. Özel mesaj yok (ilk sürüm). "Hediye istemek" şikâyet sebebi. |
| Ajans ve "host" sömürüsü | İlk sürümde ajans sistemi yok. Herkes eşit, sadece masadaki oyunculara hediye gönderilebilir. |
| Reşit olmayan | Kazanç 18+ ve KYC şartlı. Hediye satın alımı için yaş kapısı ve mağaza yaş derecelendirmesi (sesli sohbet + IAP: muhtemelen 17+). |

---

## 6. Onaylı hesap (para alacaklar)

1. Hesap: **Sign in with Apple / Google** zorunlu (bugünkü "sadece isim" oyun için kalır, ama hediye ve foto için hesap şart). İkisi birden sunulursa Apple kuralı karşılanır.
2. Telefon doğrulama (SMS OTP).
3. **KYC:** lisanslı ödeme kuruluşunun kendi doğrulaması (iyzico Pazaryeri, Papara, PayTR, Param) **tercih edilir**. Böylece MASAK/KYC yükümlülüğü ve kimlik saklama onlarda kalır. Alternatif: Sumsub/iDenfy (selfie + kimlik + canlılık, yaklaşık 1–2 $/kişi).
4. IBAN sahibinin adı = doğrulanmış kimlikteki ad.
5. Vergi: alıcının **GVK mük. 20/B** kapsamında istisna belgesi ve özel banka hesabı olması önerilir (banka %15 stopajı kesince vergi nihai olur). Aksi halde ödeyen olarak bizim stopaj yükümlülüğümüz doğabilir. Şekli **mali müşavir belirler.**
6. **Şirket gerekliliği:** Bugün geliştirici hesabı bireysel görünüyor. Başkalarına düzenli ödeme ve gider belgesi için şahıs veya limited şirket gerekecek. Bu bir kullanıcı kararı.

---

## 7. Sesli sohbet

**Teknoloji önerisi:** LiveKit (açık kaynak SFU), **kendi sunucumuzda**, küçük bir VPS'te (aylık yaklaşık 5–10 €, yüksek trafik kotası).
- Pi uygun değil: ev bağlantısının yükleme hızı ve UDP/NAT sorunları var. Pi oyun sunucusu olarak kalır.
- Maliyet karşılaştırması (4 kişilik masa, 1 saat = 240 katılımcı-dakika):
  - Agora: 0,99 $ / 1000 dk → yaklaşık **0,24 $/saat/masa** (ayda 10.000 dk ücretsiz)
  - LiveKit Cloud: yaklaşık 0,25–0,5 $ / 1000 dk + bant genişliği → yaklaşık 0,06–0,12 $/saat (doğrulanmalı)
  - Kendi LiveKit: sabit ücret, masa saati başına neredeyse 0
  - Reklam geliri bir masa saatinde bu tutarı karşılamayabilir. Bu yüzden ya kendi sunucu ya da sesli sohbet opsiyonel ve kotalı olmalı.
- İstemci: `@livekit/react-native` + `@livekit/react-native-webrtc` → **yeni native modül, kullanıcı onayı gerekir** (EAS derlemesi ve App Store incelemesi etkilenir).
- iOS `NSMicrophoneUsageDescription`, Android `RECORD_AUDIO`; App Privacy etiketi güncellenir (ses işlenir, saklanmaz).

**60+ arayüzü:**
- Masada tek büyük **mikrofon düğmesi**. Varsayılan "bas-konuş", ayarlardan "açık mikrofon".
- Konuşanın avatarında yeşil halka + ● işareti (renk körü için şekil de).
- Her rakibin panelinde tek dokunuşla **sustur**. Hoparlör varsayılan açık, WebRTC yankı engelleme açık.
- İlk kullanımda mikrofon izni öncesi sade bir açıklama ekranı.

**Güvenlik (Apple 1.2):**
- Sesli sohbet sadece masadaki herkes "sesli masa"yı kabul ettiyse açılır. Arkadaş masaları varsayılan sesli, halka açık masalar varsayılan sessiz.
- Şikâyet + engelleme (engellenen kişiyle bir daha aynı masaya düşmezsin). Uyarı sistemi: 3 şikâyet → 24 saat sesli sohbet yasağı → inceleme.
- Yeni hesap ilk N oyunda yabancılarla konuşamaz. Ses **kaydedilmez** (KVKK).
- Yazılı sohbet: hazır mesajlar ("Hayırlı olsun", "Çay söyle!", "Eline sağlık") + küfür filtreli serbest metin.

**Atmosfer:** isteğe bağlı kahvehane ortam sesi (çay kaşığı, taş şakırtısı, uzaktan sohbet uğultusu; düşük ses, kapatılabilir), masaya "çay ısmarla" (bedava, günde birkaç kez) gibi tepkiler.

---

## 8. Profil fotoğrafı ve yapay zekâ onayı

**Akış:**
1. Cihazda kare kırpma ve 256 px küçültme (`expo-image-picker` + `expo-image-manipulator` → **native modül; onay gerekir**).
2. Sunucuya yükleme. Fotoğraf **onaylanana kadar kimseye görünmez**, baş harfli avatar görünür.
3. **Katman 1:** OpenAI `omni-moderation` (görsel destekli, ücretsiz): çıplaklık, şiddet, nefret, kendine zarar.
4. **Katman 2:** küçük görsel model (Claude Haiku 5.5 veya Gemini Flash), JSON çıktılı politika sorusu:
   - Gerçek bir insan yüzü var mı?
   - Yazı, URL, telefon numarası, QR ya da reklam var mı?
   - Siyasi veya aşırılıkçı sembol, el hareketi var mı?
   - Çocuk tek başına mı?
   - Ünlü veya başkasının fotoğrafı gibi mi duruyor?
   - Çıktı: `{karar: onay|ret|insan, sebepler: []}`. Maliyet yaklaşık 0,001 $/foto.
5. Karar:
   - **Onay** → yayınla.
   - **Ret** → kullanıcıya nazik Türkçe sebep ("Fotoğrafta yazı var, lütfen sadece yüzünüzün olduğu bir fotoğraf seçin").
   - **Belirsiz** → basit yönetim sayfasında insan incelemesi.
6. Günde en fazla 3 yükleme. Reddedilen görselin algısal hash'i engel listesine girer. Şikâyet edilen foto yeniden incelenir.
- **Saklama:** Cloudflare R2 (lightsoldiergames hesabı, ücretsiz katman) veya Pi diski. Sadece 256 px, EXIF silinmiş.
- **KVKK:** fotoğraf kişisel veridir. Yurtdışındaki moderasyon servisine aktarım için aydınlatma metni + açık rıza / standart sözleşme. Gizlilik sayfası `lightsoldiergames.com/okey101/gizlilik` güncellenir.
- Görüneceği yerler: rakip panelleri, salon masa listesi, hediye animasyonu, el sonu ekranı.

---

## 9. Altyapı değişikliği (önemli)

Bugün sunucu durumsuz ve hafızada tutuyor. Para defteri ve hesaplar için şunlar gerekiyor:
- **Kalıcı veritabanı:** Postgres (VPS'te veya yönetilen), günlük şifreli yedek. **Para defteri Raspberry Pi'de evde tutulmamalı.**
- **Çift kayıtlı, sadece eklenen defter:** her hareket bir satır, mağaza işlem kimliğiyle idempotent. RevenueCat webhook'u imza doğrulamalı.
- Hesap silme (Apple 5.1.1(v)): uygulama içinden ve `lightsoldiergames.com/okey101/hesap-silme` sayfasından. Bekleyen kazancın akıbeti koşullarda yazılı olur.
- Yönetim paneli (moderasyon kuyruğu, şikâyetler, ödeme listesi onayı): basit, sadece geliştiriciye açık web sayfası.

---

## 10. E Aşaması önerisi (C'den sonra, D'den önce)

| Alt aşama | İçerik | Önerilen takım (Fable karar verir) |
|---|---|---|
| **E1** Hesap + profil fotoğrafı | Apple/Google girişi, DB, foto yükleme, 2 katmanlı moderasyon, yönetim kuyruğu | Opus (sunucu, güvenlik) · Antigravity (foto ekranı) · OpenCode (moderasyon test seti) |
| **E2** Sohbet | Hazır mesaj + metin, LiveKit sesli masa, şikâyet/engelleme | Opus (LiveKit token servisi) · Antigravity (mikrofon arayüzü) · Sonnet (ayarlar) |
| **E3** Hediyeler (parasız) | Jeton IAP, `@kahve/economy` lot defteri, hediye animasyonları, harcama tavanları | **Codex** (saf `economy` paketi + yoğun test) · Opus (webhook, defter) · Antigravity (hediye arayüzü) |
| **E4** Para ödemesi | KYC, IBAN, aylık ödeme listesi, iade geri alma, raporlar | Sadece hukuk/şirket hazır ve §4.4 şalteri sağlanınca. Opus + Fable. |

Her alt aşama sonunda Fable durur ve kullanıcı onayı bekler (PROMPT_LOCAL kuralı).

---

## 10b. Çapraz kontrol: Claude ↔ Argon (`KAHVE_HAVASI_argon.md`)

**Uyuşan noktalar** (güçlü sinyal): Pi'de ses olmaz (Cloudflare Tunnel UDP taşımaz), kendi VPS'te LiveKit, ses kaydedilmez, hediye oyun sonucuna asla bağlanmaz, önce parasız hediye (E3), sonra para (E4), para defteri Pi'de değil yedekli Postgres'te, çift kayıtlı ve sadece eklenen defter, OpenAI ücretsiz moderasyon + küçük görsel model, R2 saklama, GVK 20/B, lisanslı ödeme kuruluşu, 60+ harcama tavanı.

**Argon'dan alınan iyileştirmeler:**
- **Bas-konuş yerine dokun-aç / dokun-kapat mikrofon**, masaya oturunca mikrofon kapalı. Taş sürüklerken düğmeye basılı tutmak 60+ için zor.
- iOS `AVAudioSessionModeVoiceChat` / Android `MODE_IN_COMMUNICATION` ile donanım yankı engelleme. Ortam sesi mikrofon açılınca kısılır.
- Serbest yazı ilk sürümde yok (yatay ekranda klavye masayı kapatıyor), sadece hazır "Kahve Sözleri" + emoji. Serbest yazı en fazla şifreli arkadaş masasında, telefon/IBAN maskeli.
- **20 hazır SVG avatar** + isteğe bağlı foto. Çiçek, manzara, kedi gibi zararsız fotoğraflara izin. Kimlik kartı, fatura veya ekran görüntüsü yüklenirse kaydedilmeden silinir.
- Misafir başlangıç korunur. Giriş (Apple/Google) sadece foto, ses veya hediye istenince sorulur.
- Hesap silmede bakiye varsa 14 gün askı süresi. Defter kayıtları vergi mevzuatı gereği anonimleştirilerek saklanır. Apple token iptali (`/auth/revoke`) yapılır.

**Argon'da düzeltilmesi gerekenler:**
| Argon önerisi | Sorun | Karar |
|---|---|---|
| Alıcıya **brütün sabit %30'u** | Bonus jeton, büyük paket indirimi ve ucuz bölge fiyatında brüt değil gerçekte daha az para gelir. Sabit oran zarar ettirebilir. | **Lot muhasebesi (§4.1)**: gerçek net tutarın %40'ı. Brüte oranı zaten yaklaşık %23–28. |
| Eşik altı puanla "Reklamsız" alınabilsin | Apple 3.1.1: uygulama özelliğinin kilidi IAP dışı bir değerle açılamaz. Risk var. | Yok. Puan sadece hediye olarak harcanır ya da birikir. |
| NVİ TCKN servisi 30.09.2025'te kapandı | Kaynak gösterilmemiş. | **Doğrulanmalı.** Zaten KYC'yi ödeme kuruluşuna bırakıyoruz. |
| Stripe Identity (1,5 $, sabit ücret yok) | Stripe Türkiye'deki şirketlere hesap açmıyor. | Ödeme kuruluşunun kendi KYC'si veya Didit/Veriff/yerli sağlayıcı. **Doğrulanmalı.** |
| Moderasyon için Vertex Gemini Flash | Kullanıcının Google Cloud hesapları deneme kredili ve 290 $'da sert duruyor. Üretim bağımlılığı oraya konmamalı. | Ayrı ücretli proje/API anahtarı ya da Claude Haiku. |
| Başa baş 25.000 TL/ay | Daha yüksek sabit gider varsayımı (8.400 TL). Bizimki 6.500 TL → 15.500 TL. | Fark sabit giderden. Gerçek teklifler gelince tek formülle hesaplanır: `başa baş brüt = sabit gider ÷ (brüt başı platform payı)`. |
| Aylık 1.000 TL harcama tavanı **+ günlük 250 TL** | — | Uygun, eklendi. |

## 11. Kullanıcının vermesi gereken kararlar
1. Yeni native modüller: LiveKit WebRTC, `expo-image-picker` / `expo-image-manipulator`.
2. Sesli sohbet sunucusu: kendi VPS (önerilen) mi, Agora / LiveKit Cloud mu?
3. Para ödemesi için şirket ve mali müşavir. Hazır olana kadar hediyeler parasız mı başlasın?
4. Alıcı payı: net gelirin %40'ı (önerilen) mi, başka bir oran mı?
5. Ödeme kuruluşu tercihi (iyzico / Papara / PayTR / Param) ve KYC yöntemi.
6. Kişi başı aylık harcama tavanının varsayılanı.

## Kaynaklar
- Bigo Beans oranları: https://topuplist.com/blogs/detail/bigo-live-beans-explained-2026 · https://www.ldshop.gg/blog/bigo-live/streamer-earning-guide.html
- TikTok hediye payı: https://streamer.guide/guides/tiktok-live-gifts-coins-diamonds · https://www.lilachbullock.com/how-much-does-tiktok-take-from-gifts/
- Apple bahşiş/IAP: https://appleinsider.com/articles/17/06/09/apple-changes-app-store-rules-to-allow-tips-via-in-app-purchases-block-custom-review-prompts · https://techcrunch.com/2024/02/21/in-a-reversal-apple-is-now-demanding-30-of-the-donations-to-meditation-app-insight-timers-teachers/amp
- GVK 20/B: https://oner.av.tr/sosyal-icerik-ureticilerinin-vergilendirilmesi/ · https://bilalalyar.av.tr/influencer-vergi-beyani-gelir-vergisi/
- Ses maliyeti: https://www.agora.io/en/pricing/voice-calling · https://www.forasoft.com/blog/article/livekit-vs-agora-cost-analysis
- Görsel moderasyon fiyatları: https://cloud.google.com/vision/pricing · https://www.activepieces.com/blog/aws-rekognition-pricing-cost-per-feature-2026
- Google Voided Purchases: https://developers.google.com/android-publisher/voided-purchases
