# C3-OPUS raporu: Tavla entegrasyonu

DURUM: TAMAM, tablet denemesi bekliyor (2026-11-17). Dal feat/kahve, push yok. types.ts / protocol.ts / tavla types.ts / package.json / lockfile değişmedi; packages/tavla/src'ye dokunulmadı.
Not: görev "önce plan → Fable onayı" diyordu; koordinatör doğrudan uygulama istedi, plan ayrı commit edilmedi.

## Ne değişti
- **catalog**: `packages/catalog/src/tavla.ts` (`tavlaDef` + `TavlaView/TavlaAction/TavlaOptions/TavlaResult/CheckerMove...` tipleri). `DEFINITIONS` ve `CATALOG`'da `meta('tavla')` yerine gerçek kayıt (status `active`, seatChoices `[2]`).
  Yeni: `BOT_STEP_DELAY_MS = { tavla: 600 }` ve `botStepDelayMs(id, botDelayMs)`.
- **Bot temposu (Room + LocalHost, ikisi aynı)**: bir hamleden sonra sıra aynı koltukta ve aynı tur anahtarında kalıyorsa (tavlada adımlar, sonra commit), bir sonraki bot hamlesi `botStepDelayMs` sonra gelir. Turun ilk hamlesi eskisi gibi tam bot gecikmesini bekler (zarları görmeye zaman): sunucu 1000 ms, cihaz 1300 ms; sonraki adımlar 600 ms. Listede olmayan oyunlarda adım gecikmesi = bot gecikmesi, yani okey ve kart oyunları aynen. Bot gecikmesi 600'den küçükse (testler) o kullanılır. İstenirse `RoomOptions.botStepDelayMs` ile ezilebilir.
- **useKahveGame**: Tavla'nın sonucu `result.scores` değil `{winner, kind, points}`; çevrimiçi masada özet hiç çıkmayacaktı. `app/src/net/tavlaSummary.ts` puanları ve "Mars — 2 sayı" notunu görünümden okur; özet nesnesi Batak'taki gibi el başına tek (masa id + round), reklam sayımı yalnız GameShell'de.
- **App.tsx**: `kahve.gameId === 'tavla'` dalı → `TavlaScreen` (view/viewAt/room/seat/summary/humanCount/act/nextRound/leave, Batak ile aynı). Tek oyunlu grup (Tavla Köşesi) oyun listesini atlayıp doğrudan Tavla lobisini açar; lobiden geri → salon. Kart oyunu lobisinden geri, oyunun kendi grubunun listesine döner (Son oynadığın'dan gelince de).
- **GameLobby**: tavla `seatChoices [2]` → kişi seçimi ve eşli anahtarı görünmez; geri düğmesi tavlada "Salona dön". Hemen Oyna / Arkadaşlarla aynen (lobi seçenekleri `normalizeOptions`'ta düşer: klasik, 5 sayılık maç).
- **KahveSalonu**: değişmedi; Tavla Köşesi zaten dokunulabilirdi, "Yakında" rozeti katalogdan hesaplandığı için artık kalktı. Son oynadığın: Tavla → Tavla lobisi.
- **i18n**: `components/tavla/text.ts` (TAVLA_TEXT + `tt`) silindi; kullanılan 21 anahtar `tr.ts` + `en.ts` + 11 dilde İngilizce. Kullanılmayan `tavlaWaitingFor`, `tavlaOpeningDie` alınmadı. Board/DicePanel/PlayerBar/TavlaScreen'de yalnız `tt(` → `t(` (düzen aynen).
- **Testler**:
  - `packages/catalog/test/tavla-catalog.test.ts` (kayıt, normalize, bot oyunu boyunca hiçbir görünümde `rngState` yok, adım gecikmesi tablosu); `catalog.test.ts` aktif listesine tavla.
  - `server/test/tavla-e2e.test.ts`: iki kişi socket üzerinden create → join → (dolunca başlar) → oyunlar → nextRound → 3 sayıda maç sonu → yeni maç 0-0; iki istemcinin aldığı HER room:state ve game:view ham JSON'unda `rngState` yok, sunucu state'inde var. 1 kişi + bot (bot adımları ve commit). v1 istemci tavla masasını salonda görmez, katılamaz ve açamaz (`ERR_UPDATE_APP`); kağıt salonu izleyicisi de görmez.
  - `local-host-equivalence.test.ts`: LocalHost = Room tavla için iki maç sonuna kadar + replay; tempo testi (turun ilk bot hamlesi 1000 ms, sonraki adımlar 600 ms, iki host aynı; Batak her hamlede 1000 ms).
  - "Yakında" örneği `tavla` → `king` (room-generic G3, server-generic).
  - `app/test/tavlaSummary.test.ts`.
  - `bot.test.ts` 40 el ve okey eşdeğerlik testine 30 sn sınır: `pnpm -r` paralel koşusunda bir kez 5 sn'yi aştılar (tek başına 1,4 / 2,5 sn).

## Kabul
`corepack pnpm -r typecheck`: tüm paketler `Done`.
Test (kökte, filtreli komut):

| Paket | Önce | Sonra |
|---|---|---|
| game-core | 41 | 41 |
| cards | 36 | 36 |
| shared | 104 | 104 |
| pisti | 46 | 46 |
| tavla | 50 | 50 |
| batak | 62 | 62 |
| catalog | 77 | 81 |
| app | 120 | 124 |
| server | 77 | 82 |
| **Toplam** | **613** | **626** |

`npx expo export --platform android`: hbc **5.6 MB** (Batak turunda 5.5 MB), çıktı silindi.

## Tablette deneme
Test yapısı: memory'deki "Kahve Test" tarifi, feat/kahve'nin son commit'inden.
1. **Çevrimdışı, bota karşı**: Salon → Tavla Köşesi → (doğrudan) Tavla lobisi (kişi seçimi yok) → Hemen Oyna. Açılış zarı büyük atan başlar. Botun turunda zarlar ~1,3 sn görünür, sonra pullar ~0,6 sn arayla tek tek oynar ve sıra sana geçer. Sende: pula dokun → gidebileceği haneler yanar ("3", "8 (3+5)") → dokun; "Geri al", "Tamam" / hamle yoksa "Pas". Süre 45 sn (ilk tur) / 30 sn; dolarsa hamle kendiliğinden tamamlanır.
   Oyun bitince özet: kazanan, "Tek/Mars/Konçina — n sayı", toplam; "Sonraki el". 5 sayıya ulaşınca "Yeni maç", toplam 0-0.
2. **Geri tuşu**: oyunda çıkış onayı → lobi; lobide → salon ("Salona dön"). Salonda "Son oynadığın: Tavla · Devam" → Tavla lobisi.
3. **İki cihaz, yerel sunucu**: PC'de `corepack pnpm server` (3001); salon ekranındaki sunucu adresine `http://<PC-IP>:3001`. A: Tavla → Arkadaşlarla → Masa aç; B: Tavla → Arkadaşlarla → masa listede → Otur → masa dolunca başlar. Birkaç oyun + "Sonraki el". Şifreli ve özel masa (kodla katıl) kart oyunlarındaki gibi. Kağıt ve okey salonunda tavla masası görünmemeli. B uygulamayı kapatırsa bot onun yerine oynar (adımlar 0,6 sn arayla), geri gelince koltuğu alır.
4. **Regresyon**: Pişti/Batak bot hızı eskisi gibi (her kart ~1,3 sn), okey aynen.

## Fable'ın karar vermesi gerekenler
- Lobide tavla maç uzunluğu (1/3/5/7) seçimi yok; varsayılan 5. İstenirse GameLobby'ye küçük bir seçici eklenir (`targetScore`, `kahve.setup.tavla`'da hatırlanır).
- Adım temposu 600 ms ve turun ilk hamlesi 1000/1300 ms; tablette okunurluk kontrol edilmeli (`BOT_STEP_DELAY_MS` tek yerden ayarlanır).
- Pi sunucusu güncellenmeden çevrimiçi Tavla `serverUpdating` döner (beklenen).
- `docs/kahve/i18n-istek-tavla.md` hâlâ text.ts'ten söz ediyor (o dosyaya dokunmadım); 21 anahtar 11 dilde çeviri bekliyor.
