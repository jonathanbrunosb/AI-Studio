"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, passwordSchema, recoverySchema } from "@/lib/validation/auth";
import { safeInternalRedirect } from "@/lib/auth/routes";
import { getConfiguredAppOrigin } from "@/lib/auth/app-url";
import { log } from "@/lib/observability/logger";

export type AuthActionState = { status: "idle" | "error" | "success"; message?: string; fieldErrors?: Record<string, string[]> };

export async function loginAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Revise os campos informados.", fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    log("warn", "auth.login_failed", { code: error?.code ?? "no_user", status: error?.status ?? null });
    return { status: "error", message: "E-mail ou senha inválidos." };
  }

  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!profile?.is_active) {
    log("warn", "auth.login_inactive", { userId: data.user.id });
    await supabase.auth.signOut();
    return { status: "error", message: "Acesso indisponível. Procure um administrador do AI Studio." };
  }

  redirect(safeInternalRedirect(String(formData.get("redirect") || "/dashboard")));
}

export async function requestPasswordRecovery(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = recoverySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Informe um e-mail válido.", fieldErrors: parsed.error.flatten().fieldErrors };

  // Destino do link somente da configuração (HTTPS, ou HTTP local): evita injeção de Host/Origin.
  const origin = getConfiguredAppOrigin();
  if (!origin) {
    log("error", "config.invalid", { missing: "NEXT_PUBLIC_APP_URL", context: "password_recovery" });
    return { status: "error", message: "A recuperação de senha está temporariamente indisponível." };
  }
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, { redirectTo: `${origin}/auth/callback?next=/atualizar-senha` });

  return { status: "success", message: "Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação." };
}

export async function updatePasswordAction(_: AuthActionState, formData: FormData): Promise<AuthActionState> {
  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Revise a nova senha.", fieldErrors: parsed.error.flatten().fieldErrors };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "O link expirou. Solicite uma nova recuperação de senha." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { status: "error", message: "Não foi possível atualizar a senha. Solicite um novo link." };
  await supabase.auth.signOut();
  redirect("/login?password=updated");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
