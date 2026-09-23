import { z } from "zod";
import { apiError, apiOk, authenticatePortal, logIntegration, publicationColumns, publicPublication } from "@/lib/integrations/portal-api";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  status: z.enum(["prepared", "exported", "received", "pending_publication", "published"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
});

/** Lista publicações disponíveis (nunca rascunhos: só existem registros de versões aprovadas). */
export async function GET(request: Request) {
  const auth = await authenticatePortal(request, "publications:read");
  if ("error" in auth) return auth.error;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return apiError(400, "invalid_parameters", "Parâmetros inválidos.");
  const { status, page, page_size } = parsed.data;
  let query = auth.admin.from("publication_exports").select(publicationColumns, { count: "exact" })
    .not("version_id", "is", null);
  query = status ? query.eq("status", status) : query.in("status", ["prepared", "exported", "received", "pending_publication"]);
  const { data, count, error } = await query.order("prepared_at", { ascending: true }).range((page - 1) * page_size, page * page_size - 1);
  if (error) return apiError(500, "internal_error", "Falha ao consultar publicações.");
  await logIntegration(auth.admin, auth.client, "list", null, { status: status ?? "available", page });
  return apiOk({ data: (data ?? []).map(publicPublication), pagination: { page, page_size, total: count ?? 0 } });
}
