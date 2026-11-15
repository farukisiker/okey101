GÖREV: A3-OC  FAZ: A
AMAÇ: Mağazadaki v1.0.1 istemcisinin sunucuyla konuşmasını sabitleyen uyumluluk testleri (önce yazılır; A4 bunları yeşil tutmak zorunda).
OKU: docs/kahve/MASTER_PLAN.md §2.2, shared/src/protocol.ts, server/src/server.ts, server/test/server.test.ts (yardımcı kalıbı),
     v1.0.1 istemcisinin gönderdikleri: `git show c19eea2:app/src/net/useOkey.ts`
SÖZLEŞME: shared/src/protocol.ts @ 2d1c37b (değiştirme)
WORKTREE: C:/Users/mfaru/okey101/kahve-oc (dal feat/kahve-oc)
SAHİP OLDUĞUN YOLLAR: server/test/compat-v1.test.ts, server/test/compat-v2.test.ts, server/test/fixtures/v1/**
DOKUNMA: server/src/**, shared/**, app/**, mevcut test dosyaları, package.json, lockfile. Yeni bağımlılık YOK.

compat-v1.test.ts (bugünkü sunucuda YEŞİL olmalı):
- `auth` göndermeyen soket; `room:quickPlay {name}` (mode yok → 101) ve `{name, mode:'duz'}` → düz;
  `game:view` yükü çıplak PlayerView (hand, players, turn var; `game`/`view` sarmalı YOK).
- `room:create {name, isPublic:true}` + ikinci soket `room:join` + `room:start`; RoomInfo'da `mode` var.
- Bir eli sonuna kadar oynama: insan koltuğu her turda çek + at (basit istemci), el bitince `room:nextRound` kabul edilir.
  Sunucu `createOkeyServer({ botDelayMs: 1, turnTimeoutMs: 0 })`; test 20 sn içinde biter.
- `salon:watch(true)` (ikinci argüman yok) → `salon:list` sadece okey masaları; her TableSummary'de `mode`.
- useOkey'den çıkardığın v1.0.1 mesaj dizisini `fixtures/v1/messages.json` olarak kaydet ve bir testte o sırayla gönder.
compat-v2.test.ts (bugün KIRMIZI; her biri `it.fails` ile, ≤2 sn zaman aşımı):
- `auth:{v:2}` + `room:quickPlay {name, game:'okey101'}` → `game:view` yükü `{game:'okey101', view}`.
- v1 soket + `room:create {name, game:'pisti'}` → `{ok:false, error: ERR_UPDATE_APP}`.
- v2 soket `salon:watch(true, {games:['okey101','pisti']})` → TableSummary'lerde `game` dolu.
- RoomInfo.game okey masasında 'okey101' / 'okeyDuz'.
KABUL: `corepack pnpm --filter @okey/server test` yeşil (it.fails'ler geçmiş sayılır), kökte `pnpm test` / `typecheck` yeşil, test sayısı ≥ 93 + yeniler.
BİTİŞ: feat/kahve-oc'da commit + docs/kahve/reports/A3-OC.md (test çıktısının son satırları yapıştırılmış). Push YOK.
