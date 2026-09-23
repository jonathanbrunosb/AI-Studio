"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/authorization";
import { getBranding } from "@/lib/content/branding-service";
import { inspectImage } from "@/lib/ai/utils/image-processing";
import { collectStoragePaths } from "@/lib/editor/snapshot-assets";
import { sha256Hex } from "@/lib/publications/manifest";
import { buildPublicationPackage } from "@/lib/publications/package-builder";
import { canPrepare, publicationErrorMessage, validatePublicationData, type EditorialSnapshot } from "@/lib/publications/publication-rules";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { ContentCategory, ContentStatus } from "@/types/content";

export type PublicationActionResult = { ok: boolean; message: string; publicationId?: string; stateChanged?: boolean };

function refresh() {
  for (const path of ["/publicacoes", "/dashboard", "/gestao-editorial", "/administracao/integracoes"]) revalidatePath(path);
}

const prepareSchema = z.object({
  contentId: z.uuid(),
  versionId: z.uuid(),
  destination: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/),
  accessUrlConfirmed: z.enum(["true", "false"]).default("false"),
  reviewConfirmed: z.literal("true"),
});

/**
 * Gera o pacote a partir da versão aprovada (congelada). A imagem é renderizada no navegador a partir do
 * snapshot aprovado e validada aqui (PNG, dimensões exatas da peça). Hashes e ZIP são calculados no servidor.
 */
export async function preparePublicationAction(formData: FormData): Promise<PublicationActionResult> {
  const parsed = prepareSchema.safeParse(Object.fromEntries([...formData.entries()].filter(([, value]) => typeof value === "string")));
  if (!parsed.success) return { ok: false, message: "Confirme a conferência das informações antes de preparar." };
  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0 || image.size > 20 * 1024 * 1024) return { ok: false, message: "A imagem da peça não pôde ser gerada. Tente novamente." };

  const { supabase, roles, user } = await requireUser();
  const { data: content } = await supabase.from("contents")
    .select("id, title, category, status, created_by, approved_version_id, approved_at").eq("id", parsed.data.contentId).maybeSingle();
  if (!content || !canPrepare(roles, user.id, { created_by: content.created_by, status: content.status as ContentStatus, approved_version_id: content.approved_version_id })) {
    return { ok: false, message: "Você não pode preparar este conteúdo ou ele não possui versão aprovada." };
  }
  if (content.approved_version_id !== parsed.data.versionId) return { ok: false, message: publicationErrorMessage("VERSION_NOT_CURRENT"), stateChanged: true };

  const { data: version } = await supabase.from("content_versions").select("id, version_number, snapshot, version_kind").eq("id", parsed.data.versionId).maybeSingle();
  if (!version || version.version_kind !== "frozen") return { ok: false, message: publicationErrorMessage("VERSION_INVALID") };
  const snapshot = version.snapshot as Record<string, unknown> & { editorial?: EditorialSnapshot; canvas?: { width?: number; height?: number } };
  const editorial = snapshot.editorial ?? {};
  const issues = validatePublicationData(content.category as ContentCategory, editorial, { accessUrlConfirmed: parsed.data.accessUrlConfirmed === "true" });
  if (issues.length) return { ok: false, message: issues.join(" ") };

  const bytes = new Uint8Array(await image.arrayBuffer());
  const info = inspectImage(bytes);
  const width = Number(snapshot.canvas?.width); const height = Number(snapshot.canvas?.height);
  if (!info || info.mimeType !== "image/png" || info.width !== width || info.height !== height) {
    return { ok: false, message: `A imagem gerada não corresponde à peça aprovada (${width}×${height} PNG).` };
  }

  let admin;
  try { admin = createAdminClient(); } catch { return { ok: false, message: "Configuração do servidor incompleta (SUPABASE_SERVICE_ROLE_KEY). Procure o administrador." }; }

  const paths = [...collectStoragePaths(snapshot)];
  if (paths.length) {
    const { data: available } = await admin.from("media_assets").select("storage_path").in("storage_path", paths).is("deleted_at", null);
    if ((available?.length ?? 0) < paths.length) return { ok: false, message: "Há arquivos da peça aprovada indisponíveis. O pacote não foi gerado." };
  }

  const { data: destination } = await supabase.from("content_category_destinations")
    .select("destination_id, portal_destinations(id, label, portal_collection, portal_category, enabled)")
    .eq("category", content.category).eq("destination_id", parsed.data.destination).maybeSingle();
  const target = destination?.portal_destinations as unknown as { id: string; label: string; portal_collection: string; portal_category: string; enabled: boolean } | null;
  if (!target?.enabled) return { ok: false, message: publicationErrorMessage("INVALID_DESTINATION") };

  const [{ data: existing }, { data: previous }, brand] = await Promise.all([
    admin.from("publication_exports").select("id, status").eq("version_id", version.id).eq("destination", target.id).not("status", "in", "(failed,superseded)").maybeSingle(),
    admin.from("publication_exports").select("id, version_id, external_publication_id").eq("content_id", content.id).eq("status", "published").order("published_at", { ascending: false }).limit(1).maybeSingle(),
    getBranding(supabase),
  ]);
  if (existing && ["received", "pending_publication", "published"].includes(existing.status)) return { ok: false, message: publicationErrorMessage("ALREADY_IN_PORTAL") };
  const publicationId = existing?.id ?? crypto.randomUUID();

  const built = buildPublicationPackage({
    publicationId,
    content: {
      id: content.id, title: editorial.title ?? content.title, subtitle: editorial.subtitle ?? null, description: editorial.description ?? null,
      category: content.category as ContentCategory, reference_date: editorial.reference_date ?? null, source_name: editorial.source_name ?? null,
      source_url: editorial.source_url ?? null, editorial_details: editorial.editorial_details ?? {},
    },
    version: { id: version.id, number: version.version_number, approvedAt: content.approved_at ?? new Date().toISOString(), snapshotSha256: sha256Hex(JSON.stringify(version.snapshot)) },
    destination: target, organization: brand.organization,
    supersedes: previous && previous.version_id !== version.id ? { publicationId: previous.id, versionId: previous.version_id, externalPublicationId: previous.external_publication_id } : null,
    preparedAt: new Date().toISOString(),
  }, bytes, { width, height });

  const folder = `${content.id}/${publicationId}`;
  const [zipUpload, imageUpload] = await Promise.all([
    admin.storage.from("publication-packages").upload(`${folder}/${built.fileName}`, built.zip, { contentType: "application/zip", upsert: true }),
    admin.storage.from("publication-packages").upload(`${folder}/${built.manifest.image.filename}`, bytes, { contentType: "image/png", upsert: true }),
  ]);
  if (zipUpload.error || imageUpload.error) return { ok: false, message: "Falha ao armazenar o pacote. Nenhuma alteração foi registrada; tente novamente." };

  const { error } = await admin.rpc("register_publication_package", {
    p_publication_id: publicationId, p_actor: user.id, p_content_id: content.id, p_version_id: version.id, p_destination: target.id,
    p_manifest: built.manifest as unknown as Json, p_manifest_sha256: built.manifestSha256, p_image_sha256: built.imageSha256,
    p_package_sha256: built.packageSha256, p_package_path: `${folder}/${built.fileName}`, p_image_path: `${folder}/${built.manifest.image.filename}`, p_signed: built.signed,
  });
  refresh();
  if (error) return { ok: false, message: publicationErrorMessage(error.message), stateChanged: /CONFLICT|ALREADY|VERSION/.test(error.message) };
  return { ok: true, message: built.signed ? "Pacote preparado e assinado. Baixe o ZIP para importação no portal." : "Pacote preparado (sem assinatura: a chave de assinatura não está configurada).", publicationId };
}

const transitionSchema = z.object({
  publicationId: z.uuid(),
  action: z.enum(["confirm_published", "mark_pending", "fail", "retry"]),
  channel: z.string().trim().max(120).optional().nullable(),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  externalId: z.string().trim().max(200).optional().nullable(),
  externalUrl: z.union([z.literal(""), z.url().refine((value) => /^https?:\/\//.test(value), "URL inválida")]).optional().nullable(),
  message: z.string().trim().max(1000).optional().nullable(),
});

export async function transitionPublicationAction(input: unknown): Promise<PublicationActionResult> {
  const parsed = transitionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  const { supabase } = await requireUser();
  const data = parsed.data;
  const { error } = await supabase.rpc("transition_publication", {
    p_publication_id: data.publicationId, p_action: data.action, p_channel: data.channel ?? null,
    p_published_at: data.publishedAt ? `${data.publishedAt}T12:00:00-03:00` : null,
    p_external_id: data.externalId || null, p_external_url: data.externalUrl || null, p_message: data.message ?? null,
  });
  refresh();
  if (error) return { ok: false, message: publicationErrorMessage(error.message), stateChanged: /STATE_CHANGED/.test(error.message) };
  const messages = { confirm_published: "Publicação confirmada e registrada.", mark_pending: "Registrado: aguardando publicação no portal.", fail: "Falha registrada. É possível tentar novamente.", retry: "Publicação liberada para nova tentativa." };
  return { ok: true, message: messages[data.action] };
}
