# Raspberry Pi'ye Okey sunucusu kurulumu

Bu rehberin sonunda Pi'de oyun sunucusu çalışacak ve `https://okey.….ts.net`
gibi sabit bir internet adresi olacak. Salon ve arkadaşlarla oyun bu adresten çalışır.

Süre: yaklaşık 45 dakika (çoğu SD kart yazma ve kurulumu beklemek).

## Gerekenler

- Raspberry Pi 3B, 3B+, 4 ya da 5
- 16–32 GB SD kart (A1/A2, marka: SanDisk, Samsung…)
- Pi'nin kendi güç adaptörü (Pi 3 için 5V 2.5A)
- Mümkünse modeme Ethernet kablosu (yoksa Wi-Fi da olur)
- Windows bilgisayar ve SD kart okuyucu

---

## 1. SD kartı hazırla (bilgisayarda)

1. https://www.raspberrypi.com/software/ adresinden **Raspberry Pi Imager**'ı indir, kur.
2. Imager'da:
   - **Cihaz**: elindeki Pi (ör. Raspberry Pi 3)
   - **İşletim sistemi**: *Raspberry Pi OS (other)* → **Raspberry Pi OS Lite (64-bit)**
   - **Depolama**: SD kart
3. **İleri** → **Ayarları düzenle**'ye bas ve doldur:
   - **Hostname**: `okey`
   - **Kullanıcı adı**: `okey`, **şifre**: kendin belirle, **bir yere not et**
   - **Wi-Fi**: ağ adı ve şifresi (kablo kullanacaksan da doldur, zararı yok),
     **Wi-Fi ülkesi**: `TR`
   - **Saat dilimi**: `Europe/Istanbul`
   - **Servisler** sekmesi: **SSH'ı etkinleştir** → *Parola ile kimlik doğrulama*
4. **Kaydet** → **Evet** → yazma bitince kartı çıkar.

## 2. Pi'yi çalıştır

1. SD kartı Pi'ye tak, (varsa) Ethernet kablosunu bağla, en son güç kablosunu tak.
2. **3–5 dakika bekle.** İlk açılış uzun sürer.

## 3. Bilgisayardan Pi'ye bağlan

1. Windows'ta **Başlat**'a `PowerShell` yaz, aç.
2. Şunu yaz, Enter:

   ```
   ssh okey@okey.local
   ```

3. "Are you sure you want to continue connecting" sorusuna `yes` yaz, Enter.
4. Şifreyi yaz (yazarken ekranda görünmez, normal), Enter.
5. `okey@okey:~ $` satırını görüyorsan Pi'nin içindesin.

> **`okey.local` bulunamadı derse:** modemin arayüzünden (genelde
> http://192.168.1.1) bağlı cihazlarda **okey**'in IP adresini bul ve
> `ssh okey@192.168.1.xx` yaz.

## 4. Oyun sunucusunu kur (tek komut)

Pi'ye bağlıyken şunu kopyala, yapıştır (PowerShell'de sağ tık yapıştırır), Enter:

```
curl -fsSL https://raw.githubusercontent.com/farukisiker/okey101/feat/okey101-app/scripts/pi-install.sh | bash
```

Betik Node.js'i ve oyun sunucusunu kurar, sunucuyu servis olarak başlatır
(Pi her açıldığında kendiliğinden çalışır, çökerse yeniden kalkar). Pi 3'te
10–15 dakika sürebilir. Sonunda şunu görmelisin:

```
Sunucu çalışıyor: http://localhost:3001/health -> {"ok":true,"rooms":0}
```

> Kurulum sırasında GitHub reposu **public** olmalı. Private yaptıysan kurulum
> bitene kadar geçici olarak public yap.

## 5. İnternete aç (Tailscale Funnel, ücretsiz)

1. Telefonda ya da bilgisayarda https://tailscale.com → **Get started** →
   Google hesabınla ücretsiz kaydol.
2. Pi'de (PowerShell penceresinde) Tailscale'i kur:

   ```
   curl -fsSL https://tailscale.com/install.sh | sh
   ```

3. Pi'yi Tailscale hesabına bağla:

   ```
   sudo tailscale up --hostname=okey
   ```

   Ekrana bir bağlantı (`https://login.tailscale.com/a/…`) çıkar. Onu
   tarayıcıda aç, aynı Google hesabıyla gir, **Connect**'e bas.
4. Sunucuyu internete aç:

   ```
   sudo tailscale funnel --bg 3001
   ```

   İlk seferde "Funnel is not enabled" deyip yine bir bağlantı verir: bağlantıyı
   aç, **Enable**'a bas (HTTPS ve Funnel'ı açar), sonra aynı komutu bir kez daha
   çalıştır. Çıktıda adresin yazar:

   ```
   Available on the internet:
   https://okey.tail1234.ts.net/
   ```

5. **Dene:** telefonda Wi-Fi'ı kapat (mobil veriyle), tarayıcıda
   `https://okey.tail1234.ts.net/health` aç (kendi adresinle).
   `{"ok":true,...}` görüyorsan sunucu internette. 🎉

## 6. Uygulamayı bağla

- **Hemen denemek için:** uygulamada **Salon** → sağ alttaki **Sunucu adresi**
  kutusuna `https://okey.tail1234.ts.net` yaz (sonunda `/` olmadan). Salon açılır.
- **Kalıcı olarak:** adresi Claude'a gönder; iPhone ve Android sürümleri bu
  adrese bağlı derlenir, kimse adres yazmak zorunda kalmaz.

> Şu anki canlı adres: `https://okey.lightsoldiergames.com` — uygulamaya gömülü
> (`app/src/App.tsx`), Cloudflare Tunnel ile (`scripts/pi-cloudflare-tunnel.sh`). Adres
> değişirse uygulamadaki adres de güncellenmeli.

---

## Sonra lazım olabilecekler

Hepsi Pi'ye `ssh okey@okey.local` ile bağlanınca yazılır.

| Ne | Komut |
|---|---|
| Sunucuyu güncelle (yeni sürüm çıkınca) | 4. adımdaki komutun aynısı |
| Sunucu çalışıyor mu? | `systemctl status okey` (çıkmak için `q`) |
| Sunucu kayıtları (canlı) | `journalctl -u okey -f` (çıkmak için Ctrl+C) |
| Sunucuyu yeniden başlat | `sudo systemctl restart okey` |
| İnternet adresini göster | `tailscale funnel status` |
| Pi'yi kapat (fişi çekmeden önce!) | `sudo poweroff` |

- **Elektrik giderse:** Pi açılınca sunucu ve Tailscale kendiliğinden başlar,
  adres değişmez. Fişi çekmeden önce mümkünse `sudo poweroff` yap; SD kartı korur.
- **Bir şey ters giderse:** ekranda gördüğün yazıların fotoğrafını Claude'a gönder.
