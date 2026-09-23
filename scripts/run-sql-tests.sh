#!/usr/bin/env bash
# Executa todas as migrações em um banco descartável e roda supabase/tests/*.sql.
# Uso: PG_ADMIN_URL=postgres://postgres:postgres@127.0.0.1:5432/postgres npm run test:sql
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADMIN_URL="${PG_ADMIN_URL:-postgres://postgres:postgres@127.0.0.1:5432/postgres}"
DB="aistudio_sqltest_$$"
TEST_URL="${ADMIN_URL%/*}/$DB"

cleanup() { psql "$ADMIN_URL" -qc "drop database if exists $DB with (force)" >/dev/null 2>&1 || true; }
trap cleanup EXIT

psql "$ADMIN_URL" -qc "create database $DB" >/dev/null
psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$ROOT/scripts/sql/test-stubs.sql" >/dev/null
for migration in "$ROOT"/supabase/migrations/*.sql; do
  psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$migration" >/dev/null 2>"$ROOT/.sql-test.log" || { cat "$ROOT/.sql-test.log"; echo "FALHA na migração $(basename "$migration")"; exit 1; }
done
echo "migrações aplicadas: $(ls "$ROOT"/supabase/migrations/*.sql | wc -l)"

failed=0
for test in "$ROOT"/supabase/tests/*.sql; do
  if psql "$TEST_URL" -q -v ON_ERROR_STOP=1 -f "$test" >/dev/null 2>"$ROOT/.sql-test.log"; then
    echo "ok    $(basename "$test")"
  else
    echo "FALHA $(basename "$test")"; sed 's/^/      /' "$ROOT/.sql-test.log"; failed=1
  fi
done
rm -f "$ROOT/.sql-test.log"
exit $failed
