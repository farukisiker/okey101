GÖREV: E2b — Masada kimlik doğrulama ("masa geçişi"), sunucu tarafı ses yasağı, hesap başına söz sınırı
FAZ: E2 (kullanıcı 19.11.2026: "sen kalan işleri çöz"). E2'nin açık riskleri: accountId sahte olabilir, ses yasağı sadece bilgi, söz sınırı soket başına.
KIRMIZI ÇİZGİ: E2 ile aynı (push yok, Pi yok, anahtar yazılmaz, v1 istemciler hiçbir şey fark etmez, yeni paket yok). Commit Fable'ın.

## Tasarım: masa geçişi (table pass)
Oyun sunucusu hesap sunucusuna AĞ ÜZERİNDEN SORMAZ. Hesap sunucusu kısa ömürlü, HMAC imzalı bir geçiş verir; oyun sunucusu aynı sırla yerelde doğrular.
- Ortak sır: `TABLE_PASS_SECRET` (≥32 karakter), iki sunucuda da ortam değişkeni. Yoksa: hesap sunucusu 503 not_configured, oyun sunucusu geçişleri yok sayar
  (accountId hiç kabul edilmez; eski "çıplak accountId" alanı da ARTIK kabul edilmez).
- `GET /v1/me/table-pass` (Bearer) → 200 `{ pass: string, expiresAt: number }`.
  pass = base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, "kahve-table-pass.v1." + payloadB64)).
  payload: `{ v: 1, sub: accountId, vb: voiceBannedUntil | 0, iat, exp }` (exp = iat + 6 saat).
- Paylaşılan doğrulama kodu `shared/src/tablePass.ts` (saf TS, node:crypto'yu parametre olarak alır ya da sadece sunucu tarafında `server/src/tablePass.ts`;
  istemcide doğrulama yok). Sabit zamanlı karşılaştırma, exp kontrolü (60 sn tolerans), v=1 dışı red.
- Protokol: `room:create`, `room:join`, `room:quickPlay` yükü ve `handshake.auth` içinde `tablePass?: string` (accountId yerine). Geçerliyse koltuğun
  `accountId`'si = sub, `voiceBannedUntil` = vb. Geçersiz/süresi dolmuş geçiş: oturmaya engel DEĞİL, sadece accountId yok (misafir gibi).
- `voice:token`: oturanın geçişindeki vb > şimdi → `{ ok:false, error:'banned' }` (yeni hata kodu; sözleşmeye eklenir).
- Söz sınırı anahtarı: accountId varsa `a:<id>` (yeniden bağlanınca sıfırlanmaz), yoksa soket id.
- Bir hesap aynı masada iki koltuk tutamaz (ikinci join `already_seated`? → hayır: basit tut, sadece aynı accountId'li ikinci koltuğa accountId VERME).

## Opus: `server/`, `shared/`, `packages/accounts`
- Yukarıdakiler + testler: geçerli geçiş → accountId; sahte imza / süresi dolmuş / yanlış sürüm → accountId yok; çıplak accountId artık yok sayılıyor;
  yasaklı geçişle voice:token = banned; söz sınırı yeniden bağlanmada korunuyor; v1 uyumluluk testleri aynen yeşil; accounts table-pass ucu (sır yoksa 503).
- Rapor: docs/kahve/reports/E2b-OPUS.md.

## Sonnet: `app/`
- `accountsClient.tablePass()` (önbellek: expiresAt'a 10 dk kalana kadar aynı geçiş; 503/hata → null, sessiz).
- useKahveGame: masaya girerken (create/join/quickPlay ve yeniden bağlanma) `accountId` yerine `tablePass` gönder.
- voice.ts: `banned` hata kodu → mevcut "Sesli sohbet 24 saat kapalı" durumu.
- Testler + rapor docs/kahve/reports/E2b-SONNET.md.
