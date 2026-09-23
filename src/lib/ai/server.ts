import "server-only";
import { getCurrentUserContext } from "@/lib/auth/authorization";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSelectedProvider } from "./providers/selected-provider";
import { loadAiConfiguration, SupabaseGenerationRepository } from "./repository/supabase-generation-repository";
import { GenerationError, type GenerationDeps } from "./services/generation-service";

/** Monta as dependências da geração para o usuário autenticado. Retorna null quando não há sessão válida. */
export async function getGenerationContext() {
  const context = await getCurrentUserContext();
  if (!context) return null;
  const isAdmin = context.roles.includes("admin");
  const canGenerate = isAdmin || context.roles.includes("editor");
  let adminClient;
  try {
    adminClient = createAdminClient();
  } catch {
    throw new GenerationError("not_configured", "A integração de IA está indisponível: o backend não possui a configuração de serviço necessária. Procure o administrador.");
  }
  const repo = new SupabaseGenerationRepository(context.supabase, adminClient, { id: context.user.id, isAdmin });
  const config = await loadAiConfiguration(context.supabase);
  const deps: GenerationDeps = {
    repo, provider: getSelectedProvider(), models: config.models,
    integrationEnabled: config.integrationEnabled, allowRestrictedReferences: config.allowRestrictedReferences,
  };
  return { ...context, isAdmin, canGenerate, adminClient, deps, config };
}

export function toErrorResponse(error: unknown) {
  if (error instanceof GenerationError) {
    const status = { forbidden: 403, not_found: 404, quota_exceeded: 429, invalid_request: 400, model_unavailable: 400, reference_blocked: 400, disabled: 503, not_configured: 503, invalid_credentials: 502, provider_error: 502, storage_error: 500 }[error.code];
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  // Sem detalhes internos, prompts ou credenciais no log.
  console.error("[ai] falha inesperada", error instanceof Error ? error.name : "unknown");
  return Response.json({ error: "Falha inesperada no módulo de IA.", code: "internal" }, { status: 500 });
}
