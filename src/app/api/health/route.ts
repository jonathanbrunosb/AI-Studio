import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    getPublicSupabaseConfig();
    return Response.json(
      { status: "ok", service: "ai-studio", timestamp: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return Response.json(
      { status: "unavailable", service: "ai-studio" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
