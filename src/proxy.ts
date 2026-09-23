import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { matchesRoutePrefix, protectedPrefixes, publicAuthPrefixes } from "@/lib/auth/routes";
import { buildContentSecurityPolicy } from "@/lib/security/headers";

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
  const csp = buildContentSecurityPolicy(nonce, {
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDev: process.env.NODE_ENV === "development",
    upgradeInsecure: process.env.NODE_ENV === "production" && process.env.ENABLE_HSTS === "true",
  });
  const withHeaders = (response: NextResponse) => {
    response.headers.set("Content-Security-Policy", csp);
    response.headers.set("X-Request-Id", requestId);
    return response;
  };

  const { response, userId } = await updateSession(request, { "x-nonce": nonce, "content-security-policy": csp, "x-request-id": requestId });
  const path = request.nextUrl.pathname;

  if (!userId && matchesRoutePrefix(path, protectedPrefixes)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${path}${request.nextUrl.search}`);
    return withHeaders(NextResponse.redirect(loginUrl));
  }

  if (userId && matchesRoutePrefix(path, publicAuthPrefixes)) {
    return withHeaders(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  return withHeaders(response);
}

export const config = {
  matcher: ["/((?!api/health|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
