export const dynamic = "force-dynamic";

/** Liveness público: indica apenas que o processo responde. Sem dados de infraestrutura ou credenciais. */
export function GET() {
  return Response.json({ status: "ok", time: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}

export function HEAD() {
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
