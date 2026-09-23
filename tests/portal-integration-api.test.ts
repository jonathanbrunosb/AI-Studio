import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "@/lib/integrations/portal-api";
import { createRateLimiter } from "@/lib/integrations/rate-limit";
import { canConfirm, canPrepare, publicationErrorMessage, validatePublicationData } from "@/lib/publications/publication-rules";

const TOKEN = "ais_valid-token-value-1234567890abcdef";
const state = {
  client: { id: "c1", name: "Portal", scopes: ["publications:read", "publications:ack"], enabled: true, revoked_at: null as string | null },
  apiEnabled: true,
  publications: [] as Record<string, unknown>[],
  ackResult: { data: [{ status: "published", duplicate: false }], error: null as null | { message: string } },
  rpcCalls: [] as unknown[],
  audits: [] as unknown[],
};

function query(table: string) {
  const filters: [string, unknown][] = [];
  const builder: Record<string, unknown> = {};
  const chain = (...names: string[]) => names.forEach((name) => { builder[name] = (...args: unknown[]) => { if (name === "eq") filters.push([String(args[0]), args[1]]); return builder; }; });
  chain("select", "eq", "not", "in", "order", "range", "update", "is");
  builder.insert = (row: unknown) => { if (table === "audit_logs") state.audits.push(row); return Promise.resolve({ error: null }); };
  builder.maybeSingle = async () => {
    if (table === "integration_clients") {
      const hash = filters.find(([key]) => key === "token_hash")?.[1];
      return { data: hash === hashToken(TOKEN) ? state.client : null };
    }
    if (table === "portal_integration_settings") return { data: { api_enabled: state.apiEnabled } };
    if (table === "publication_exports") return { data: state.publications.find((row) => row.id === filters.find(([key]) => key === "id")?.[1]) ?? null };
    return { data: null };
  };
  builder.then = (resolve: (value: unknown) => void) => resolve({ data: state.publications, count: state.publications.length, error: null });
  return builder;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => query(table),
    rpc: async (name: string, args: unknown) => { state.rpcCalls.push({ name, args }); return state.ackResult; },
    storage: { from: () => ({ createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://storage.example/${path}?token=tmp` } }) }) },
  }),
}));

const listRoute = await import("@/app/api/integrations/portal/v1/publications/route");
const ackRoute = await import("@/app/api/integrations/portal/v1/publications/[publicationId]/acknowledge/route");
const assetsRoute = await import("@/app/api/integrations/portal/v1/publications/[publicationId]/assets/route");

const PUB = "44444444-4444-4444-8444-444444444444";
const req = (url: string, init: RequestInit = {}, token: string | null = TOKEN) =>
  new Request(`https://ai-studio.example${url}`, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json", ...(init.headers ?? {}) } });
const params = { params: Promise.resolve({ publicationId: PUB }) };

beforeEach(() => {
  state.client = { id: `c-${Math.random()}`, name: "Portal", scopes: ["publications:read", "publications:ack"], enabled: true, revoked_at: null };
  state.apiEnabled = true;
  state.publications = [{ id: PUB, content_id: "c", version_id: "v", destination: "comunicados_internos", status: "exported", manifest: { title: "x" }, manifest_sha256: "a", image_sha256: "b", package_sha256: "c", signed: true, prepared_at: null, published_at: null, external_publication_id: null, supersedes_id: null, storage_path: "p/pkg.zip", image_path: "p/img.png" }];
  state.ackResult = { data: [{ status: "published", duplicate: false }], error: null };
  state.rpcCalls = [];
});

describe("API de integração do portal", () => {
  it("exige autenticação Bearer", async () => {
    const response = await listRoute.GET(req("/api/integrations/portal/v1/publications", {}, null));
    expect(response.status).toBe(401);
    expect((await listRoute.GET(req("/api/integrations/portal/v1/publications", {}, "ais_wrong-token-000000000000000000"))).status).toBe(401);
  });

  it("bloqueia credencial revogada, integração desabilitada e escopo insuficiente", async () => {
    state.client.revoked_at = "2026-09-01";
    expect((await listRoute.GET(req("/api/integrations/portal/v1/publications"))).status).toBe(401);
    state.client.revoked_at = null; state.apiEnabled = false;
    expect((await listRoute.GET(req("/api/integrations/portal/v1/publications"))).status).toBe(503);
    state.apiEnabled = true; state.client.scopes = ["publications:read"];
    const ack = await ackRoute.POST(req(`/x`, { method: "POST", body: JSON.stringify({ content_id: "11111111-1111-4111-8111-111111111111", version_id: "11111111-1111-4111-8111-111111111111", status: "received" }) }), params);
    expect(ack.status).toBe(403);
  });

  it("lista publicações com contrato versionado, sem caminhos internos", async () => {
    const response = await listRoute.GET(req("/api/integrations/portal/v1/publications?page=1&page_size=10"));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.api_version).toBe("2026-09-v1");
    expect(body.pagination).toMatchObject({ page: 1, page_size: 10 });
    expect(JSON.stringify(body)).not.toContain("storage_path");
    expect(JSON.stringify(body)).not.toContain("p/pkg.zip");
    expect((await listRoute.GET(req("/api/integrations/portal/v1/publications?page_size=999"))).status).toBe(400);
  });

  it("entrega URLs temporárias dos arquivos", async () => {
    const body = await (await assetsRoute.GET(req("/x"), params)).json();
    expect(body.data.expires_in).toBe(300);
    expect(body.data.package.url).toContain("token=tmp");
  });

  it("valida o corpo da confirmação e trata repetição como idempotente", async () => {
    const payload = { content_id: "11111111-1111-4111-8111-111111111111", version_id: "22222222-2222-4222-8222-222222222222", status: "published" };
    expect((await ackRoute.POST(req("/x", { method: "POST", body: JSON.stringify(payload) }), params)).status).toBe(400);
    const ok = await ackRoute.POST(req("/x", { method: "POST", body: JSON.stringify({ ...payload, published_at: "2026-09-23T10:00:00-03:00", external_publication_id: "ais-1" }) }), params);
    expect(ok.status).toBe(201);
    state.ackResult = { data: [{ status: "published", duplicate: true }], error: null };
    const again = await ackRoute.POST(req("/x", { method: "POST", body: JSON.stringify({ ...payload, published_at: "2026-09-23T10:00:00-03:00" }) }), params);
    expect(again.status).toBe(200);
    expect((await again.json()).data.duplicate).toBe(true);
  });

  it("recusa confirmação de conteúdo/versão divergente", async () => {
    state.ackResult = { data: [], error: { message: "PUBLICATION_MISMATCH" } } as never;
    const response = await ackRoute.POST(req("/x", { method: "POST", body: JSON.stringify({ content_id: "11111111-1111-4111-8111-111111111111", version_id: "22222222-2222-4222-8222-222222222222", status: "received" }) }), params);
    expect(response.status).toBe(409);
  });

  it("limita requisições por cliente", async () => {
    const limiter = createRateLimiter(2, 1000);
    expect(limiter("a", 0).allowed).toBe(true);
    expect(limiter("a", 10).allowed).toBe(true);
    expect(limiter("a", 20)).toMatchObject({ allowed: false });
    expect(limiter("a", 1500).allowed).toBe(true);
  });
});

describe("regras de publicação", () => {
  it("somente autor (editor) ou administrador prepara; apenas conteúdo com versão aprovada", () => {
    const content = { created_by: "u1", status: "approved" as const, approved_version_id: "v1" };
    expect(canPrepare(["editor"], "u1", content)).toBe(true);
    expect(canPrepare(["editor"], "u2", content)).toBe(false);
    expect(canPrepare(["approver"], "u1", content)).toBe(false);
    expect(canPrepare(["admin"], "u2", { ...content, approved_version_id: null })).toBe(false);
    expect(canPrepare(["admin"], "u2", { ...content, status: "archived" })).toBe(false);
    expect(canPrepare(["admin"], "u2", { ...content, status: "draft" })).toBe(true);
    expect(canConfirm(["editor"])).toBe(false);
    expect(canConfirm(["admin"])).toBe(true);
  });

  it("valida campos obrigatórios e confirmação do link de sistema", () => {
    expect(validatePublicationData("accounting_newsletter", { title: "x" }, { accessUrlConfirmed: false })).toHaveLength(1);
    const system = { title: "x", editorial_details: { solution_name: "IFRS 16", functionality: "Conciliação", access_url: "https://a.b" } };
    expect(validatePublicationData("system_announcement", system, { accessUrlConfirmed: false })).toHaveLength(1);
    expect(validatePublicationData("system_announcement", system, { accessUrlConfirmed: true })).toEqual([]);
    expect(publicationErrorMessage("ALREADY_IN_PORTAL")).toContain("já foi recebida");
  });
});
