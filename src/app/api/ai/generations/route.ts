import { z } from "zod";
import { getGenerationContext, toErrorResponse } from "@/lib/ai/server";
import { submitGeneration, GenerationError } from "@/lib/ai/services/generation-service";
import { generationRequestSchema } from "@/lib/ai/services/generation-validation";
import { buildJobViews, listContentJobs } from "@/lib/ai/services/job-queries";
import { jobColumns, toJobRecord } from "@/lib/ai/repository/supabase-generation-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const context = await getGenerationContext();
    if (!context) return Response.json({ error: "Sessão expirada." }, { status: 401 });
    const contentId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("contentId"));
    if (!contentId.success) return Response.json({ error: "Conteúdo inválido." }, { status: 400 });
    return Response.json({ jobs: await listContentJobs(context.supabase, contentId.data) });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const context = await getGenerationContext();
    if (!context) return Response.json({ error: "Sessão expirada." }, { status: 401 });
    const parsed = generationRequestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new GenerationError("invalid_request", parsed.error.issues[0]?.message ?? "Solicitação inválida.");
    const jobId = await submitGeneration({ userId: context.user.id, canGenerate: context.canGenerate }, parsed.data, context.deps);
    const { data } = await context.supabase.from("generation_jobs").select(jobColumns).eq("id", jobId).single();
    const [job] = await buildJobViews(context.supabase, data ? [toJobRecord(data)] : []);
    return Response.json({ job }, { status: 202 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
