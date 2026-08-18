#!/bin/bash
set -euo pipefail

APP_ROOT="/home/kehwgbpo/trendpilot-repo"
VENV_ACTIVATE="/home/kehwgbpo/nodevenv/trendpilot-repo/20/bin/activate"
HASH_FILE="/home/kehwgbpo/.trendpilot-package.sha256"

source "$VENV_ACTIVATE"
cd "$APP_ROOT"

if [ -f package.json ]; then
  CURRENT_HASH="$(sha256sum package.json | awk '{print $1}')"
  PREVIOUS_HASH="$(cat "$HASH_FILE" 2>/dev/null || true)"
  if [ "$CURRENT_HASH" != "$PREVIOUS_HASH" ]; then
    npm install --omit=dev --no-audit --no-fund --prefer-offline
    printf '%s\n' "$CURRENT_HASH" > "$HASH_FILE"
  else
    echo "Dependencies unchanged; skipping npm install."
  fi
fi

mkdir -p tmp
touch tmp/restart.txt

echo "TrendPilot Namecheap deploy complete."
