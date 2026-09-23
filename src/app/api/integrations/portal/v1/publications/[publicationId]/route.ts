import { apiError, apiOk, authenticatePortal, logIntegration, publicationColumns, publicPublication } from "@/lib/integrations/portal-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request, ctx: { params: Promise<{ publicationId: string }> }) {
  const auth = await authenticatePortal(request, "publications:read");
  if ("error" in auth) return auth.error;
  const { publicationId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(publicationId)) return apiError(400, "invalid_parameters", "Identificador inválido.");
  const { data } = await auth.admin.from("publication_exports").select(publicationColumns).eq("id", publicationId).not("version_id", "is", null).maybeSingle();
  if (!data) return apiError(404, "not_found", "Publicação não encontrada.");
  await logIntegration(auth.admin, auth.client, "get", data.id);
  return apiOk({ data: publicPublication(data) });
}
