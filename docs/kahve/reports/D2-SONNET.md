# D2-SONNET: Demli Kahve 1.1.0 store listing draft

File: `docs/store/kahve-listing-i18n.json` (new, UTF-8). Not uploaded anywhere; `listing-i18n.json` and `play-listing-i18n.json` untouched.
Format: same keys as `listing-i18n.json` (name, subtitle, keywords, promo, description) plus `short` (Play, max 80). Play title = name, Play full = description.
Same 15 languages: en-US, en-GB, tr, es-ES, es-MX, pt-BR, fr-FR, de-DE, it, ru, ja, ko, zh-Hans, hi, id.

## Validation output (`python -I validate_kahve.py`, in the session scratchpad)

```
lang      name sub  kw  promo short desc
en-US       30   24  100  148   77 1214
en-GB       30   24  100  148   77 1216
tr          29   27   97  131   71 1193
es-ES       25   30   97  137   64 1319
es-MX       30   27   97  137   64 1325
pt-BR       25   29   98  127   67 1280
fr-FR       27   29   96  145   63 1401
de-DE       30   25   97  134   63 1306
it          25   29   99  141   61 1310
ru          25   27   95  121   62 1262
ja          23   15   57   72   44  667
ko          21   16   48   73   48  707
zh-Hans     19   12   50   57   39  477
hi          27   25   79  116   79 1177
id          25   26   96  133   69 1273
tr has ğ ş ı: True
languages present: 15/15
RESULT: PASS
```
Checks: all fields present and within limits (name/subtitle 30, keywords 100, promo 170, short 80, description 4000), valid UTF-8, no U+FFFD or stray "?", no emoji, every description contains the "no real-money gambling / no prizes of value" sentence, every name contains "Demli Kahve".

## Choices

- Turkish written first, others adapted to each market's store style (Turkish "kahvehane" becomes "coffeehouse / cafe / Kaffeehaus / chaye-khane style" wording, not word for word).
- Structure per language: intro, 8 bullets (five games, offline with bots, tables with friends, no chips/coins/gambling, drag-drop or tap, colour-blind marks, Okey indicator/okey/openable sets, large text), a "games" list with ▶ lines (101/Classic Okey, Pishti 2 or 4 with partner option, Batak with bidding single player, Tavla classic rules with 1/3/5/7 point matches, mars, konçina), ads paragraph (between hands, one-time purchase removes), and the no-gambling sentence. No chat, gifts or voice mentioned. The large-text bullet is the only line not in the task sheet; it is drawn from the 60+ audience goal, drop it if the UI does not really offer large text.
- Names: tr "Demli Kahve: Okey Pişti Tavla"; en "Demli Kahve: Okey & Backgammon"; es-ES "Okey y Tavla" (Spain players know "tavla" less, but keyword also has backgammon), es-MX "Okey y Backgammon"; pt-BR "Okey e Gamão"; fr "Okey et Tavla"; de "Okey & Backgammon"; it "Okey e Tavla"; ru "Окей и нарды"; ja "オケイとバックギャモン"; ko "오케이와 백개먼"; zh-Hans "奥克伊与双陆棋"; hi "ओके और बैकगैमन"; id "Okey & Tavla". Rule: the local word for backgammon where it is the everyday term (pt, ru, ja, ko, zh, hi, en, de), "Tavla" where Turkish-style name is better known or the word is shared (tr, es-ES, fr, it, id).
- Keywords: Apple already indexes name and subtitle, so keywords avoid repeating them and add the generic terms (rummikub, rummy-like, card/tile, offline, bots, friends, table) plus local spellings of the game names (batak, pishti, tavla, backgammon). Turkish adds "kahvehane, kağıt, iskambil, zar, eşli". Comma-separated, no spaces after commas except multiword terms. All 95-100 chars for Latin scripts; CJK/hi are shorter because characters carry more meaning.
- Okey is kept as the Turkish game name in every language (transliterated in ru/ja/ko/zh/hi); "Okey" and "Pishti/Pişti" and "Batak" are proper names.
- Things for Fable to check: app name field vs store brand (colon in fr is French punctuation `Demli Kahve :`); Tavla must match what D1 locales call the game; if the iOS app has no large-text setting, remove that bullet.

## Fable düzeltmesi (18.11.2026, kullanıcı: "tek başına bulunabilir olmaz")
- "rummikub" tescilli marka: App Store anahtar kelimede başkasının markasını reddedebilir, her dilde "rummy" yapıldı.
- en-US/en-GB: "domino" yerine "spades" (Batak'ın İngilizce aranan karşılığı).
- tr alt başlık: "Batak, 101 Okey, internetsiz" (ad zaten Okey, Pişti, Tavla içeriyor; Batak artık ad+alt başlıkta).
- "sohbet / chat" eklenmedi: uygulamada sohbet yok (Faz E2). Olmayan özellik anahtar kelimesi Apple 2.3.7 ihlalidir; sohbet çıkınca eklenecek.
