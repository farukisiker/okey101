KARAR: ONAY

B3 kapsamındaki ihale, yasal kartlar, löve kazananı, puanlama ve 9 el + tek uzatma davranışında engelleyici hata bulmadım. Rakip elleri gizli; botlar yalnız view kullanıyor. JSON klon ve hatalı JSON aksiyonlarının reddi uygun. Dosya değiştirmedim.

- **P3 — `packages/batak/test/scoring.test.ts:23`:** “İhaleci sıfır löve aldı” testi yanlış kurulmuş: `declarer=2`, fakat o oyuncunun aldığı löve `4`. İhaleciyi `0` yaparak, üç ceza modunda da yalnız `−contract` yazıldığını doğrulamalı. Üretim kodundaki hesap doğru.
- **Doğrulama sınırı — `packages/batak/test/simulation.test.ts:70`:** Onaylı B3 planındaki 200 seed çalışıyor. PROMPT_LOCAL’ın tüm B aşaması için istediği 1000 seed ve %85 kapsam bu çalıştırmayla kanıtlanmış değil.

Kendim çalıştırdığım komutların gerçek çıktıları; ikisi de **çıkış kodu 0**:

```text
> corepack pnpm --filter @kahve/batak test
$ vitest run --passWithNoTests

 RUN  v5.0.5 C:/Users/mfaru/okey101/kahve-codex/packages/batak

 Test Files  6 passed (6)
      Tests  60 passed (60)
   Start at  04:26:41
   Duration  19.59s (tests 94%, transform 4%, import 1%)
```

```text
> corepack pnpm --filter @kahve/batak typecheck
$ tsc --noEmit
```