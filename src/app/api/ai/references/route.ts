import { z } from "zod";
import { getGenerationContext, toErrorResponse } from "@/lib/ai/server";
import { GenerationError } from "@/lib/ai/services/generation-service";
import { referenceAllowed } from "@/lib/ai/services/generation-validation";
import { inspectImage, referenceMaxBytes, validateImageFile } from "@/lib/ai/utils/image-processing";

const fieldsSchema = z.object({
  contentId: z.string().uuid(),
  sensitivity: z.enum(["public", "internal", "restricted", "confidential"]),
  authorized: z.literal("true"),
});

/** Recebe a imagem de referência, valida conteúdo real e armazena no bucket privado ai-references. */
export async function POST(request: Request) {
  try {
    const context = await getGenerationContext();
    if (!context) return Response.json({ error: "Sessão expirada." }, { status: 401 });
    if (!context.canGenerate) throw new GenerationError("forbidden", "Seu perfil não permite enviar referências.");
    const form = await request.formData();
    const file = form.get("file");
    const fields = fieldsSchema.safeParse({ contentId: form.get("contentId"), sensitivity: form.get("sensitivity"), authorized: form.get("authorized") });
    if (!fields.success) throw new GenerationError("invalid_request", "Confirme a autorização de uso e a classificação da imagem.");
    if (!(file instanceof File)) throw new GenerationError("invalid_request", "Selecione uma imagem.");
    const invalid = validateImageFile(file, referenceMaxBytes);
    if (invalid) throw new GenerationError("invalid_request", invalid);
    if (!referenceAllowed(fields.data.sensitivity, context.config.allowRestrictedReferences)) {
      throw new GenerationError("reference_blocked", "Imagens restritas ou confidenciais não podem ser enviadas ao provedor externo sem autorização expressa da administração.");
    }
    if (!(await context.deps.repo.canEditContent(fields.data.contentId))) throw new GenerationError("forbidden", "Este conteúdo não está disponível para edição.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const info = inspectImage(bytes);
    if (!info) throw new GenerationError("invalid_request", "O arquivo não é uma imagem PNG, JPG ou WebP válida.");
    const path = `${context.user.id}/${fields.data.contentId}/${crypto.randomUUID()}.${info.extension}`;
    const upload = await context.adminClient.storage.from("ai-references").upload(path, bytes, { contentType: info.mimeType, upsert: false });
    if (upload.error) throw new GenerationError("storage_error", "Não foi possível armazenar a referência. Tente novamente.");
    const { data, error } = await context.adminClient.from("media_assets").insert({
      content_id: fields.data.contentId, storage_path: path, file_name: file.name.slice(0, 120), mime_type: info.mimeType,
      created_by: context.user.id, bucket: "ai-references", source: "ai_reference", width: info.width, height: info.height,
      size_bytes: bytes.byteLength, in_library: false, sensitivity: fields.data.sensitivity,
    }).select("id, file_name, storage_path, mime_type").single();
    if (error || !data) {
      await context.adminClient.storage.from("ai-references").remove([path]);
      throw new GenerationError("storage_error", "Não foi possível registrar a referência.");
    }
    const signed = await context.supabase.storage.from("ai-references").createSignedUrl(path, 3600);
    return Response.json({ asset: { id: data.id, fileName: data.file_name, storagePath: data.storage_path, mimeType: data.mime_type, bucket: "ai-references", signedUrl: signed.data?.signedUrl ?? "" } }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
