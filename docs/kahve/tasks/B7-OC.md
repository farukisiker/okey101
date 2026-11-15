GÖREV: B7-OC  FAZ: B
AMAÇ: Kural belgeleri `docs/oyunlar/pisti.md` ve `batak.md` + README linkleri. (Sim/sızıntı testleri 16.11'de Cline'a taşındı: B8-CLINE.)
OKU: PROMPT_LOCAL.md §3 B ve §4 (docs/oyunlar), docs/kahve/arastirma/KURALLAR_argon.md OYUN 3–4 ve Bölüm 3, docs/kahve/MASTER_PLAN.md §4e (bölgesel kural varsayılanları), README.md
WORKTREE: C:/Users/mfaru/okey101/kahve-oc (önce `git merge feat/kahve`)
SAHİP OLDUĞUN YOLLAR: docs/oyunlar/**, README.md "Kurallar" bölümü (sadece link ekleme)
DOKUNMA: packages/*/src/**, shared/**, server/**, app/**, package.json, lockfile. Yeni bağımlılık YOK.

ADIM 1 (şimdi):
- `docs/oyunlar/pisti.md` ve `batak.md`: Türkçe, 60+ okuyucu için sade; kurulum, oynanış, puanlama, bitiş, tüm AYARLAR tablosu (ad, seçenekler, varsayılan).
  Kaynak PROMPT_LOCAL (bağlayıcı) + KURALLAR_argon; bölgesel kurallar MASTER_PLAN §4e'deki varsayılanlarla ve "genel kabul gören varsayılan; ayarla değiştirilebilir" notuyla.
- README'ye "Kurallar" bölümü (yoksa) ve iki link. `docs/oyunlar/okey101.md` gerekmez.
ADIM 2: B8-CLINE'a taşındı (yapılmayacak).
~~ADIM 2~~ (eski):
- `tools/sim/run.ts`: catalog'daki her aktif oyun için 1000 seed bot-bot (tüm bot seviyeleri karışık), geçersiz hamle 0, her oyun biter (adım sınırı), süre raporu.
- Sızıntı testleri: her oyun için viewFor çıktısında rakip eli, deste sırası, seed, rng durumu yok (yapısal karşılaştırma ile).
KABUL: belgeler UTF-8 ve Türkçe karakterler sağlam; adım 2'de `corepack pnpm` ile sim ve testler yeşil, çıktılar rapora yapıştırılmış.
SÜREÇ: OC lider (glm-5.3-flash-free) plan → Fable onayı → işçi (deepseek-v4.1-flash-free). Rapor: docs/kahve/reports/B7-OC.md. Push YOK.
