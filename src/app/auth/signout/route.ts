import { NextResponse, type NextRequest } from "next/server";
import { log } from "@/lib/observability/logger";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Encerra a sessão de um usuário desativado. Só atua quando o perfil está de fato inativo,
 * para que um link externo não consiga deslogar usuários ativos (CSRF de logout).
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  const { data: profile } = await supabase.from("profiles").select("is_active").eq("id", user.id).maybeSingle();
  if (profile?.is_active) return NextResponse.redirect(new URL("/dashboard", request.url));
  log("warn", "auth.login_inactive", { userId: user.id, stage: "session" });
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/login?session=inactive", request.url));
}
