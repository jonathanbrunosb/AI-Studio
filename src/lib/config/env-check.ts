/** Verificação de configuração na inicialização. Retorna somente nomes de variáveis, nunca valores. */
export const requiredEnv = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_APP_URL"] as const;
export const productionEnv = ["NEXT_SERVER_ACTIONS_ENCRYPTION_KEY"] as const;
export const optionalEnv = ["FAL_KEY", "PORTAL_SIGNING_PRIVATE_KEY"] as const;

export function checkEnvironment(env: Record<string, string | undefined> = process.env) {
  const production = env.NODE_ENV === "production" && env.E2E_MODE !== "true";
  const missing = [...requiredEnv, ...(production ? productionEnv : [])].filter((name) => !env[name]?.trim());
  const disabledFeatures = optionalEnv.filter((name) => !env[name]?.trim());
  const problems: string[] = [];
  if (production && env.NEXT_PUBLIC_APP_URL && !env.NEXT_PUBLIC_APP_URL.startsWith("https://")) problems.push("NEXT_PUBLIC_APP_URL deve usar HTTPS");
  if (env.E2E_MODE === "true" && (env.RAILWAY_ENVIRONMENT || env.RAILWAY_PROJECT_ID)) problems.push("E2E_MODE definido em ambiente Railway (ignorado)");
  if (env.ENABLE_HSTS === "true" && !env.NEXT_PUBLIC_APP_URL?.startsWith("https://")) problems.push("ENABLE_HSTS ativo sem URL pública HTTPS");
  return { missing, disabledFeatures, problems };
}
