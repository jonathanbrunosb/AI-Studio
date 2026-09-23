import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createRateLimiter } from "./rate-limit";
import { log } from "@/lib/observability/logger";

export const API_VERSION = "2026-09-v1";
const limiter = createRateLimiter(60, 60_000);

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Token exibido uma única vez ao administrador; somente o hash é armazenado. */
export function generateClientToken() {
  const token = `ais_${randomBytes(32).toString("base64url")}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, 12) };
}

export function apiError(status: number, code: string, message: string, extra: Record<string, string> = {}) {
  if (status >= 400) log(status >= 500 ? "error" : "warn", "integration.request_rejected", { status, code });
  return Response.json({ api_version: API_VERSION, error: { code, message } }, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

export function apiOk(body: Record<string, unknown>, status = 200) {
  return Response.json({ api_version: API_VERSION, ...body }, { status, headers: { "Cache-Control": "no-store" } });
}

export type IntegrationClient = { id: string; name: string; scopes: string[] };

/** Autentica o cliente (Bearer), verifica escopo, integração habilitada e limite de requisições. */
export async function authenticatePortal(request: Request, scope: "publications:read" | "publications:ack"): Promise<{ error: Response } | { admin: ReturnType<typeof createAdminClient>; client: IntegrationClient }> {
  const header = request.headers.get("authorization") ?? "";
  const token = /^Bearer\s+(ais_[A-Za-z0-9_-]{20,})$/.exec(header)?.[1];
  if (!token) return { error: apiError(401, "unauthorized", "Autenticação obrigatória (Bearer).", { "WWW-Authenticate": "Bearer" }) };
  let admin;
  try { admin = createAdminClient(); } catch { return { error: apiError(503, "not_configured", "Integração indisponível.") }; }
  const [{ data: client }, { data: settings }] = await Promise.all([
    admin.from("integration_clients").select("id, name, scopes, enabled, revoked_at").eq("token_hash", hashToken(token)).maybeSingle(),
    admin.from("portal_integration_settings").select("api_enabled").maybeSingle(),
  ]);
  if (!client || !client.enabled || client.revoked_at) return { error: apiError(401, "unauthorized", "Credencial inválida ou revogada.") };
  if (!settings?.api_enabled) return { error: apiError(503, "integration_disabled", "A integração automatizada está desabilitada pelo administrador.") };
  if (!client.scopes.includes(scope)) return { error: apiError(403, "forbidden", "Escopo insuficiente.") };
  const limit = limiter(client.id);
  if (!limit.allowed) return { error: apiError(429, "rate_limited", "Limite de requisições excedido.", { "Retry-After": String(limit.retryAfter) }) };
  await admin.from("integration_clients").update({ last_used_at: new Date().toISOString() }).eq("id", client.id);
  return { admin, client: { id: client.id, name: client.name, scopes: client.scopes } as IntegrationClient };
}

export async function logIntegration(admin: ReturnType<typeof createAdminClient>, client: IntegrationClient, action: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  await admin.from("audit_logs").insert({ actor_id: null, action: `integration.portal.${action}`, entity_type: "integration_clients", entity_id: entityId, metadata: { client_id: client.id, ...metadata } });
}

/** Somente dados do manifesto (versão aprovada); sem caminhos internos, e-mails ou URLs permanentes. */
export function publicPublication(row: { id: string; content_id: string; version_id: string | null; destination: string | null; status: string; manifest: unknown; manifest_sha256: string | null; image_sha256: string | null; package_sha256: string | null; signed: boolean; prepared_at: string | null; published_at: string | null; external_publication_id: string | null; supersedes_id: string | null }) {
  return {
    id: row.id, content_id: row.content_id, version_id: row.version_id, destination: row.destination, status: row.status,
    manifest: row.manifest, hashes: { manifest_sha256: row.manifest_sha256, image_sha256: row.image_sha256, package_sha256: row.package_sha256 },
    signed: row.signed, prepared_at: row.prepared_at, published_at: row.published_at, external_publication_id: row.external_publication_id, supersedes_id: row.supersedes_id,
  };
}

export const publicationColumns = "id, content_id, version_id, destination, status, manifest, manifest_sha256, image_sha256, package_sha256, signed, prepared_at, published_at, external_publication_id, supersedes_id, storage_path, image_path";
