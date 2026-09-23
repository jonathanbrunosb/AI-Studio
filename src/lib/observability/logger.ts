/**
 * Logs estruturados (JSON por linha) para o Railway. Nunca registrar senhas, tokens, chaves,
 * prompts ou conteúdo de arquivos: somente códigos, identificadores e metadados operacionais.
 */
type Level = "info" | "warn" | "error";
export type LogEvent =
  | "auth.login_failed" | "auth.login_inactive" | "supabase.unavailable" | "ai.generation_failed" | "ai.unexpected"
  | "storage.failed" | "editorial.operation_failed" | "publication.failed" | "integration.request_rejected" | "app.unhandled";

const SENSITIVE = /pass(word)?|token|secret|key|authorization|cookie|prompt|email/i;

function sanitize(meta: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(meta).map(([key, value]) => [key, SENSITIVE.test(key) ? "[redacted]" : typeof value === "string" ? value.slice(0, 300) : value]));
}

export function log(level: Level, event: LogEvent, meta: Record<string, unknown> = {}) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, service: "ai-studio", ...sanitize(meta) });
  if (level === "error") console.error(line); else if (level === "warn") console.warn(line); else console.info(line);
}

export function errorName(error: unknown) {
  return error instanceof Error ? error.name : typeof error;
}
