"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { accessMutationSchema, inviteUserSchema, roleMutationSchema } from "@/lib/validation/admin";

function adminRedirect(kind: "success" | "error", message: string): never {
  redirect(`/administracao?${kind}=${encodeURIComponent(message)}`);
}

export async function inviteUserAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = inviteUserSchema.safeParse({ ...Object.fromEntries(formData), roles: formData.getAll("roles") });
  if (!parsed.success) adminRedirect("error", parsed.error.issues[0]?.message ?? "Dados do convite inválidos.");

  let admin;
  try { admin = createAdminClient(); } catch { adminRedirect("error", "Configure SUPABASE_SERVICE_ROLE_KEY no servidor para habilitar convites."); }
  const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/callback?next=/atualizar-senha`;
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    redirectTo,
    data: { full_name: parsed.data.full_name, department: parsed.data.department || null },
  });
  if (error || !data.user) adminRedirect("error", "Não foi possível enviar o convite. Verifique o e-mail e tente novamente.");

  const { error: roleError } = await supabase.from("user_roles").insert(parsed.data.roles.map((role) => ({ user_id: data.user.id, role })));
  if (roleError) adminRedirect("error", "O convite foi enviado, mas os perfis não puderam ser atribuídos.");
  revalidatePath("/administracao");
  adminRedirect("success", "Convite enviado e perfis atribuídos.");
}

export async function assignRoleAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = roleMutationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminRedirect("error", "Solicitação de permissão inválida.");
  const { error } = await supabase.from("user_roles").insert(parsed.data);
  if (error) adminRedirect("error", error.code === "23505" ? "O usuário já possui esse perfil." : "Não foi possível atribuir o perfil.");
  revalidatePath("/administracao");
  adminRedirect("success", "Perfil atribuído com sucesso.");
}

export async function revokeRoleAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = roleMutationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminRedirect("error", "Solicitação de permissão inválida.");
  const { error } = await supabase.from("user_roles").delete().eq("user_id", parsed.data.user_id).eq("role", parsed.data.role);
  if (error) adminRedirect("error", "Não foi possível revogar o perfil. O único administrador ativo é protegido.");
  revalidatePath("/administracao");
  adminRedirect("success", "Perfil revogado com sucesso.");
}

export async function toggleUserAccessAction(formData: FormData) {
  const { supabase } = await requireAdmin();
  const parsed = accessMutationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) adminRedirect("error", "Solicitação de acesso inválida.");
  const { error } = await supabase.from("profiles").update({ is_active: parsed.data.is_active === "true" }).eq("id", parsed.data.user_id);
  if (error) adminRedirect("error", "Não foi possível alterar o acesso. O único administrador ativo é protegido.");
  revalidatePath("/administracao");
  adminRedirect("success", "Status de acesso atualizado.");
}
