/**
 * Cabeçalhos de segurança HTTP. A CSP usa nonce por requisição para scripts ('strict-dynamic'),
 * sem 'unsafe-inline' nem 'unsafe-eval' em produção. Estilos inline são permitidos porque o React
 * e o editor (Fabric) aplicam atributos style; scripts inline continuam bloqueados.
 */
export function buildContentSecurityPolicy(nonce: string, options: { supabaseUrl?: string; isDev?: boolean; upgradeInsecure?: boolean } = {}) {
  const supabase = options.supabaseUrl ? new URL(options.supabaseUrl).origin : "";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' blob: data: ${supabase}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${supabase}${options.isDev ? " ws:" : ""}`.trim(),
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.upgradeInsecure ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

export const staticSecurityHeaders: { key: string; value: string }[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

/** HSTS somente quando explicitamente habilitado (produção atrás de HTTPS validado). */
export function hstsHeader() {
  return process.env.ENABLE_HSTS === "true"
    ? { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }
    : null;
}
