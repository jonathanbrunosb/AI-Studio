#!/usr/bin/env bash
# Sobe o stack local de E2E: PostgreSQL (existente) + GoTrue + PostgREST + gateway compatível com o Supabase.
# Requisitos: psql, node >= 22, PG_ADMIN_URL apontando para um superusuário de um PostgreSQL descartável.
# Uso exclusivo em testes. Nunca apontar para bancos reais.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CACHE="${E2E_CACHE:-$ROOT/.e2e-cache}"
DB="${E2E_DB:-aistudio_e2e}"
PG_ADMIN_URL="${PG_ADMIN_URL:-postgres://postgres:postgres@127.0.0.1:5432/postgres}"
PG_HOSTPORT="$(echo "$PG_ADMIN_URL" | sed -E 's#^postgres(ql)?://[^@]+@([^/]+)/.*#\2#')"
export E2E_JWT_SECRET="${E2E_JWT_SECRET:-e2e-local-jwt-secret-with-at-least-32-characters}"
GOTRUE_VERSION=v2.177.0
POSTGREST_VERSION=v12.2.12
mkdir -p "$CACHE"

if [ ! -x "$CACHE/gotrue/auth" ]; then
  curl -fsSL "https://github.com/supabase/auth/releases/download/$GOTRUE_VERSION/auth-$GOTRUE_VERSION-x86.tar.gz" -o "$CACHE/auth.tgz"
  mkdir -p "$CACHE/gotrue" && tar xzf "$CACHE/auth.tgz" -C "$CACHE/gotrue"
fi
if [ ! -x "$CACHE/postgrest" ]; then
  curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x86-64.tar.xz" -o "$CACHE/postgrest.tar.xz"
  tar xf "$CACHE/postgrest.tar.xz" -C "$CACHE"
fi

"$ROOT/scripts/e2e/stop-stack.sh" >/dev/null 2>&1 || true
psql "$PG_ADMIN_URL" -q -v ON_ERROR_STOP=1 -c "drop database if exists $DB with (force)" -c "create database $DB"
DB_URL="$(echo "$PG_ADMIN_URL" | sed -E "s#/[^/?]+(\?.*)?\$#/$DB#")"
sed "s/current_database_placeholder/$DB/" "$ROOT/scripts/e2e/bootstrap.sql" | psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f -

( cd "$CACHE/gotrue" && GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin:e2e-auth-admin@$PG_HOSTPORT/$DB" \
  GOTRUE_DB_MIGRATIONS_PATH="$CACHE/gotrue/migrations" API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 GOTRUE_JWT_SECRET="$E2E_JWT_SECRET" GOTRUE_SITE_URL=http://127.0.0.1:3100 ./auth migrate >"$CACHE/gotrue-migrate.log" 2>&1 )

for migration in "$ROOT"/supabase/migrations/*.sql; do
  psql "$DB_URL" -q -v ON_ERROR_STOP=1 -f "$migration" >/dev/null
done

ANON_KEY="$(node "$ROOT/scripts/e2e/jwt.mjs" anon)"
SERVICE_KEY="$(node "$ROOT/scripts/e2e/jwt.mjs" service_role)"

( cd "$CACHE/gotrue" && GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin:e2e-auth-admin@$PG_HOSTPORT/$DB" \
  GOTRUE_DB_MIGRATIONS_PATH="$CACHE/gotrue/migrations" \
  GOTRUE_JWT_SECRET="$E2E_JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  GOTRUE_JWT_ADMIN_ROLES=service_role GOTRUE_SITE_URL=http://127.0.0.1:3100 API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 \
  GOTRUE_API_HOST=127.0.0.1 PORT=9999 GOTRUE_DISABLE_SIGNUP=true GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
  GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_SMTP_HOST= \
  setsid nohup ./auth serve >"$CACHE/gotrue.log" 2>&1 </dev/null & echo $! >"$CACHE/gotrue.pid" )

PGRST_DB_URI="postgres://authenticator:e2e-authenticator@$PG_HOSTPORT/$DB" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET="$E2E_JWT_SECRET" PGRST_SERVER_PORT=3001 PGRST_SERVER_HOST=127.0.0.1 PGRST_DB_POOL=10 \
  setsid nohup "$CACHE/postgrest" >"$CACHE/postgrest.log" 2>&1 </dev/null & echo $! >"$CACHE/postgrest.pid"

setsid nohup node "$ROOT/scripts/e2e/gateway.mjs" >"$CACHE/gateway.log" 2>&1 </dev/null & echo $! >"$CACHE/gateway.pid"
setsid nohup node "$ROOT/scripts/e2e/mock-fal.mjs" >"$CACHE/mock-fal.log" 2>&1 </dev/null & echo $! >"$CACHE/mock-fal.pid"

for i in $(seq 1 60); do
  if curl -fs http://127.0.0.1:54321/auth/v1/health >/dev/null && curl -fs -H "apikey: $ANON_KEY" http://127.0.0.1:54321/rest/v1/ >/dev/null; then break; fi
  sleep 0.5
done

# Usuários de teste (dados fictícios): editor, aprovador, administrador e um inativo.
create_user() {
  curl -fsS -X POST http://127.0.0.1:54321/auth/v1/admin/users -H "apikey: $SERVICE_KEY" -H "Authorization: Bearer $SERVICE_KEY" \
    -H "Content-Type: application/json" -d "{\"email\":\"$1\",\"password\":\"E2e-Senha-Forte-123\",\"email_confirm\":true,\"user_metadata\":{\"full_name\":\"$2\"}}" \
    | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).id))'
}
EDITOR=$(create_user editor@e2e.invalid "Editora E2E")
APPROVER=$(create_user aprovador@e2e.invalid "Aprovador E2E")
ADMIN=$(create_user admin@e2e.invalid "Admin E2E")
INACTIVE=$(create_user inativo@e2e.invalid "Inativo E2E")
psql "$DB_URL" -q -v ON_ERROR_STOP=1 <<SQL
insert into public.user_roles (user_id, role) values ('$EDITOR','editor'), ('$APPROVER','approver'), ('$ADMIN','admin'), ('$ADMIN','editor'), ('$INACTIVE','editor');
update public.profiles set is_active = false where id = '$INACTIVE';
SQL

cat >"$ROOT/.env.e2e" <<ENV
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=$SERVICE_KEY
NEXT_PUBLIC_APP_URL=http://127.0.0.1:3100
E2E_DB_URL=$DB_URL
E2E_MODE=true
E2E_FAL_BASE_URL=http://127.0.0.1:54400
FAL_KEY=e2e-simulated-key-not-real
ENV
echo "E2E stack pronto (DB $DB). Variáveis em .env.e2e"
