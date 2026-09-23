#!/usr/bin/env bash
# Encerra a pilha E2E local. Os serviços são iniciados com setsid; o grupo de processos inteiro
# é encerrado para não deixar filhos (ex.: next-server) ocupando portas com um build antigo.
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CACHE="${E2E_CACHE:-$ROOT/.e2e-cache}"
for name in app gateway postgrest gotrue mock-fal; do
  if [ -f "$CACHE/$name.pid" ]; then
    pid="$(cat "$CACHE/$name.pid")"
    kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null
    rm -f "$CACHE/$name.pid"
  fi
done
# Salvaguarda para órfãos de execuções anteriores: apenas processos cujo diretório de trabalho
# está dentro deste repositório (GoTrue roda como ./auth no cache; o Next como next-server).
# Filtra pelo nome do executável (comm), para nunca atingir o shell que invoca este script.
for pid in $(pgrep -x auth; pgrep -x postgrest; pgrep '^next-server'); do
  case "$(readlink "/proc/$pid/cwd" 2>/dev/null)" in "$ROOT"*) kill "$pid" 2>/dev/null ;; esac
done
# Processos node: somente o gateway e o mock iniciados por esta pilha (argumento exato do script).
for pid in $(pgrep -x node); do
  case "$(tr '\0' ' ' <"/proc/$pid/cmdline" 2>/dev/null)" in
    "node $ROOT/scripts/e2e/gateway.mjs "|"node $ROOT/scripts/e2e/mock-fal.mjs ") kill "$pid" 2>/dev/null ;;
  esac
done
sleep 1
exit 0
