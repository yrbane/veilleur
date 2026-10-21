#!/usr/bin/env bash
# Installation / mise à jour de Veilleur sur nethttp.net — exécuté en root par scripts/deploy-nethttp.sh
# Idempotent : provisionne ce qui manque (Node 22, utilisateur, BDD, .env, service, vhost),
# puis met à jour le code, applique les migrations et redémarre.
set -euo pipefail
# Les fichiers installés doivent rester lisibles par l'utilisateur de service (root a un umask 027)
umask 022

RACINE=/var/www/nethttp.net/news
APP="$RACINE/app"
TMP=/tmp/veilleur-deploy
UTILISATEUR=veilleur
DB_NOM=veilleur
DB_UTILISATEUR=veilleur
PORT=8090
NODE_MAJEUR=22
NODE_DIR=/opt/nodejs

[ -d "$TMP" ] || { echo "✗ artefacts absents dans $TMP" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Node 22 LTS isolé dans /opt/nodejs (le Node nvm de /home/debian n'est pas
#    accessible à un utilisateur système, et le paquet Debian est en 20.x)
# ---------------------------------------------------------------------------
NODE="$NODE_DIR/current/bin/node"
if ! [ -x "$NODE" ] || ! "$NODE" --version | grep -q "^v$NODE_MAJEUR\."; then
  echo "→ installation de Node $NODE_MAJEUR dans $NODE_DIR"
  mkdir -p "$NODE_DIR"
  base="https://nodejs.org/dist/latest-v${NODE_MAJEUR}.x"
  sommes=$(curl -fsSL "$base/SHASUMS256.txt")
  archive=$(printf '%s\n' "$sommes" | grep -oE "node-v[0-9.]+-linux-x64\.tar\.xz" | head -1)
  curl -fsSL "$base/$archive" -o "/tmp/$archive"
  (cd /tmp && printf '%s\n' "$sommes" | grep " $archive\$" | sha256sum -c --quiet -)
  tar -xJf "/tmp/$archive" -C "$NODE_DIR"
  ln -sfn "$NODE_DIR/${archive%.tar.xz}" "$NODE_DIR/current"
  rm -f "/tmp/$archive"
fi
# Lisible par tous : l'utilisateur de service n'est pas root
chmod 755 "$NODE_DIR"
chmod -R a+rX "$NODE_DIR"/node-v*
echo "  node $("$NODE" --version)"
NPM="$NODE_DIR/current/bin/npm"

# ---------------------------------------------------------------------------
# 2. Utilisateur système et arborescence
# ---------------------------------------------------------------------------
id -u "$UTILISATEUR" >/dev/null 2>&1 || useradd --system --home-dir "$RACINE" --shell /usr/sbin/nologin "$UTILISATEUR"
mkdir -p "$APP" "$RACINE/data/images" "$RACINE/.npm"

# ---------------------------------------------------------------------------
# 3. .env (créé une seule fois, secrets générés) puis base MariaDB
# ---------------------------------------------------------------------------
if [ ! -f "$RACINE/.env" ]; then
  echo "→ génération de $RACINE/.env"
  sed -e "s|__DB_PASSWORD__|$(openssl rand -hex 16)|" \
      -e "s|__JWT_SECRET__|$(openssl rand -hex 32)|" \
      -e "s|__JWT_REFRESH_SECRET__|$(openssl rand -hex 32)|" \
      "$TMP/deploy/nethttp/env.production" > "$RACINE/.env"
fi
chmod 600 "$RACINE/.env"
mdp_bdd=$(sed -n 's/^DB_PASSWORD=//p' "$RACINE/.env")
[ -n "$mdp_bdd" ] || { echo "✗ DB_PASSWORD absent de $RACINE/.env" >&2; exit 1; }

echo "→ base MariaDB « $DB_NOM » et utilisateur « $DB_UTILISATEUR »"
mariadb <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NOM\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_UTILISATEUR'@'localhost' IDENTIFIED BY '$mdp_bdd';
CREATE USER IF NOT EXISTS '$DB_UTILISATEUR'@'127.0.0.1' IDENTIFIED BY '$mdp_bdd';
ALTER USER '$DB_UTILISATEUR'@'localhost' IDENTIFIED BY '$mdp_bdd';
ALTER USER '$DB_UTILISATEUR'@'127.0.0.1' IDENTIFIED BY '$mdp_bdd';
GRANT ALL PRIVILEGES ON \`$DB_NOM\`.* TO '$DB_UTILISATEUR'@'localhost', '$DB_UTILISATEUR'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

# ---------------------------------------------------------------------------
# 4. Code et dépendances de production
# ---------------------------------------------------------------------------
echo "→ installation du code dans $APP"
rsync -a --delete "$TMP/dist/" "$APP/dist/"
rsync -a --delete "$TMP/drizzle/" "$APP/drizzle/"
cp "$TMP/package.json" "$TMP/package-lock.json" "$APP/"
chown -R "$UTILISATEUR:$UTILISATEUR" "$RACINE"

echo "→ npm ci --omit=dev"
(cd "$APP" && runuser -u "$UTILISATEUR" -- env HOME="$RACINE" npm_config_cache="$RACINE/.npm" PATH="$NODE_DIR/current/bin:$PATH" \
  "$NPM" ci --omit=dev --no-audit --no-fund --loglevel=error)

# ---------------------------------------------------------------------------
# 5. Migrations (à chaque déploiement) et sources par défaut (une seule fois)
# ---------------------------------------------------------------------------
executer_app() {
  # Lance « node $1 » comme veilleur, dans $APP, avec le même EnvironmentFile que le service :
  # systemd lit le .env tel quel (guillemets, parenthèses, chevrons) là où un « source »
  # bash s'arrêterait à la première valeur non quotée. --wait propage le code de sortie.
  systemd-run --quiet --wait --pipe --collect --uid="$UTILISATEUR" --gid="$UTILISATEUR" \
    -p EnvironmentFile="$RACINE/.env" -p WorkingDirectory="$APP" \
    "$NODE" "$1" </dev/null
}
echo "→ migrations"
executer_app dist/migrer.js
if [ ! -f "$RACINE/.seed-fait" ]; then
  echo "→ sources par défaut"
  executer_app dist/seed.js
  touch "$RACINE/.seed-fait"; chown "$UTILISATEUR:$UTILISATEUR" "$RACINE/.seed-fait"
fi

# ---------------------------------------------------------------------------
# 6. Service systemd
# ---------------------------------------------------------------------------
echo "→ service systemd veilleur"
install -m 644 "$TMP/deploy/nethttp/veilleur.service" /etc/systemd/system/veilleur.service
systemctl daemon-reload
systemctl enable -q veilleur
systemctl restart veilleur

# ---------------------------------------------------------------------------
# 7. VirtualHost Apache (reverse proxy)
# ---------------------------------------------------------------------------
echo "→ vhost Apache news.nethttp.net"
install -m 644 "$TMP/deploy/nethttp/015-news.nethttp.net.conf" /etc/apache2/sites-available/015-news.nethttp.net.conf
a2ensite -q 015-news.nethttp.net.conf >/dev/null
apache2ctl configtest 2>&1 | grep -v "Syntax OK" || true
systemctl reload apache2

# ---------------------------------------------------------------------------
# 8. Santé
# ---------------------------------------------------------------------------
for i in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/v1/health" >/dev/null 2>&1; then
    echo "✔ application en ligne sur 127.0.0.1:$PORT"
    rm -rf "$TMP"
    exit 0
  fi
  sleep 1
done
echo "✗ l'application ne répond pas — journalctl -u veilleur -n 50 :" >&2
journalctl -u veilleur -n 50 --no-pager >&2
exit 1
