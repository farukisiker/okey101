# A3-OC Raporu — Uyumluluk Fikstürleri (Faz A)

**Durum:** Bitti (review bekliyor) · **Dal:** `feat/kahve-oc` · **Worktree:** `C:/Users/mfaru/okey101/kahve-oc`
**Sözleşme:** `shared/src/protocol.ts` @ `2d1c37b` (değiştirilmedi) · **Plan:** `docs/kahve/plans/A3-OC.md` (ONAYLANDI 2026-11-15, Fable)

## 1) Özet

`server/src`, `shared`, `app`, mevcut testler, `package.json` ve lockfile'a **dokunulmadı**; yeni bağımlılık yok. Sadece sahip olunan üç yol + bu rapor eklendi. Mağazadaki v1.0.1 istemcisinin bugünkü sunucuyla konuşması 7 testle sabitlendi (hepsi **bugün yeşil**); v2 sözleşmesi 5 `it.fails` testiyle kırmızı-ama-geçen olarak yazıldı (A4 bunları yeşile çevirmek zorunda).

| Ölçüm | Önce | Sonra |
|---|---|---|
| server testleri | 23 (3 dosya) | **35** (5 dosya): 30 geçti + 5 `it.fails` |
| shared testleri | 70 (5 dosya) | 70 (değişmedi) |
| toplam (kök `pnpm test`) | 93 | **105** |
| typecheck | yeşil | yeşil (shared, server, app, packages) |

## 2) Değişen dosyalar

| Dosya | Ne |
|---|---|
| `server/test/compat-v1.test.ts` | **yeni** — 7 test: authsız soket, `quickPlay` (mode yok → 101 / `'duz'`), çıplak `PlayerView`, create+join+start (`RoomInfo.mode`), **iki tam el** (101 ve düz) + `room:nextRound`, `salon:watch(true)`, v1.0.1 mesaj dizisi replay'i |
| `server/test/compat-v2.test.ts` | **yeni** — 5 `it.fails` (her biri ≤ 2 sn): `{game, view}` zarfı, `ERR_UPDATE_APP`, salon filtresi + `TableSummary.game`, `RoomInfo.game` = `'okey101'` / `'okeyDuz'` |
| `server/test/fixtures/v1/messages.json` | **yeni** — `c19eea2:app/src/net/useOkey.ts`'ten çıkarılan v1.0.1 mesaj dizisi (11 adım) |
| `docs/kahve/reports/A3-OC.md` | **yeni** — bu rapor |

**Test commit'i:** `3780e2d` — `test(server): A3 compat fixtures for the v1.0.1 client and failing v2 contract`
**Rapor commit'i:** bu dosyayı içeren ayrı `docs(kahve)` commit'i (`git log -1 -- docs/kahve/reports/A3-OC.md`).

## 3) Alt görevler

- **SG1 (fikstür):** `useOkey`'in gönderdiği olaylar ve yükleri: `salon:watch true` (filtresiz), `room:create {name, mode, isPublic, password?}`, `room:join {roomId, name, password?}` (yeniden bağlanınca koltuğu geri alma), `room:start`, `room:nextRound`, `game:action`, `room:leave`, `room:quickPlay {name, mode}`. Handshake `auth` **yok**.
  - Fable şeması `{ source, steps: [{ event, payload?, expectAck? }] }` aynen kullanıldı. Tek ek: `placeholders` — `roomId` çalışma anında oluştuğu için `"$roomId"` jetonu `room:create` ack'inden doldurulur; `note` alanları adımın nedenini yazar.
- **SG2 (v1 ilk yarı):** `quickPlay {name}` → `hand` 22, `players` `[22,21,21,21]`, `turnPhase: 'play'`, `mode: '101'`; `{name, mode:'duz'}` → 15 / `[15,14,14,14]`. Yükün **çıplak `PlayerView`** olduğu `not.toHaveProperty('view')` + `not.toHaveProperty('game')` ile sabitlendi. `room:create {isPublic:true}` + ikinci soket `room:join` + `room:start` → `RoomInfo` `mode:'duz'`, `isBot` `[false,false,true,true]`, `hostSeat 0`, `totals [0,0,0,0]`.
- **SG3 (v1 ikinci yarı):** İnsan koltukta her tur çek+at (basit istemci) ile el sonuna kadar oynandı — **hem `'101'` hem `'duz'`** (Fable notu); `phase: 'finished'` ve `result` dolu, sonra `room:nextRound` → `{ok:true}`. `createOkeyServer({ botDelayMs: 1, turnTimeoutMs: 0 })`, test başına 30 sn üst sınır (gerçek süre: iki el toplam ~1,5 sn). `salon:watch(true)` → yalnız okey masaları; her `TableSummary`'de `mode` var, public masa `seats: ['Salon', null, null, null]`, `free: 3`.
- **SG4 (replay):** `it('v1.0.1 client message sequence')` fikstürü sırayla gönderir; her `expectAck` adımında beklenen ack doğrulanır (kabul: `{ok:true}`; reddedilen: `{ok:false, error: '...'}`), `room:leave`/`salon:watch` ack'siz gönderilir.
- **SG5 (v2):** 5 senaryo, hepsi `it.fails` + 1500 ms `Promise.race` + 2000 ms test timeout; soketler `afterEach`'te kapatılır. **Her testin bugün *doğru sebeple* kırmızı olduğu doğrulandı** (geçici olarak `it.fails` → `it` çevrilip çalıştırıldı, sonra geri alındı):
  - zarf: `expected { mode: '101', seat: +0, …(17) } to match object { game: 'okey101' }`
  - `ERR_UPDATE_APP`: `expected { ok: true, roomId: '0U24V', seat: +0 } to deeply equal { ok: false, …(1) }`
  - salon: `expected undefined to be defined`
  - `RoomInfo.game`: `expected undefined to be 'okey101'` / `'okeyDuz'`

## 4) Çalıştırılan komutlar ve çıktıların son satırları (birebir yapıştırıldı)

### `corepack pnpm --filter @okey/server test`

```
$ vitest run

 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-oc/server


 Test Files  5 passed (5)
      Tests  30 passed | 5 expected fail (35)
   Start at  17:37:29
   Duration  4.19s (tests 72%, import 26%, transform 2%, worker 1%)
```

### `corepack pnpm --filter @okey/server typecheck`

```
$ tsc --noEmit
```

### Kökte `pnpm test`

```
$ vitest run

 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-oc/server


 Test Files  5 passed (5)
      Tests  30 passed | 5 expected fail (35)
   Start at  17:38:46
   Duration  5.19s (tests 67%, import 30%, transform 2%, worker 1%)
```

(Kök çıktının tamamında shared 5 dosya / 70 test geçti, `packages/*` test dosyası yok — `--passWithNoTests` ile 0.)

### Kökte `pnpm typecheck`

```
$ pnpm -r typecheck
packages/game-core typecheck$ tsc --noEmit
packages/game-core typecheck: Done
shared typecheck$ tsc --noEmit
shared typecheck: Done
packages/catalog typecheck$ tsc --noEmit
packages/catalog typecheck: Done
app typecheck$ tsc --noEmit
server typecheck$ tsc --noEmit
server typecheck: Done
app typecheck: Done
```

## 5) Bilinen eksikler / notlar

- **`pnpm` PATH'te yok:** kök `pnpm test` / `pnpm typecheck` script'leri içeriden `pnpm` çağırıyor. `corepack pnpm test` bu yüzden `'pnpm' is not recognized` ile düşüyor. Çözüm: STATUS.md'de yazılı olduğu gibi PATH'e `pnpm.cmd` (`@corepack pnpm %*`) sarmalayıcısı eklendi; yukarıdaki kök çıktılar bu sarmalayıcıyla alındı. Repoya dosya eklenmedi (sarmalayıcı `%TEMP%`).
- **Final sözlüğü:** v1 testlerinde `salon`/`RoomInfo` için `game` alanının **yokluğu** iddia edilmedi (A4 ekleyecek); yalnız `game:view` zarfının yokluğu sabitlendi (v1 soket zarf almaya devam etmemeli).
- **v2 beklentileri A4'e bağlayıcı:** `auth:{v:2}` + `quickPlay {name, game}` → `{game, view}`; v1 soket + `game:'pisti'` → `ERR_UPDATE_APP`; salon filtresi → `TableSummary.game`; `RoomInfo.game` = `okey101`/`okeyDuz`. `it.todo`'ya çevrilmedi, `it.fails` bırakıldı.
- **Fixture şeması:** onaylı şemaya ek olarak `placeholders` ve bilgilendirici `note` alanları var; `roomId` için tek jeton `$roomId`. Fable farklı ortak şema isterse yalnız fikstür + replay testi değişir.
- Push yapılmadı. `docs/kahve/STATUS.md` (Fable'ın panosu) güncellenmedi.
