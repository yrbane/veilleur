#!/usr/bin/env bash
# Déploie Veilleur sur https://news.nethttp.net
# Prérequis : hôte SSH « nethttp » configuré (~/.ssh/config), sudo sans mot de passe côté serveur.
# Build local → rsync des artefacts → deploy/nethttp/installer.sh en root (idempotent).
set -euo pipefail
cd "$(dirname "$0")/.."

HOTE="${HOTE_SSH:-nethttp}"
TMP=/tmp/veilleur-deploy
SSH="ssh -o BatchMode=yes"

echo "→ build (typecheck + serveur + client)"
npm run build

echo "→ envoi des artefacts vers $HOTE:$TMP"
$SSH "$HOTE" "rm -rf $TMP && mkdir -p $TMP"
rsync -azR --delete -e "$SSH" dist drizzle/migrations package.json package-lock.json deploy/nethttp "$HOTE:$TMP/"

echo "→ installation sur le serveur"
$SSH "$HOTE" "sudo -n bash -s" < deploy/nethttp/installer.sh

echo "✔ https://news.nethttp.net"
