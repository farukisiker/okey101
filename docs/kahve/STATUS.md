# Demli Kahve: Durum Panosu

> Bu dosyayı sadece Fable günceller (ORKESTRA §3.6). Takımlar `docs/kahve/reports/<GÖREV>.md` dosyasına yazar.

## Test tabanı (azalamaz)
| Tarih | Commit | shared | server | diğer | Toplam | typecheck |
|---|---|---|---|---|---|---|
| 15.11.2026 | `1254b41` (Faz 0 merge) | 70 (5 dosya) | 23 (3 dosya) | – | **93** | shared, server, app yeşil |
| 15.11.2026 | `fb5afcf` (A1+A2+A3+A5) | 70 | 30 + 5 beklenen hata | core 35, catalog 47 | **187** | 5 paket yeşil |
| 15.11.2026 | A4 + A5 ek (Faz A kod tamam) | 70 | 53 | core 41, catalog 50 | **214** | 5 paket yeşil, 2 tam koşu |
| 15.11.2026 | A7 (okey kural güncellemesi + ceza paneli) `d4090a5` | 104 | 65 | core 41, catalog 61 | **271** | 5 paket yeşil |
| 16.11.2026 | Faz B sonu `e9c3050` | 104 | 77 | core 41, cards 36, pisti 46, batak 60, catalog 77, app 30 | **471** | 8 paket yeşil |

Komutlar: `pnpm test`, `pnpm typecheck`. Bu makinede `pnpm` PATH'te yok; `corepack pnpm` kullan
(kök script'ler içeriden `pnpm` çağırdığı için PATH'e `pnpm.cmd` = `@corepack pnpm %*` sarmalayıcısı koy).

## Görevler
| Görev | Sahip | Durum | Son commit | Engel / not |
|---|---|---|---|---|
| F0 çift açma merge | Claude Opus (alt ajan) → Fable review | **birleşti** | `1254b41` | Çift açma `feat/okey101-app`'te yok; canlıya alınması kullanıcı kararı |
| A0 sözleşmeler | Fable | **birleşti** | `2d1c37b`, `c14725b` | `@kahve/core` types + protocol v2 ekleri |
| A1 game-core | Codex (Astra → Sol) | **birleşti** (Astra ONAY) | `8fa84d4` | Codex sandbox `.git`'e yazamıyor: commit'i Fable atıyor |
| A2 okey adaptörü + catalog | Claude Opus | **birleşti** | `5e631d8` | Düz eşdeğerlik varsayılan 20 seed; tam tarama `KAHVE_EQ_SEEDS=200` (geçti, ~150 sn) |
| A3 uyumluluk fikstürleri | OpenCode (deepseek işçi, glm lider) | **birleşti** (lider ONAY) | `fb5afcf` | v2 testleri `it.fails`, A4 yeşile çevirir |
| A4 Room / useLocalGame / protokol | Claude Opus | **birleşti** | `e4e405b`, `7c500d6` | expo export Android: 1444 modül, Hermes paketi 5.4 MB, metro ayarı gerekmedi. İstek: `requests/opus-renameSeat.md` (B öncesi) |
| A5 Kahve kabuğu UI | Claude Sonnet | **birleşti** (1 DÜZELT turu: iOS'ta salona dönüş düğmesi; oyun listesi artık `@kahve/catalog`) | `cd64395` + ek | Cihazda denenmedi (A6) |
| A5b i18n denetimi | Claude Haiku | **geçti** | – | 228 anahtar × 13 dosya eşit, UTF-8 temiz, yer tutucular eşit |
| A7 okey kuralları + ceza paneli | Claude Opus (kurallar, sunucu, net) + Claude Sonnet (arayüz) | **tamam** (tablette denendi) (2 DÜZELT turu: çoklu ceza bildirimi, yavaş testlere zaman aşımı) | `b157ac0`, `d4090a5` | Kullanıcı kararları MASTER_PLAN §4c. Cihazda denenmedi (A6'ya eklendi). v1 istemcide geri sayım donmayı göstermez |
| FIX-DRAG ıstakada bırakılan taşın geri kayması | Claude Opus | **birleşti** | `a0ed5bb` | A6'da tablette bulundu. Neden: bırakınca UI thread taşı eski yuvaya yaylıyor, JS yeni yuvayı geç commit ediyor. Canlı 1.0.1'de de var (1.0.2 hotfix kararı kullanıcıda). Test 280 |
| A6 elle deneme | Fable + kullanıcı | **tamam** (16.11.2026, tablette; kullanıcı: "güzel olmuş, devam B aşamasına geç") | `f69e794` | Bulunan: ıstaka bırakma geri kayması (FIX-DRAG) + oturma animasyonu %50 hızlandı |

## Ortam (15.11.2026)
- Bu oturum Fable rolünü **Claude Opus 5.5** ile yürütüyor (`claude-fable-5-2` değil).
- Codex CLI 0.164.0: Astra `gpt-6-astra`, Sol `gpt-6.1-sol`.
- Antigravity `agy`: Argon `gemini-4-argon-high`, Flash `gemini-3.8-flash-high`.
- OpenCode: PATH'te yok ama masaüstü CLI'ı var (`%APPDATA%\ai.opencode.desktop\cli\2.0.31-x64\opencode-cli.exe`). Global kurulum gerekmedi.
  Lider `opencode/glm-5.3-flash-free`, işçi `opencode/deepseek-v4.1-flash-free`.

## Faz B (16.11.2026 başladı, kullanıcı onayı)
| Görev | Sahip | Durum | Son commit | Engel / not |
|---|---|---|---|---|
| B1 @kahve/cards | Codex (Astra → Sol) | **birleşti** (Astra ONAY) | `307dcdb` | 36 test |
| B2 @kahve/pisti | Codex (Sol) + Claude Opus review | **birleşti** | `e372901` | Astra 1 GERİ GÖNDER (bot hafızası) → Sol düzeltti; Codex kotası bitince yeniden review + structuredClone→JSON clone Claude Opus. 46 test, 200 seed 0 geçersiz |
| B3 @kahve/batak | Claude Opus (Codex kotası yedeği) | **birleşti** | `ed2d3eb` | 60 test, 200 maç 0 geçersiz; hard bot medium'dan az güçlü (savunma oyunu yok). Codex dönünce Astra ikinci göz review'u önerilir |
| B4 CardView + Pişti/Batak ekranları | Antigravity (Argon → Flash) | **birleşti** (Argon 1 GERİ GÖNDER) | `bae492b` | SVG yok. agy headless komut çalıştıramıyor: Flash sadece dosya yazar, typecheck/commit Fable. Sesler (.wav) henüz yok. Açık: köşe takım simgesi 12 pt |
| B5 catalog/sunucu/çevrimdışı entegrasyon | Claude Opus | **birleşti** (Pişti + Batak) | `80537c6`, `ca6e4fc` | İki oyun da çevrimdışı ve çevrimiçi oynanır |
| B6 GameShell + reklam kapısı | Claude Sonnet | **birleşti** | `7e71dd4` | okey reklam davranışı testle sabit |
| B7 docs/oyunlar | OpenCode | **birleşti** | `5c959df` | ayar adları motorla son eşitleme bekliyor |
| B8 sim + sızıntı testleri | Cline (+ Fable doğrulama) | **birleşti** | `4e19853`, `1b62665`, `96ac843`, `6b4a54f` | 1000 seed: okey 2000 el, Pişti 2000 el, Batak 1000 maç eli → 0 geçersiz, 0 bitmeyen |
| B12 telefon kompakt düzen + koltuk sırası + el karartma | Claude Sonnet | **birleşti** | B12 merge | 6" telefonda başlık 156→96 dp, Batak löve kartı 24→58-72 dp; tablet ölçüleri birebir aynı (testle sabit). Üst panel sırası batı-kuzey-doğu (löve haçıyla aynı). İhale/koz sırasında el tam renkli. Telefonda cihazda denenmedi |
| B11 Batak tablet testi düzeltmeleri | Claude Sonnet | **birleşti** | B11 merge | Tablet duman testi (e9c3050) GEÇTİ; löve alanı çakışmasız haç + "Sen", ihale/koz diyalogları eli karartmıyor, el sonunda ihale satırı. **Açık (B12):** 6" telefonda löve kartları ~25 dp (GameShell başlığı ~144 dp yer kaplıyor); telefon için kompakt başlık gerekli |
| B10 Pişti tablet testi düzeltmeleri + test reklam bayrağı | Claude Sonnet | **birleşti** | `33b66ae` | Tablet duman testi (80537c6) GEÇTİ, 4 UI hatası düzeltildi; `EXPO_PUBLIC_TEST_ADS=1` test APK'larında Google test reklamı (gerçek kimlikler değişmedi). Ara sıra zaman aşımına düşen 2 sunucu testi tekrar görüldü (yük altında) |
| B9 kart sesleri + köşe simgesi | Claude Sonnet | **birleşti** | `e9c3050` | card-play.wav 4 KB, card-take.wav 7.5 KB |

## Faz B özeti (16.11.2026 03:15, kullanıcı sabaha kadar yoktu; koordinatörün "bitirebildiğin adımları uygula" talimatıyla)

**Yapılan**
- Kart motoru `@kahve/cards`, **Pişti** (`@kahve/pisti`) ve **Batak** (`@kahve/batak`, ihaleli tekli) kural motorları; botlar Acemi/Orta/Usta.
- Kart görselleri SVG'siz (RN View/Text + ♠♥♦♣), Pişti ve Batak ekranları, ihale ve koz diyalogları, ortak `GameShell`, oyundan bağımsız reklam kapısı.
- Uçtan uca: Kahve Salonu → Kağıt Masaları → oyun lobisi → Hemen Oyna (botlarla, çevrimdışı) veya Arkadaşlarla (salon, şifreli masa, kodla katılma). Geri tuşu, "Son oynadığın".
- Doğrulama: 471 test (Faz A sonu 280), 8 paket typecheck yeşil; 1000 seed bot-bot sim tüm oyunlarda 0 geçersiz hamle; her oyun için `viewFor` sızıntı testleri (gizli kümeyi karıştırınca görünüm bayt-eşit).
- Belgeler: `docs/oyunlar/pisti.md`, `batak.md` (ayar tabloları motorla eşit), README "Kurallar" linkleri.

**Nasıl denenir (tablet)**
- APK: feat/kahve @ en son commit (B10 + B11 düzeltmeleri + sesler), **`EXPO_PUBLIC_TEST_ADS=1` ile derle** (kendi cihazımızda gerçek reklam gösterilmesin). Yol: Kahve Salonu → Kağıt Masaları → Pişti (2 / 4 tekli / 4 eşli) veya Batak (4) → Hemen Oyna.
- Çevrimiçi: yerel sunucu (`pnpm server`, adb reverse :3001). **Pi güncellenmedi** (kullanıcı kararı); güncellenene kadar kart masalarında "sunucu güncelleniyor" mesajı.
- Ayrıntılı adımlar: `docs/kahve/reports/B5-OPUS.md`.

**Uygulanan genel kabul varsayılanları** (kullanıcı: "genel kabul gören kurallarla yap şimdilik"; hepsi ayar, sonra değiştirilebilir):
- Pişti: hedef 151; açılışın 3 kapalı kartı ilk toplayana gider ve herkese gösterilir; açılışta Vale çıkarsa desteye sokulup yeni kart açılır; 4 kişide varsayılan tekli (eşli seçenek).
- Batak: ihale 5'ten; herkes pas → dağıtıcıya zorunlu 4; renge uymak zorunlu; geçebiliyorsan geçmek zorunlu; renk yoksa koz atmak zorunlu (geçemese de); koz kırılmadan koz açılamaz; batan −ihale, hiç el almayan −ihale; maç 9 el; eşitlikte 1 uzatma eli.
- Süre: her tur 30 sn, elin ilk turu 60 sn (okey ile aynı).

**Bilinen eksikler**
- Cihazda henüz kullanıcı denemesi yok (koordinatör tablet duman testi yapıyor).
- Batak Usta bot Orta'dan biraz güçlü (savunma oyunu yok). Eşli Batak, Koz Maça, Gömmeli ilk sürümde yok.
- Yeni metinler 11 dilde İngilizce yer tutucu (çeviri Faz D).
- Olası çift reklam sayımı: el sonu ekranındayken uygulama arka plana atılıp dönülürse (tablette denenmeli).
- Batak motoru Codex kotası bittiği için Claude Opus'ta yazıldı; Codex dönünce (04:23 sonrası) Astra'nın ikinci göz review'u önerilir.
- Kapsam yüzdesi ölçülmedi (coverage paketi bilerek eklenmedi); yerine test–kural eşleme tabloları raporlarda.

**Ortam notları**
- Codex sandbox `.git`'e yazamıyor; Antigravity headless komut çalıştıramıyor (Flash sadece dosya yazar; typecheck/commit Fable). Codex `exec` için stdin `< /dev/null` şart (yoksa bekler).
- Codex kotası 02:40'ta bitti (04:23'te döner); B2 review ve B3 Claude Opus'a geçti (ORKESTRA §1.6).

**Açık kararlar (kullanıcı)**
1. Bölgesel kuralların varsayılanları (yukarıdaki liste) uygun mu?
2. Pi sunucusunun bu dala güncellenmesi (çevrimiçi kart masaları için) ne zaman?
3. Faz C (Tavla) için "devam".
4. Daha önceden açık: çift açma ve sürükleme düzeltmesinin canlı `feat/okey101-app`'e alınması (1.0.2), Faz E kararları.
