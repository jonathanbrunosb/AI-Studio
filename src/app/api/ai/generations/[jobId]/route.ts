import { z } from "zod";
import { getGenerationContext, toErrorResponse } from "@/lib/ai/server";
import { refreshGeneration } from "@/lib/ai/services/generation-service";
import { buildJobViews } from "@/lib/ai/services/job-queries";

export const dynamic = "force-dynamic";

/** Consulta o status no provedor e persiste o resultado quando concluído. Chamado periodicamente pelo painel. */
export async function GET(_request: Request, ctx: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await ctx.params;
    if (!z.string().uuid().safeParse(jobId).success) return Response.json({ error: "Solicitação inválida." }, { status: 400 });
    const context = await getGenerationContext();
    if (!context) return Response.json({ error: "Sessão expirada." }, { status: 401 });
    const job = await refreshGeneration(jobId, context.deps);
    const [view] = await buildJobViews(context.supabase, [job]);
    return Response.json({ job: view });
  } catch (error) {
    return toErrorResponse(error);
  }
}
