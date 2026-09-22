import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { matchesRoutePrefix, protectedPrefixes, publicAuthPrefixes } from "@/lib/auth/routes";

export async function proxy(request: NextRequest) {
  const { response, userId } = await updateSession(request);
  const path = request.nextUrl.pathname;
  const isProtected = matchesRoutePrefix(path, protectedPrefixes);

  if (!userId && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", `${path}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (userId && matchesRoutePrefix(path, publicAuthPrefixes)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
