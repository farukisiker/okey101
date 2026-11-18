GÖREV: D1 (UI çevirileri) + D2 (Demli Kahve mağaza metni taslağı)  FAZ: D  (kullanıcı 18.11.2026: "sonraki fazlara geç")
KIRMIZI ÇİZGİ: push yok, mağazaya/Pi'ye yükleme yok, yeni paket yok, `C:/Users/mfaru/okey101/okey101` dokunulmaz. Commit Fable'ın.

D1 (Sonnet): app/src/i18n/locales/{de,es,fr,hi,id,it,ja,ko,pt,ru,zh}.ts
- Her dosyada yaklaşık 145 anahtar hâlâ İngilizce (en.ts ile aynı değer): Kahve salonu, Pişti, Batak, Tavla, GameShell, lobi metinleri.
  Kaynak anlam tr.ts'dir (Türkçe asıl), en.ts yardımcıdır. Hepsini o dile çevir.
- {name}, {n}, {target} gibi yer tutucular aynen kalır. Emoji/simgeler (⏱ ★ • —) aynen kalır.
- Oyun adları: "Okey", "101", "Pişti", "Batak", "Tavla" özel addır; o dilde yerleşik karşılık yoksa Latin harfle bırak (ja/ko/zh/hi/ru'da okunuşu
  yazmak serbest ama tutarlı ol). Tavla terimleri: Mars = gammon, Konçina = (Türkçe özel, "Konçina" bırak), Tek = single game.
- Hedef kitle 60+; kısa, sade, saygılı dil. Düğme metinleri kısa kalsın (tabletten telefona sığmalı; İngilizceden en fazla ~%30 uzun).
- Gerçekten aynı kalması gereken değerler (sayılar, "OK", "Bot", markalar) aynı kalabilir; rapor listesinde gerekçesiyle belirt.
- UTF-8 kaydet (kullanıcı kuralı: özel harfler "?" olmamalı). Sonra: `corepack pnpm --filter ./app typecheck` ve `corepack pnpm --filter ./app test` yeşil.
- Rapor: docs/kahve/reports/D1-SONNET.md (dil başına çevrilen anahtar sayısı, bilerek aynı bırakılanlar).

D2 (Sonnet): docs/store/kahve-listing-i18n.json (YENİ dosya; mevcut listing-i18n.json ve play-listing-i18n.json'a DOKUNMA, onlar canlı Demli Okey içindir)
- Biçim: listing-i18n.json ile aynı anahtarlar ve aynı 15 dil (en-US, en-GB, tr, es-ES, es-MX, pt-BR, fr-FR, de-DE, it, ru, ja, ko, zh-Hans, hi, id) + "_note".
  Alanlar: name ≤30, subtitle ≤30, keywords ≤100 (virgüllü, boşluksuz tercih), promo ≤170, description ≤4000; ayrıca Play için "short" ≤80.
- Uygulama: "Demli Kahve" (1.1.0): bir kahvehane salonu. Oyunlar: 101 Okey, Düz Okey, Pişti, Batak, Tavla. Botlarla internetsiz ya da arkadaşlarla
  masa kurarak oynanır. Sanal para/çip/kumar yok; gerçek parayla kumar yok, değeri olan ödül yok (bu cümle her dilde kalmalı). El aralarında reklam,
  tek seferlik satın alımla reklamsız. Tavla: klasik kurallar, maç 1/3/5/7 sayı. Batak: ihaleli, tekli. Pişti: 2 ya da 4 kişi, eşli seçeneği.
  Mevcut Demli Okey metnindeki doğru bilgileri (renk körlüğü işaretleri, sürükle-bırak) koru; olmayan özellik yazma (sohbet, hediye, sesli masa YOK).
- App Store emoji kabul etmez (• ve ▶ olur). Türkçe metin önce yazılır, diğer diller ondan uyarlanır (birebir çeviri değil, o dilin mağaza dili).
- Bir doğrulama betiği çalıştır (python, scratchpad'de): her dil var mı, sınırlar aşılmış mı, 'ğ' gibi harfler doğru mu, "?" bozulması var mı. Çıktıyı rapora koy.
- Rapor: docs/kahve/reports/D2-SONNET.md.
