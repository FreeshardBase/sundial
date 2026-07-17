#!/usr/bin/env bash
# Install/update Sundial alongside the classic web-terminal on ONE shard
# (personal-shard dogfooding — never a fleet default).
#
# Usage: deploy/install-on-shard.sh <ssh-target>
#   e.g. deploy/install-on-shard.sh freeshard@geszt8.freeshard.cloud
#
# The ssh user needs write access to $FREESHARD_DIR and docker compose rights.
set -euo pipefail

SSH_TARGET="${1:?usage: install-on-shard.sh <ssh-target>}"
FREESHARD_DIR="${FREESHARD_DIR:-/home/freeshard/freeshard}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> packing app files"
TAR="$(mktemp /tmp/sundial-XXXX.tar.gz)"
tar -czf "$TAR" -C "$REPO_ROOT" \
    index.html version.json css js vendor assets

echo "==> uploading to $SSH_TARGET"
scp -q "$TAR" "$REPO_ROOT/deploy/nginx-sundial.conf" \
    "$REPO_ROOT/deploy/docker-compose.override.yml" "$SSH_TARGET:/tmp/"

echo "==> installing on shard"
ssh "$SSH_TARGET" FREESHARD_DIR="$FREESHARD_DIR" TAR="$(basename "$TAR")" 'bash -s' <<'REMOTE'
set -euo pipefail
mkdir -p "$FREESHARD_DIR/sundial/app"
tar -xzf "/tmp/$TAR" -C "$FREESHARD_DIR/sundial/app"
mv /tmp/nginx-sundial.conf "$FREESHARD_DIR/sundial/nginx-sundial.conf"
mv /tmp/docker-compose.override.yml "$FREESHARD_DIR/docker-compose.override.yml"
rm -f "/tmp/$TAR"
cd "$FREESHARD_DIR"
docker compose up -d web-terminal
REMOTE

rm -f "$TAR"

DOMAIN="${SSH_TARGET#*@}"
echo "==> verifying"
sleep 3
code=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/sundial/") || code=fail
classic=$(curl -s -o /dev/null -w '%{http_code}' "https://$DOMAIN/") || classic=fail
echo "classic UI  https://$DOMAIN/         -> $classic"
echo "sundial     https://$DOMAIN/sundial/ -> $code"
[ "$code" = 200 ] && [ "$classic" = 200 ] && echo "OK" || { echo "CHECK FAILED"; exit 1; }
