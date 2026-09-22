"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/authorization";
import { workflowErrorMessage } from "@/lib/editorial/workflow-rules";

export type WorkflowResult = { ok: boolean; message: string; stateChanged?: boolean };

function refresh(contentId?: string) {
  for (const path of ["/gestao-editorial", "/dashboard", "/biblioteca", "/studio"]) revalidatePath(path);
  if (contentId) revalidatePath(`/gestao-editorial/revisao/${contentId}`);
  revalidatePath("/", "layout");
}

function failure(error: { message?: string } | null): WorkflowResult {
  const message = workflowErrorMessage(error?.message);
  return { ok: false, message, stateChanged: Boolean(error?.message && /STATE_CHANGED|VERSION_MISMATCH|STALE_COMPOSITION/.test(error.message)) };
}

const submitSchema = z.object({
  contentId: z.uuid(),
  reviewerId: z.uuid().nullable(),
  comment: z.string().trim().max(1000).nullable(),
  expectedWorkingUpdatedAt: z.iso.datetime({ offset: true }).nullable(),
});

/** As regras são aplicadas no banco (submit_content_for_review); a action apenas valida o formato. */
export async function submitForReviewAction(input: unknown): Promise<WorkflowResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Dados do envio inválidos." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("submit_content_for_review", {
    p_content_id: parsed.data.contentId, p_reviewer_id: parsed.data.reviewerId,
    p_comment: parsed.data.comment, p_expected_working_updated_at: parsed.data.expectedWorkingUpdatedAt,
  });
  refresh(parsed.data.contentId);
  if (error) return failure(error);
  return { ok: true, message: "Conteúdo encaminhado para aprovação." };
}

const decisionSchema = z.object({
  contentId: z.uuid(),
  versionId: z.uuid(),
  decision: z.enum(["approved", "changes_requested"]),
  comment: z.string().trim().max(2000).nullable(),
});

export async function decideReviewAction(input: unknown): Promise<WorkflowResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Decisão inválida." };
  if (parsed.data.decision === "changes_requested" && (parsed.data.comment ?? "").length < 5) {
    return { ok: false, message: workflowErrorMessage("COMMENT_REQUIRED") };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("decide_content_review", {
    p_content_id: parsed.data.contentId, p_version_id: parsed.data.versionId,
    p_decision: parsed.data.decision, p_comment: parsed.data.comment,
  });
  refresh(parsed.data.contentId);
  if (error) return failure(error);
  return { ok: true, message: parsed.data.decision === "approved" ? "Conteúdo aprovado. A versão revisada está protegida e disponível para publicação." : "Ajustes solicitados. O autor foi notificado." };
}

const idSchema = z.uuid();

export async function createNewVersionAction(contentId: string): Promise<WorkflowResult> {
  if (!idSchema.safeParse(contentId).success) return { ok: false, message: "Conteúdo inválido." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_new_content_version", { p_content_id: contentId });
  refresh(contentId);
  if (error) return failure(error);
  return { ok: true, message: "Nova versão de trabalho criada. A versão aprovada foi preservada no histórico." };
}

export async function archiveContentAction(contentId: string, reason: string | null): Promise<WorkflowResult> {
  if (!idSchema.safeParse(contentId).success) return { ok: false, message: "Conteúdo inválido." };
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("archive_content", { p_content_id: contentId, p_reason: reason?.trim().slice(0, 500) || null });
  refresh(contentId);
  if (error) return failure(error);
  return { ok: true, message: "Conteúdo arquivado. Versões e histórico foram preservados." };
}

export async function markNotificationsReadAction(ids: string[] | "all"): Promise<WorkflowResult> {
  const { supabase, user } = await requireUser();
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", user.id).is("read_at", null);
  if (ids !== "all") {
    const valid = ids.filter((id) => idSchema.safeParse(id).success).slice(0, 100);
    if (!valid.length) return { ok: true, message: "" };
    query = query.in("id", valid);
  }
  const { error } = await query;
  revalidatePath("/", "layout");
  return error ? { ok: false, message: "Não foi possível atualizar as notificações." } : { ok: true, message: "" };
}

export async function listEligibleReviewersAction(contentId: string) {
  if (!idSchema.safeParse(contentId).success) return [];
  const { supabase } = await requireUser();
  const { data } = await supabase.rpc("list_eligible_reviewers", { p_content_id: contentId });
  return data ?? [];
}
