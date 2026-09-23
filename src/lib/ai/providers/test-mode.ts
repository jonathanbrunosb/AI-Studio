/**
 * Endpoint do simulador da fal.ai usado exclusivamente nos testes E2E locais.
 * Só é aceito com E2E_MODE=true, fora do Railway e apontando para loopback; em qualquer outro caso retorna null.
 */
export function e2eFalBaseUrl() {
  if (process.env.E2E_MODE !== "true" || process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) return null;
  const raw = process.env.E2E_FAL_BASE_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return ["127.0.0.1", "localhost"].includes(url.hostname) && url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}
