"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/authorization";
import { generateClientToken } from "@/lib/integrations/portal-api";
import { createAdminClient } from "@/lib/supabase/admin";

function back(kind: "success" | "error", message: string): never {
  redirect(`/administracao/integracoes?${kind}=${encodeURIComponent(message)}`);
}

export async function updateIntegrationSettingsAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const { error } = await supabase.from("portal_integration_settings").update({
    api_enabled: formData.get("api_enabled") === "on", require_signature: formData.get("require_signature") === "on", updated_by: user.id,
  }).eq("id", true);
  if (error) back("error", "Não foi possível salvar a configuração.");
  revalidatePath("/administracao/integracoes");
  back("success", "Configuração da integração atualizada e auditada.");
}

const destinationSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/, "Identificador: letras minúsculas, números e _."),
  label: z.string().trim().min(3).max(120),
  portal_collection: z.enum(["newsletter", "noticias"]),
  portal_category: z.string().trim().min(2).max(80),
  notes: z.string().trim().max(500).optional(),
});

export async function saveDestinationAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const parsed = destinationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("error", parsed.error.issues[0]?.message ?? "Destino inválido.");
  const { error } = await supabase.from("portal_destinations").upsert({ ...parsed.data, notes: parsed.data.notes || null, enabled: formData.get("enabled") !== "false", updated_by: user.id });
  if (error) back("error", "Não foi possível salvar o destino.");
  revalidatePath("/administracao/integracoes");
  back("success", "Destino salvo.");
}

export async function toggleDestinationAction(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const id = z.string().regex(/^[a-z][a-z0-9_]{2,40}$/).safeParse(formData.get("id"));
  if (!id.success) back("error", "Destino inválido.");
  const { error } = await supabase.from("portal_destinations").update({ enabled: formData.get("enabled") === "true", updated_by: user.id }).eq("id", id.data);
  if (error) back("error", "Não foi possível atualizar o destino.");
  revalidatePath("/administracao/integracoes");
  back("success", "Destino atualizado.");
}

const mappingSchema = z.object({
  category: z.enum(["internal_communication", "accounting_newsletter", "system_announcement", "internal_campaign"]),
  destination_id: z.string().regex(/^[a-z][a-z0-9_]{2,40}$/),
  operation: z.enum(["add", "remove", "default"]),
});

export async function updateMappingAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = mappingSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) back("error", "Mapeamento inválido.");
  const { category, destination_id, operation } = parsed.data;
  let error;
  if (operation === "add") ({ error } = await supabase.from("content_category_destinations").upsert({ category, destination_id, is_default: false }));
  if (operation === "remove") ({ error } = await supabase.from("content_category_destinations").delete().eq("category", category).eq("destination_id", destination_id));
  if (operation === "default") {
    ({ error } = await supabase.from("content_category_destinations").update({ is_default: false }).eq("category", category));
    if (!error) ({ error } = await supabase.from("content_category_destinations").update({ is_default: true }).eq("category", category).eq("destination_id", destination_id));
  }
  if (error) back("error", "Não foi possível atualizar o mapeamento.");
  revalidatePath("/administracao/integracoes");
  back("success", "Mapeamento atualizado.");
}

export async function createClientAction(formData: FormData) {
  const { user } = await requireAdmin();
  const name = z.string().trim().min(3).max(80).safeParse(formData.get("name"));
  if (!name.success) back("error", "Informe um nome com 3 a 80 caracteres.");
  let admin;
  try { admin = createAdminClient(); } catch { back("error", "Configure SUPABASE_SERVICE_ROLE_KEY no servidor."); }
  const { token, hash, prefix } = generateClientToken();
  const { error } = await admin.from("integration_clients").insert({ name: name.data, token_hash: hash, token_prefix: prefix, created_by: user.id });
  if (error) back("error", "Não foi possível criar a credencial.");
  revalidatePath("/administracao/integracoes");
  // Exibido uma única vez (cookie httpOnly de 60 s, fora da URL e dos logs); não é armazenado em texto claro.
  (await cookies()).set("ais_new_client_token", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/administracao/integracoes", maxAge: 60 });
  back("success", "Credencial criada. Copie o token agora: ele não será exibido novamente.");
}

export async function revokeClientAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const id = z.uuid().safeParse(formData.get("id"));
  if (!id.success) back("error", "Credencial inválida.");
  const { error } = await supabase.from("integration_clients").update({ enabled: false, revoked_at: new Date().toISOString() }).eq("id", id.data);
  if (error) back("error", "Não foi possível revogar a credencial.");
  revalidatePath("/administracao/integracoes");
  back("success", "Credencial revogada.");
}

export async function dismissTokenAction() {
  await requireAdmin();
  (await cookies()).delete({ name: "ais_new_client_token", path: "/administracao/integracoes" });
  redirect("/administracao/integracoes");
}
