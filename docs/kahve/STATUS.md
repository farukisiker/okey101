# Demli Kahve: Durum Panosu

> Bu dosyayı sadece Fable günceller (ORKESTRA §3.6). Takımlar `docs/kahve/reports/<GÖREV>.md` dosyasına yazar.

## Test tabanı (azalamaz)
| Tarih | Commit | shared | server | diğer | Toplam | typecheck |
|---|---|---|---|---|---|---|
| 15.11.2026 | `1254b41` (Faz 0 merge) | 70 (5 dosya) | 23 (3 dosya) | – | **93** | shared, server, app yeşil |
| 15.11.2026 | `fb5afcf` (A1+A2+A3+A5) | 70 | 30 + 5 beklenen hata | core 35, catalog 47 | **187** | 5 paket yeşil |
| 15.11.2026 | A4 + A5 ek (Faz A kod tamam) | 70 | 53 | core 41, catalog 50 | **214** | 5 paket yeşil, 2 tam koşu |
| 15.11.2026 | A7 (okey kural güncellemesi + ceza paneli) `d4090a5` | 104 | 65 | core 41, catalog 61 | **271** | 5 paket yeşil |

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
| A7 okey kuralları + ceza paneli | Claude Opus (kurallar, sunucu, net) + Claude Sonnet (arayüz) | **birleşti** (2 DÜZELT turu: çoklu ceza bildirimi, yavaş testlere zaman aşımı) | `b157ac0`, `d4090a5` | Kullanıcı kararları MASTER_PLAN §4c. Cihazda denenmedi (A6'ya eklendi). v1 istemcide geri sayım donmayı göstermez |
| A6 elle deneme | Fable + kullanıcı | **kullanıcıyı bekliyor** | – | Telefon/emülatörde 101 ve Düz: çevrimdışı + yerel sunucu + mağazadaki v1.0.1; A7: ceza paneli 5 sn + saat donması, yandan alma onayı, maç uzunluğu, Maç bitti |

## Ortam (15.11.2026)
- Bu oturum Fable rolünü **Claude Opus 5.5** ile yürütüyor (`claude-fable-5-2` değil).
- Codex CLI 0.164.0: Astra `gpt-6-astra`, Sol `gpt-6.1-sol`.
- Antigravity `agy`: Argon `gemini-4-argon-high`, Flash `gemini-3.8-flash-high`.
- OpenCode: PATH'te yok ama masaüstü CLI'ı var (`%APPDATA%\ai.opencode.desktop\cli\2.0.31-x64\opencode-cli.exe`). Global kurulum gerekmedi.
  Lider `opencode/glm-5.3-flash-free`, işçi `opencode/deepseek-v4.1-flash-free`.
