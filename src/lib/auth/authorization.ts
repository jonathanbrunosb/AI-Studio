import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "editor" | "approver";

export async function getCurrentUserContext() {
  const result = await resolveUserContext();
  return result.status === "ok" ? result.context : null;
}

/** Distingue sessão ausente de perfil inativo, para encerrar a sessão do inativo sem loop de redirecionamento. */
async function resolveUserContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { status: "anonymous" as const };

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, department, is_active").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  if (!profile?.is_active) return { status: "inactive" as const };
  return { status: "ok" as const, context: { user, profile, roles: (roleRows?.map((item) => item.role) ?? []) as AppRole[], supabase } };
}

export async function requireUser() {
  const result = await resolveUserContext();
  // Usuário desativado com sessão válida: a sessão é encerrada em /auth/signout (o proxy devolveria /login ao dashboard).
  if (result.status === "inactive") redirect("/auth/signout?reason=inactive");
  if (result.status !== "ok") redirect("/login");
  return result.context;
}

export async function requireAdmin() {
  const context = await requireUser();
  if (!context.roles.includes("admin")) redirect("/dashboard?access=denied");
  return context;
}
