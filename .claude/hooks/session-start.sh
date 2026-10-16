#!/bin/bash
# クラウドセッション開始時に manifest-service の依存関係を入れ、PostgreSQL を起動する
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR/manifest-service"
npm install --no-audit --no-fund
npm run --silent db:start
echo 'export DATABASE_URL="postgres://postgres@127.0.0.1:5433/manifest"' >> "${CLAUDE_ENV_FILE:-/dev/null}"
