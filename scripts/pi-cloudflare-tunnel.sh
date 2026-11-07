#!/usr/bin/env bash
# Puts the Okey server on the internet under your own domain with a free
# Cloudflare Tunnel (no port forwarding, works behind the home modem).
# Run on the Pi as the normal user (not with sudo):
#   curl -fsSL https://raw.githubusercontent.com/farukisiker/okey101/feat/okey101-app/scripts/pi-cloudflare-tunnel.sh | bash
# Safe to run again. Settings: HOSTNAME_FQDN (default okey.lightsoldiergames.com), PORT (3001).
set -euo pipefail

HOSTNAME_FQDN="${HOSTNAME_FQDN:-okey.lightsoldiergames.com}"
PORT="${PORT:-3001}"
TUNNEL="okey"
CF_DIR="$HOME/.cloudflared"

say() { printf '\n==> %s\n' "$*"; }

if [ "$(id -u)" -eq 0 ]; then
  echo "Bu betiği sudo olmadan, normal kullanıcıyla çalıştır." >&2
  exit 1
fi

say "cloudflared kuruluyor"
if ! command -v cloudflared >/dev/null; then
  sudo mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
  echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' |
    sudo tee /etc/apt/sources.list.d/cloudflared.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y -qq cloudflared
fi
cloudflared --version

mkdir -p "$CF_DIR"
if [ ! -f "$CF_DIR/cert.pem" ]; then
  say "Cloudflare hesabına bağlan"
  echo "Birazdan ekrana https://dash.cloudflare.com/argotunnel?... ile başlayan bir bağlantı çıkacak."
  echo "Onu tarayıcıda aç, Cloudflare hesabınla gir, listeden alan adını ($HOSTNAME_FQDN'nin kökü) seç ve Authorize de."
  echo "Onaylayınca bu pencere kendiliğinden devam eder."
  cloudflared tunnel login
fi

say "Tünel: $TUNNEL"
tunnel_id() {
  cloudflared tunnel list --name "$TUNNEL" --output json |
    python3 -c 'import json,sys; t=json.load(sys.stdin); print(t[0]["id"] if t else "")'
}
ID="$(tunnel_id)"
if [ -z "$ID" ]; then
  cloudflared tunnel create "$TUNNEL"
  ID="$(tunnel_id)"
fi
CREDS="$CF_DIR/$ID.json"
if [ ! -f "$CREDS" ]; then
  echo "Tünel bilgisi ($CREDS) bu Pi'de yok. Cloudflare panelinden '$TUNNEL' tünelini silip betiği yeniden çalıştır." >&2
  exit 1
fi

say "Adres: $HOSTNAME_FQDN -> Pi"
cloudflared tunnel route dns --overwrite-dns "$TUNNEL" "$HOSTNAME_FQDN"

CONFIG="$CF_DIR/config.yml"
cat >"$CONFIG" <<EOF
tunnel: $ID
credentials-file: $CREDS
ingress:
  - hostname: $HOSTNAME_FQDN
    service: http://localhost:$PORT
  - service: http_status:404
EOF

say "Servis (Pi açılınca kendiliğinden başlar)"
sudo mkdir -p /etc/cloudflared
sudo cp "$CONFIG" /etc/cloudflared/config.yml
if systemctl list-unit-files cloudflared.service >/dev/null 2>&1 && [ -f /etc/systemd/system/cloudflared.service ]; then
  sudo systemctl restart cloudflared
else
  sudo cloudflared --config /etc/cloudflared/config.yml service install
fi

say "Kontrol"
for _ in $(seq 1 30); do
  if out="$(curl -fsS -m 5 "https://$HOSTNAME_FQDN/health" 2>/dev/null)"; then
    echo "İnternetten çalışıyor: https://$HOSTNAME_FQDN/health -> $out"
    exit 0
  fi
  sleep 2
done
echo "Adres henüz cevap vermedi (DNS birkaç dakika sürebilir). Sonra dene: curl https://$HOSTNAME_FQDN/health"
