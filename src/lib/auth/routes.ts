export const protectedPrefixes = ["/dashboard", "/studio", "/biblioteca", "/gestao-editorial", "/publicacoes", "/modelos", "/administracao"] as const;
export const publicAuthPrefixes = ["/login", "/recuperar-senha"] as const;

export function matchesRoutePrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function safeInternalRedirect(value: string | null | undefined, fallback = "/dashboard") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}
