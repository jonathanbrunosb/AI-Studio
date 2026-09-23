import { z } from "zod";
import { getGenerationContext, toErrorResponse } from "@/lib/ai/server";
import { cancelGeneration } from "@/lib/ai/services/generation-service";

export async function POST(_request: Request, ctx: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await ctx.params;
    if (!z.string().uuid().safeParse(jobId).success) return Response.json({ error: "Solicitação inválida." }, { status: 400 });
    const context = await getGenerationContext();
    if (!context) return Response.json({ error: "Sessão expirada." }, { status: 401 });
    return Response.json(await cancelGeneration(jobId, context.user.id, context.deps));
  } catch (error) {
    return toErrorResponse(error);
  }
}
