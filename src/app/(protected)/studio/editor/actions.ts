"use server";

import { z } from "zod";
import { requireUser } from "@/lib/auth/authorization";
import { editorProjectSchema } from "@/lib/editor/editor-types";
import type { Json } from "@/types/database";

const saveSchema = z.object({
  contentId: z.string().uuid(),
  project: editorProjectSchema,
  checkpoint: z.boolean().default(false),
  label: z.string().trim().max(120).optional(),
});

export type EditorSaveResult = {
  ok: boolean;
  savedAt?: string;
  versionNumber?: number;
  error?: string;
};

export async function saveEditorProjectAction(input: unknown): Promise<EditorSaveResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "A composição contém dados inválidos." };

  const { user, roles, supabase } = await requireUser();
  if (!roles.some((role) => role === "admin" || role === "editor")) {
    return { ok: false, error: "Seu perfil não permite salvar projetos visuais." };
  }

  const { data: content } = await supabase
    .from("contents")
    .select("id, created_by, status")
    .eq("id", parsed.data.contentId)
    .maybeSingle();

  if (!content || !["draft", "changes_requested"].includes(content.status)
      || (!roles.includes("admin") && content.created_by !== user.id)) {
    return { ok: false, error: "Este conteúdo não está disponível para edição." };
  }

  const snapshot = { ...parsed.data.project, updatedAt: new Date().toISOString() };
  const snapshotJson = snapshot as unknown as Json;
  const { data: working } = await supabase
    .from("content_versions")
    .select("id, version_number")
    .eq("content_id", content.id)
    .eq("version_kind", "working")
    .maybeSingle();

  const workingResult = working
    ? await supabase.from("content_versions")
      .update({ snapshot: snapshotJson, label: "Versão de trabalho" })
      .eq("id", working.id)
      .select("id, version_number, updated_at").single()
    : await supabase.from("content_versions")
      .insert({
        content_id: content.id,
        snapshot: snapshotJson,
        version_kind: "working",
        label: "Versão de trabalho",
        created_by: user.id,
        version_number: 0,
      })
      .select("id, version_number, updated_at").single();

  if (workingResult.error || !workingResult.data) {
    return { ok: false, error: "Falha ao persistir a versão de trabalho." };
  }

  let versionNumber = workingResult.data.version_number;
  if (parsed.data.checkpoint) {
    const checkpoint = await supabase.from("content_versions").insert({
      content_id: content.id,
      snapshot: snapshotJson,
      version_kind: "checkpoint",
      label: parsed.data.label || "Salvamento manual",
      created_by: user.id,
      version_number: 0,
    }).select("version_number").single();
    if (checkpoint.error || !checkpoint.data) {
      return { ok: false, error: "A versão de trabalho foi salva, mas o marco do histórico não foi criado." };
    }
    versionNumber = checkpoint.data.version_number;
  }

  return { ok: true, savedAt: workingResult.data.updated_at, versionNumber };
}
