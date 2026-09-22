"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authorization";
import { getModelDefinition } from "@/lib/ai/models/model-catalog";

function back(kind: "success" | "error", message: string): never {
  redirect(`/administracao/ia?${kind}=${encodeURIComponent(message)}`);
}

const modelSchema = z.object({
  model_id: z.string().min(3).max(120),
  is_enabled: z.enum(["true", "false"]).optional(),
  estimated_cost_per_image: z.string().trim().max(12).optional(),
});

export async function updateModelAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const parsed = modelSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success || !getModelDefinition(parsed.data.model_id)) back("error", "Modelo inválido.");
  const update: { updated_by: string; is_enabled?: boolean; estimated_cost_per_image?: number | null } = { updated_by: user.id };
  if (parsed.data.is_enabled) update.is_enabled = parsed.data.is_enabled === "true";
  if (parsed.data.estimated_cost_per_image !== undefined) {
    const raw = parsed.data.estimated_cost_per_image.replace(",", ".");
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1000)) back("error", "Custo estimado inválido.");
    update.estimated_cost_per_image = value;
  }
  const { error } = await supabase.from("ai_models").update(update).eq("id", parsed.data.model_id);
  if (error) back("error", "Não foi possível atualizar o modelo.");
  revalidatePath("/administracao/ia");
  back("success", "Modelo atualizado e registrado na auditoria.");
}

const settingsSchema = z.object({
  integration_enabled: z.enum(["true", "false"]),
  default_max_requests: z.coerce.number().int().min(0).max(10000),
  period_days: z.coerce.number().int().min(1).max(365),
  allow_restricted_references: z.enum(["true", "false"]).default("false"),
});

export async function updateAiSettingsAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const parsed = settingsSchema.safeParse({ ...Object.fromEntries(formData), allow_restricted_references: formData.get("allow_restricted_references") ? "true" : "false" });
  if (!parsed.success) back("error", "Configuração inválida.");
  const { error } = await supabase.from("ai_settings").update({
    integration_enabled: parsed.data.integration_enabled === "true",
    default_max_requests: parsed.data.default_max_requests,
    period_days: parsed.data.period_days,
    allow_restricted_references: parsed.data.allow_restricted_references === "true",
    updated_by: user.id,
  }).eq("id", true);
  if (error) back("error", "Não foi possível salvar as configurações.");
  revalidatePath("/administracao/ia");
  back("success", "Configurações de IA atualizadas.");
}

const limitSchema = z.object({ user_id: z.string().uuid(), max_requests: z.string().trim() });

export async function updateUserLimitAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const parsed = limitSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("error", "Limite inválido.");
  if (parsed.data.max_requests === "") {
    const { error } = await supabase.from("ai_user_limits").delete().eq("user_id", parsed.data.user_id);
    if (error) back("error", "Não foi possível remover o limite.");
  } else {
    const value = Number(parsed.data.max_requests);
    if (!Number.isInteger(value) || value < 0 || value > 10000) back("error", "Informe um número inteiro entre 0 e 10.000.");
    const { error } = await supabase.from("ai_user_limits").upsert({ user_id: parsed.data.user_id, max_requests: value, updated_by: user.id });
    if (error) back("error", "Não foi possível salvar o limite.");
  }
  revalidatePath("/administracao/ia");
  back("success", "Limite de consumo atualizado.");
}
