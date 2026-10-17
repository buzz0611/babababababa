#!/bin/bash
# 開発用 PostgreSQL を起動し、データベース作成とマイグレーションまで行う（何度実行しても安全）。
#   npm run db:start
# 既に DATABASE_URL の PostgreSQL が動いていれば、起動はせずに DB 作成とマイグレーションだけ行う。
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || cp .env.example .env
set -a; . ./.env; set +a

PORT="$(node -e 'console.log(new URL(process.env.DATABASE_URL).port || 5432)')"
DBNAME="$(node -e 'console.log(new URL(process.env.DATABASE_URL).pathname.slice(1))')"

if ! pg_isready -q -h 127.0.0.1 -p "$PORT" 2>/dev/null; then
  BIN="$(dirname "$(command -v initdb 2>/dev/null || ls -d /usr/lib/postgresql/*/bin/initdb 2>/dev/null | sort -V | tail -1)")"
  if [ ! -x "$BIN/pg_ctl" ]; then
    echo "PostgreSQL が見つかりません。インストールしてください（例: brew install postgresql / apt install postgresql）" >&2
    exit 1
  fi
  if [ "$(id -u)" = "0" ]; then
    # root では起動できないので postgres ユーザーで動かす
    PGDATA_DIR="${PGDATA_DIR:-/var/lib/postgresql/manifest-data}"
    run() { su postgres -s /bin/bash -c "$*"; }
    mkdir -p "$PGDATA_DIR" && chown postgres:postgres "$PGDATA_DIR"
  else
    PGDATA_DIR="${PGDATA_DIR:-$HOME/.local/share/manifest-service/pgdata}"
    run() { bash -c "$*"; }
    mkdir -p "$PGDATA_DIR"
  fi
  if [ ! -f "$PGDATA_DIR/PG_VERSION" ]; then
    run "'$BIN/initdb' -D '$PGDATA_DIR' -U postgres --auth=trust -E UTF8 --no-locale" >/dev/null
  fi
  run "'$BIN/pg_ctl' -D '$PGDATA_DIR' -l '$PGDATA_DIR/server.log' -o '-p $PORT -k /tmp' -w start" >/dev/null
  echo "PostgreSQL を起動しました（ポート $PORT, データ $PGDATA_DIR）"
fi

if ! psql -h 127.0.0.1 -p "$PORT" -U postgres -tAc "select 1 from pg_database where datname='$DBNAME'" | grep -q 1; then
  psql -h 127.0.0.1 -p "$PORT" -U postgres -qc "create database \"$DBNAME\""
  echo "データベース $DBNAME を作成しました"
fi

npx tsx scripts/migrate.ts >/dev/null
echo "PostgreSQL の準備ができました: $DATABASE_URL"
