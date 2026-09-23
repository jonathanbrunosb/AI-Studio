import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { getPublicSupabaseConfig } from "./config";

/** Renova a sessão e repassa cabeçalhos extras (nonce/CSP, correlation id) para a renderização. */
export async function updateSession(request: NextRequest, extraRequestHeaders: Record<string, string> = {}) {
  const next = () => {
    const headers = new Headers(request.headers);
    Object.entries(extraRequestHeaders).forEach(([name, value]) => headers.set(name, value));
    return NextResponse.next({ request: { headers } });
  };
  let response = next();
  const { url, publishableKey } = getPublicSupabaseConfig();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = next();
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    userId = typeof data?.claims?.sub === "string" ? data.claims.sub : null;
  } catch {
    // Supabase indisponível: trata como não autenticado (rotas protegidas redirecionam ao login).
    userId = null;
  }
  return { response, userId };
}
