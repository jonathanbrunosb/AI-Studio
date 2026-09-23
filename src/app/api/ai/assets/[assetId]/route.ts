import { z } from "zod";
import { getGenerationContext, toErrorResponse } from "@/lib/ai/server";
import { GenerationError } from "@/lib/ai/services/generation-service";

const idSchema = z.string().uuid();

async function loadOwnedAsset(assetId: string) {
  const context = await getGenerationContext();
  if (!context) return { context: null, asset: null };
  const { data: asset } = await context.supabase.from("media_assets")
    .select("id, created_by, bucket, storage_path, content_id, deleted_at, source").eq("id", assetId).maybeSingle();
  if (!asset || asset.deleted_at) throw new GenerationError("not_found", "Imagem não encontrada.");
  if (asset.created_by !== context.user.id && !context.isAdmin) throw new GenerationError("forbidden", "Somente o responsável pode alterar esta imagem.");
  return { context, asset };
}

/** "Salvar na biblioteca": disponibiliza a imagem gerada na biblioteca de mídias do editor. */
export async function PATCH(_request: Request, ctx: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await ctx.params;
    if (!idSchema.safeParse(assetId).success) return Response.json({ error: "Imagem inválida." }, { status: 400 });
    const { context, asset } = await loadOwnedAsset(assetId);
    if (!context || !asset) return Response.json({ error: "Sessão expirada." }, { status: 401 });
    const { error } = await context.adminClient.from("media_assets").update({ in_library: true }).eq("id", asset.id);
    if (error) throw new GenerationError("storage_error", "Não foi possível salvar na biblioteca.");
    return Response.json({ ok: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}

/**
 * Exclusão lógica. O arquivo físico só é removido quando nenhuma versão do conteúdo o referencia
 * e o conteúdo não está aprovado/publicado, preservando rastreabilidade e versões anteriores.
 */
export async function DELETE(_request: Request, ctx: { params: Promise<{ assetId: string }> }) {
  try {
    const { assetId } = await ctx.params;
    if (!idSchema.safeParse(assetId).success) return Response.json({ error: "Imagem inválida." }, { status: 400 });
    const { context, asset } = await loadOwnedAsset(assetId);
    if (!context || !asset) return Response.json({ error: "Sessão expirada." }, { status: 401 });

    let referenced = false;
    if (asset.content_id) {
      const [{ data: content }, { data: versions }] = await Promise.all([
        context.adminClient.from("contents").select("status").eq("id", asset.content_id).maybeSingle(),
        context.adminClient.from("content_versions").select("snapshot").eq("content_id", asset.content_id),
      ]);
      referenced = ["approved", "published", "in_review"].includes(content?.status ?? "")
        || (versions ?? []).some((version) => JSON.stringify(version.snapshot).includes(asset.storage_path));
    }
    const { error } = await context.adminClient.from("media_assets").update({ deleted_at: new Date().toISOString(), in_library: false }).eq("id", asset.id);
    if (error) throw new GenerationError("storage_error", "Não foi possível excluir a imagem.");
    if (!referenced) await context.adminClient.storage.from(asset.bucket).remove([asset.storage_path]);
    await context.adminClient.from("audit_logs").insert({ actor_id: context.user.id, action: "media_asset.deleted", entity_type: "media_assets", entity_id: asset.id, metadata: { file_removed: !referenced, source: asset.source } });
    return Response.json({ ok: true, fileRetained: referenced, message: referenced ? "Imagem removida da galeria. O arquivo foi mantido porque está vinculado a versões do conteúdo." : "Imagem excluída." });
  } catch (error) {
    return toErrorResponse(error);
  }
}
