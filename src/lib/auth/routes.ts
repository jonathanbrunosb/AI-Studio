import { getConfiguredAppOrigin } from "./app-url";

export const protectedPrefixes = ["/dashboard", "/studio", "/biblioteca", "/gestao-editorial", "/publicacoes", "/modelos", "/administracao"] as const;
export const publicAuthPrefixes = ["/login", "/recuperar-senha"] as const;

export function matchesRoutePrefix(pathname: string, prefixes: readonly string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function safeInternalRedirect(value: string | null | undefined, fallback = "/dashboard") {
  return value?.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

/**
 * URL absoluta para redirecionamentos em route handlers. Atrás de proxy (Railway), `request.url` pode
 * refletir o host interno do servidor; por isso a origem pública configurada (NEXT_PUBLIC_APP_URL) tem prioridade.
 */
export function appUrl(path: string, requestUrl: string, configured = process.env.NEXT_PUBLIC_APP_URL) {
  const safePath = safeInternalRedirect(path, "/");
  // Origem pública validada (HTTPS, ou HTTP apenas em localhost); inválida ou ausente → origem da requisição.
  const origin = getConfiguredAppOrigin(configured);
  return new URL(safePath, origin ?? requestUrl);
}
