import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" };

/**
 * Health check público: 200 quando o processo responde e a configuração pública existe; 503 caso contrário.
 * Não expõe credenciais nem detalhes de infraestrutura.
 */
function configured() {
  try {
    getPublicSupabaseConfig();
    return true;
  } catch {
    return false;
  }
}

export function GET() {
  if (!configured()) return Response.json({ status: "unavailable", service: "ai-studio" }, { status: 503, headers: noStore });
  return Response.json({ status: "ok", service: "ai-studio", timestamp: new Date().toISOString() }, { headers: noStore });
}

export function HEAD() {
  return new Response(null, { status: configured() ? 200 : 503, headers: noStore });
}
