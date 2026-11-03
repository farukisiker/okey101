#!/usr/bin/env bash
# Okey sunucusunu Raspberry Pi'ye kurar ya da günceller (docs/raspberry-pi-kurulum.md).
#
#   curl -fsSL https://raw.githubusercontent.com/farukisiker/okey101/feat/okey101-app/scripts/pi-install.sh | bash
#
# Tekrar çalıştırmak güvenlidir: kodu günceller ve sunucuyu yeniden başlatır.
# Sunucu 3001 portunda "okey" adlı servis olarak çalışır, Pi açılınca kendiliğinden başlar.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/farukisiker/okey101.git}"
BRANCH="${BRANCH:-feat/okey101-app}"
DIR="${DIR:-$HOME/okey101}"
PORT="${PORT:-3001}"
NODE_MAJOR=22

say() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
die() { printf '\n\033[1;31mHATA: %s\033[0m\n' "$*" >&2; exit 1; }

[ "$(id -u)" -ne 0 ] || die "Bu betiği root olarak değil, kendi kullanıcınla çalıştır (sudo'suz)."
case "$(uname -m)" in
  aarch64 | arm64 | x86_64) ;;
  *) die "64 bit sistem gerekli (bulunan: $(uname -m)). SD karta 'Raspberry Pi OS Lite (64-bit)' yaz." ;;
esac

say "Sistem paketleri"
sudo apt-get update -qq
sudo apt-get install -y -qq git curl ca-certificates

if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt "$NODE_MAJOR" ]; then
  say "Node.js $NODE_MAJOR kuruluyor"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi
echo "Node $(node -v)"

say "Oyun kodu ($BRANCH)"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch -q origin "$BRANCH"
  git -C "$DIR" checkout -q "$BRANCH"
  git -C "$DIR" reset -q --hard "origin/$BRANCH"
else
  git clone -q -b "$BRANCH" "$REPO_URL" "$DIR"
fi
git -C "$DIR" log -1 --format='Sürüm: %h  %s'

PNPM_VERSION="$(node -p "require('$DIR/package.json').packageManager.split('@')[1]")"
if [ "$(pnpm -v 2>/dev/null || true)" != "$PNPM_VERSION" ]; then
  say "pnpm $PNPM_VERSION kuruluyor"
  sudo npm install -g -s "pnpm@$PNPM_VERSION"
fi

say "Sunucu paketleri (uygulama paketleri kurulmaz)"
(cd "$DIR" && pnpm install --frozen-lockfile --filter "@okey/server...")

say "Servis: okey"
sudo tee /etc/systemd/system/okey.service >/dev/null <<EOF
[Unit]
Description=Okey oyun sunucusu
After=network-online.target
Wants=network-online.target

[Service]
User=$(id -un)
WorkingDirectory=$DIR/server
Environment=PORT=$PORT
Environment=NODE_ENV=production
ExecStart=$DIR/node_modules/.bin/tsx src/index.ts
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable -q okey
sudo systemctl restart okey

say "Kontrol"
for _ in $(seq 1 30); do
  if curl -fs "http://localhost:$PORT/health" >/dev/null; then
    echo "Sunucu çalışıyor: http://localhost:$PORT/health -> $(curl -fs "http://localhost:$PORT/health")"
    echo
    echo "Evdeki Wi-Fi'dan adres: http://$(hostname -I | awk '{print $1}'):$PORT"
    echo "İnternete açmak için rehberdeki Tailscale adımına geç."
    exit 0
  fi
  sleep 1
done
sudo journalctl -u okey -n 30 --no-pager
die "Sunucu başlamadı; yukarıdaki kayıtları Claude'a gönder."
