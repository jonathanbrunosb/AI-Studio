import { apiError, apiOk, authenticatePortal, logIntegration } from "@/lib/integrations/portal-api";

export const dynamic = "force-dynamic";
const URL_TTL_SECONDS = 300;

/** URLs temporárias (5 min) do pacote e da imagem. Não há URL pública permanente. */
export async function GET(request: Request, ctx: { params: Promise<{ publicationId: string }> }) {
  const auth = await authenticatePortal(request, "publications:read");
  if ("error" in auth) return auth.error;
  const { publicationId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(publicationId)) return apiError(400, "invalid_parameters", "Identificador inválido.");
  const { data } = await auth.admin.from("publication_exports").select("id, status, storage_path, image_path, package_sha256, image_sha256").eq("id", publicationId).maybeSingle();
  if (!data?.storage_path || !data.image_path) return apiError(404, "not_found", "Publicação não encontrada.");
  if (["failed", "superseded"].includes(data.status)) return apiError(409, "not_available", "Publicação não está disponível.");
  const [pkg, image] = await Promise.all([
    auth.admin.storage.from("publication-packages").createSignedUrl(data.storage_path, URL_TTL_SECONDS),
    auth.admin.storage.from("publication-packages").createSignedUrl(data.image_path, URL_TTL_SECONDS),
  ]);
  if (!pkg.data?.signedUrl || !image.data?.signedUrl) return apiError(502, "storage_unavailable", "Arquivos temporariamente indisponíveis; tente novamente.");
  await logIntegration(auth.admin, auth.client, "assets", data.id);
  return apiOk({ data: { expires_in: URL_TTL_SECONDS, package: { url: pkg.data.signedUrl, sha256: data.package_sha256 }, image: { url: image.data.signedUrl, sha256: data.image_sha256 } } });
}
