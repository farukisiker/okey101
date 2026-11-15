# İstek (A4-OPUS): GameDefinition'a isteğe bağlı `renameSeat`

DURUM: KABUL, types.ts'e eklendi (15.11.2026, Fable). Uygulama A7-OPUS görevinde.

## Sorun
Masada koltuk el değiştirince (oyun ortasında ayrılan oyuncunun yerine bot geçer, ya da biri botun koltuğuna oturur) oyuncu adı değişir.
Okey adı durumun içinde tutuyor (`GameState.players[seat].name`) ve view'lar oradan okuyor. Sözleşmede bunu yapan bir fonksiyon yok,
bu yüzden A4'te `server/src/room.ts` içinde okey'e özel bir dal var (`renameInState`, `isOkeyGame` ise doğrudan mutasyon) ve bu
değişiklik `replay` için günlüğe `{ t: 'rename', seat, name }` olarak yazılıyor.

## Öneri (types.ts, GameDefinition)
```ts
/**
 * Optional: the seat's player changed (a bot took over, or a person took a bot's seat).
 * Returns a new state with the name updated; must not change anything else (no rng, no turn change).
 * Games that don't keep names in their state omit it; the host keeps names in its seats.
 */
renameSeat?(state: S, seat: number, name: string): S;
```
- Okey adaptörü: `renameSeat: (s, seat, name) => ({ ...s, players: s.players.map((p, i) => (i === seat ? { ...p, name } : p)) })`.
- Room ve `replay`: `def.renameSeat ? def.renameSeat(state, seat, name) : state`; okey dalı silinir.
- Saf fonksiyon olduğu için günlük/replay kuralı ("create + aynı aksiyonlar = aynı durum") bozulmaz.

## Aynı yerde not edilen küçük karar (değişiklik istemiyor)
- Oda bot seviyesi protokolde yok; Room hep `'medium'` kullanıyor (bugünkü botStep varsayılanı). Seviye seçimi faz B/C'de
  `RoomOptions`/`options` üzerinden eklenebilir.
