#!/usr/bin/env bash
# Compila e inicia o AI Studio (build de produção) apontando para o stack local de E2E.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CACHE="${E2E_CACHE:-$ROOT/.e2e-cache}"
set -a; . "$ROOT/.env.e2e"; set +a
cd "$ROOT"
if [ "${E2E_SKIP_BUILD:-}" != "1" ]; then npx next build >"$CACHE/build.log" 2>&1; fi
if curl -fsS -o /dev/null "http://127.0.0.1:3100/api/health" 2>/dev/null; then echo "porta 3100 ocupada; execute scripts/e2e/stop-stack.sh" >&2; exit 1; fi
setsid nohup npx next start -H 127.0.0.1 -p 3100 >"$CACHE/app.log" 2>&1 </dev/null & echo $! >"$CACHE/app.pid"
for i in $(seq 1 60); do curl -fs http://127.0.0.1:3100/api/health >/dev/null && break; sleep 0.5; done
curl -fs http://127.0.0.1:3100/api/health && echo " app pronto em http://127.0.0.1:3100"
