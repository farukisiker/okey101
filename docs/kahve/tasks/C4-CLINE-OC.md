GÖREV: C4 (Cline: sim + sızıntı; OpenCode: tavla.md)  FAZ: C
OKU: docs/kahve/tasks/B8-CLINE.md + reports/B8-CLINE.md (aynı düzen), tools/sim/run.ts, packages/catalog/test/leak-*.test.ts, packages/tavla/src/** (C1), docs/oyunlar/batak.md (biçim örneği)
SÖZLEŞME: types.ts dosyaları (değiştirme)
C4a Cline (cline-pass): tools/sim'e tavla ekle (1000 seed, easy/medium/hard karışık, 0 geçersiz hamle, 0 bitmeyen oyun, 30 pul korunumu, ortalama tur sayısı ve hard hamle süresi
     ölçümü raporda); packages/catalog/test/leak-tavla.test.ts (view JSON'unda rngState ve gelecek zar yok; aynı tahta farklı rngState → aynı view; seyirci/geçersiz koltuk).
     SAHİP: tools/sim/**, packages/catalog/test/leak-tavla.test.ts, docs/kahve/reports/C4-CLINE.md. Commit Fable'ın.
C4b OpenCode: docs/oyunlar/tavla.md: uygulanan klasik tavla kuralları, zorunlu zar ve toplama örnekleri, mars/konçina puanları, ayarlar tablosu (motordaki
     defaultOptions/normalizeOptions ile birebir), bot seviyeleri, "ilk sürümde yok" listesi (çift zarlama küpü, Gülbara, Tapa). SAHİP: docs/oyunlar/tavla.md, docs/kahve/reports/C4-OC.md.
KABUL: kökte test/typecheck yeşil; sim çıktısı raporda.
