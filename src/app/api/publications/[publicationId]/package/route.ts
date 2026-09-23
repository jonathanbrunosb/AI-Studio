import { getCurrentUserContext } from "@/lib/auth/authorization";
import { sha256Hex } from "@/lib/publications/manifest";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/** Download autenticado do pacote. Registra a exportação (sem alterar o status editorial). */
export async function GET(_request: Request, ctx: { params: Promise<{ publicationId: string }> }) {
  const { publicationId } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(publicationId)) return Response.json({ error: "Publicação inválida." }, { status: 400 });
  const context = await getCurrentUserContext();
  if (!context) return Response.json({ error: "Sessão expirada." }, { status: 401 });
  // Visibilidade verificada pelo RLS do usuário antes de qualquer acesso ao Storage.
  const { data: publication } = await context.supabase.from("publication_exports")
    .select("id, content_id, status, storage_path, package_sha256").eq("id", publicationId).maybeSingle();
  if (!publication?.storage_path) return Response.json({ error: "Pacote não encontrado." }, { status: 404 });
  if (["failed", "superseded"].includes(publication.status)) return Response.json({ error: "Este pacote não está mais válido para publicação." }, { status: 409 });

  const { error: transitionError } = await context.supabase.rpc("transition_publication", { p_publication_id: publicationId, p_action: "exported" });
  if (transitionError) return Response.json({ error: "Seu perfil não permite exportar este pacote." }, { status: 403 });

  let admin;
  try { admin = createAdminClient(); } catch { return Response.json({ error: "Configuração do servidor incompleta." }, { status: 503 }); }
  const { data: file, error } = await admin.storage.from("publication-packages").download(publication.storage_path);
  if (error || !file) return Response.json({ error: "Falha ao recuperar o pacote. Tente novamente; o material aprovado foi preservado." }, { status: 502 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (publication.package_sha256 && sha256Hex(bytes) !== publication.package_sha256) {
    return Response.json({ error: "O pacote armazenado não corresponde ao hash registrado. Prepare a publicação novamente." }, { status: 409 });
  }
  const fileName = publication.storage_path.split("/").pop() ?? "pacote.zip";
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^a-zA-Z0-9._-]/g, "-")}"`,
      "Cache-Control": "no-store",
      "X-Package-SHA256": publication.package_sha256 ?? "",
    },
  });
}
