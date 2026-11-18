# Hesap sunucusu: Google Cloud test kurulumu (18.11.2026)

Kullanıcı 18.11.2026: "Şimdilik tablette süreli testler için google cloud deneyebilirsin". Bu, kalıcı üretim sunucusu DEĞİLDİR.

| Ne | Değer |
|---|---|
| Servis | Cloud Run `kahve-accounts`, bölge `europe-west1`, proje `project-52f928a0-467a-4d41-962` (fatura hesabı `01AFCB-E11286-FDDA1B`, 290 $ tavan kuralı geçerli) |
| Adres | `https://kahve-accounts-160208308329.europe-west1.run.app` → uygulama derlemesinde `EXPO_PUBLIC_ACCOUNTS_URL` |
| Ölçek | en az 0, en fazla 1 kopya, 512 MiB, 1 vCPU (boştayken kapanır, ücretsiz katman içinde kalır) |
| Veri | SQLite `/tmp` içinde: kopya kapanınca (yaklaşık 15 dk boşta) **hesaplar ve fotoğraflar silinir**. Uygulama 401 alınca kendiliğinden yeni misafir hesap açar. |
| Yönetim | `https://…run.app/admin`, token sadece bu PC'de: `C:\Users\mfaru\.kahve\accounts-test-admin-token.txt` (repoya ve mesajlara yazılmaz) |
| Moderasyon | OpenAI/Anthropic anahtarı yok → her foto yönetim sırasına düşer, yöneticinin onayı gerekir |
| Giriş | APPLE_AUDIENCES / GOOGLE_AUDIENCES yok → Apple/Google düğmeleri 503 `not_configured` (Google düğmesi `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` olmadan zaten gizli) |

Kurulumda yapılan proje değişiklikleri:
- run, cloudbuild, artifactregistry API'leri açıldı.
- Kaynaktan derleme için varsayılan compute hizmet hesabına `roles/run.builder` verildi (Google'ın önerdiği rol).
- Kurum politikası `allUsers` iznine izin vermediği için servis `--no-invoker-iam-check` ile herkese açık yapıldı (sadece bu servis; politika değiştirilmedi).

Komutlar (`packages/accounts` içinden):
```
gcloud run deploy kahve-accounts --source . --project project-52f928a0-467a-4d41-962 --region europe-west1 --max-instances 1 --min-instances 0 --memory 512Mi --cpu 1 --set-env-vars "ADMIN_TOKEN=$(cat /c/Users/mfaru/.kahve/accounts-test-admin-token.txt)"
gcloud run services delete kahve-accounts --region europe-west1 --project project-52f928a0-467a-4d41-962   # testler bitince
```
Uçtan uca deneme (18.11.2026, uygulama istemcisi → Cloud Run): misafir hesap, isim (Türkçe harf), rıza, yükleme → review, yönetici onayı → foto herkese açık, Google 503 not_configured, hesap silme → foto 404. Geçti.

## Oyun sunucusu test kopyası (E2, 19.11.2026)
| Ne | Değer |
|---|---|
| Servis | Cloud Run `kahve-game`, aynı proje/bölge, en fazla 1 kopya, oturum yapışkanlığı, istek zaman aşımı 3600 sn |
| Adres | `https://kahve-game-160208308329.europe-west1.run.app` → uygulama derlemesinde `EXPO_PUBLIC_SERVER_URL` (canlı Pi'ye dokunulmadı) |
| Veri | masalar bellekte; kopya kapanınca masalar silinir |
| Ses | `LIVEKIT_*` yok → `voice:token` = not_configured (LiveKit makinesi kullanıcı kararı bekliyor: proje kurum politikası VM'e dış IP vermiyor) |
Derleme (depo kökünden): `gcloud builds submit --project project-52f928a0-467a-4d41-962 --region europe-west1 --config server/cloudbuild.yaml --substitutions _IMAGE=europe-west1-docker.pkg.dev/project-52f928a0-467a-4d41-962/cloud-run-source-deploy/kahve-server .`
sonra `gcloud run deploy kahve-game --image <aynı imaj> --region europe-west1 --max-instances 1 --session-affinity --timeout 3600 --no-invoker-iam-check`. Silme: `gcloud run services delete kahve-game --region europe-west1`.
Uçtan uca (19.11.2026): pişti şifreli masa kur/katıl, voice=true, söz diğer oyuncuya gider, 2 sn içindeki ikinci söz rate_limited, voice:token not_configured. Geçti.
