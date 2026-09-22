import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "editor" | "approver";

export async function getCurrentUserContext() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, department, is_active").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  if (!profile?.is_active) return null;
  return { user, profile, roles: (roleRows?.map((item) => item.role) ?? []) as AppRole[], supabase };
}

export async function requireUser() {
  const context = await getCurrentUserContext();
  if (!context) redirect("/login");
  return context;
}

export async function requireAdmin() {
  const context = await requireUser();
  if (!context.roles.includes("admin")) redirect("/dashboard?access=denied");
  return context;
}
