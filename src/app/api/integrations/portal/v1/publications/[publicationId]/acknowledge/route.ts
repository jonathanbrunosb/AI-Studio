import { z } from "zod";
import { apiError, apiOk, authenticatePortal, logIntegration } from "@/lib/integrations/portal-api";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  content_id: z.uuid(),
  version_id: z.uuid(),
  status: z.enum(["received", "pending_publication", "published", "failed"]),
  external_publication_id: z.string().trim().min(1).max(200).optional(),
  external_url: z.url().refine((value) => /^https?:\/\//.test(value)).optional(),
  published_at: z.iso.datetime({ offset: true }).optional(),
  message: z.string().trim().max(1000).optional(),
}).refine((body) => body.status !== "published" || body.published_at, { message: "published_at é obrigatório para status published." });

const errorMap: Record<string, [number, string]> = {
  PUBLICATION_MISMATCH: [409, "Conteúdo ou versão não correspondem à publicação."],
  PUBLICATION_SUPERSEDED: [409, "Publicação substituída por uma versão mais recente."],
  PUBLICATION_FAILED: [409, "Publicação em falha; o AI Studio precisa liberar nova tentativa."],
  CLIENT_FORBIDDEN: [403, "Cliente sem permissão."],
  INVALID_STATUS: [400, "Status inválido."],
  CONFIRMATION_DATA_REQUIRED: [400, "Dados de confirmação incompletos."],
};

/** Confirmação idempotente de recebimento/publicação. Repetições retornam o estado original (duplicate=true). */
export async function POST(request: Request, ctx: { params: Promise<{ publicationId: string }> }) {
  const auth = await authenticatePortal(request, "publications:ack");
  if ("error" in auth) return auth.error;
  const { publicationId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(publicationId)) return apiError(400, "invalid_parameters", "Identificador inválido.");
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Corpo inválido.");
  const body = parsed.data;
  const { data, error } = await auth.admin.rpc("portal_acknowledge_publication", {
    p_client_id: auth.client.id, p_publication_id: publicationId, p_content_id: body.content_id, p_version_id: body.version_id,
    p_status: body.status, p_external_id: body.external_publication_id ?? null, p_external_url: body.external_url ?? null,
    p_published_at: body.published_at ?? null, p_message: body.message ?? null,
  });
  if (error) {
    const code = Object.keys(errorMap).find((key) => error.message.includes(key));
    const [status, message] = code ? errorMap[code] : [500, "Falha ao registrar a confirmação."];
    await logIntegration(auth.admin, auth.client, "ack_rejected", publicationId, { code: code ?? "internal" });
    return apiError(status, (code ?? "internal_error").toLowerCase(), message);
  }
  const result = data?.[0];
  await logIntegration(auth.admin, auth.client, "ack", publicationId, { status: body.status, duplicate: result?.duplicate ?? false });
  return apiOk({ data: { publication_id: publicationId, status: result?.status, duplicate: result?.duplicate ?? false } }, result?.duplicate ? 200 : 201);
}
