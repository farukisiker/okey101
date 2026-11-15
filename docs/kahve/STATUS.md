# Demli Kahve: Durum Panosu

> Bu dosyayı sadece Fable günceller (ORKESTRA §3.6). Takımlar `docs/kahve/reports/<GÖREV>.md` dosyasına yazar.

## Test tabanı (azalamaz)
| Tarih | Commit | shared | server | diğer | Toplam | typecheck |
|---|---|---|---|---|---|---|
| 15.11.2026 | `1254b41` (Faz 0 merge) | 70 (5 dosya) | 23 (3 dosya) | – | **93** | shared, server, app yeşil |

Komutlar: `pnpm test`, `pnpm typecheck`. Bu makinede `pnpm` PATH'te yok; `corepack pnpm` kullan
(kök script'ler içeriden `pnpm` çağırdığı için PATH'e `pnpm.cmd` = `@corepack pnpm %*` sarmalayıcısı koy).

## Görevler
| Görev | Sahip | Durum | Son commit | Engel / not |
|---|---|---|---|---|
| F0 çift açma merge | Claude Opus (alt ajan) → Fable review | **birleşti** | `1254b41` | Çift açma `feat/okey101-app`'te yok; canlıya alınması kullanıcı kararı |
| A0 sözleşmeler | Fable | **birleşti** (onay bekliyor) | A0 commit'i | `@kahve/core` types + protocol v2 ekleri |
| A1 game-core | Codex (Astra → Sol) | plan bekliyor | – | Kullanıcı onayı bekleniyor |
| A2 okey adaptörü + catalog | Claude Opus | plan bekliyor | – | Kullanıcı onayı bekleniyor |
| A3 uyumluluk fikstürleri | OpenCode (yedek: Claude Haiku) | plan bekliyor | – | Kullanıcı onayı bekleniyor |
| A4 Room / useLocalGame / protokol | Claude Opus | bekliyor | – | A1, A2'ye bağlı |
| A5 Kahve kabuğu UI | Claude Sonnet | plan bekliyor | – | Kullanıcı onayı bekleniyor |
| A6 elle deneme | Fable + kullanıcı | bekliyor | – | En son |

## Ortam (15.11.2026)
- Bu oturum Fable rolünü **Claude Opus 5.5** ile yürütüyor (`claude-fable-5-2` değil).
- Codex CLI 0.164.0: Astra `gpt-6-astra`, Sol `gpt-6.1-sol`.
- Antigravity `agy`: Argon `gemini-4-argon-high`, Flash `gemini-3.8-flash-high`.
- OpenCode: PATH'te yok ama masaüstü CLI'ı var (`%APPDATA%\ai.opencode.desktop\cli\2.0.31-x64\opencode-cli.exe`). Global kurulum gerekmedi.
  Lider `opencode/glm-5.3-flash-free`, işçi `opencode/deepseek-v4.1-flash-free`.
