#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load nvm if available so `npm start` always uses the intended Node version.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  . "$NVM_DIR/nvm.sh"
fi

if command -v nvm >/dev/null 2>&1; then
  # Uses .nvmrc (Node 20). Installs it if missing.
  nvm use >/dev/null 2>&1 || nvm install >/dev/null
fi

cd "$PROJECT_DIR"
node "$PROJECT_DIR/app.js"
