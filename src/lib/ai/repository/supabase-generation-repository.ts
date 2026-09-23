import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { mergeCatalog } from "../models/model-catalog";
import type { GenerationStatus } from "../services/generation-status";
import type { GenerationRepository, JobRecord } from "../services/generation-service";

type Client = SupabaseClient<Database>;
type JobRow = Database["public"]["Tables"]["generation_jobs"]["Row"];

export const jobColumns = "id, content_id, created_by, provider, model, prompt, status, settings, external_request_id, error_message, image_count, estimated_cost, actual_cost, created_at, completed_at";

export function toJobRecord(row: Pick<JobRow, "id" | "content_id" | "created_by" | "provider" | "model" | "prompt" | "status" | "settings" | "external_request_id" | "error_message" | "image_count" | "estimated_cost" | "actual_cost" | "created_at" | "completed_at">): JobRecord {
  return {
    id: row.id, contentId: row.content_id, createdBy: row.created_by, provider: row.provider, model: row.model, prompt: row.prompt,
    status: row.status as GenerationStatus, settings: (row.settings ?? {}) as Record<string, unknown>,
    externalRequestId: row.external_request_id, errorMessage: row.error_message, imageCount: row.image_count,
    estimatedCost: row.estimated_cost === null ? null : Number(row.estimated_cost),
    actualCost: row.actual_cost === null ? null : Number(row.actual_cost),
    createdAt: row.created_at, completedAt: row.completed_at,
  };
}

/**
 * Leituras de autorização usam o cliente do usuário (RLS). Escritas de estado dos jobs, custos e arquivos gerados
 * usam o cliente de serviço, sempre após a verificação de identidade e permissão feita pelo backend.
 */
export class SupabaseGenerationRepository implements GenerationRepository {
  constructor(private readonly userClient: Client, private readonly adminClient: Client, private readonly user: { id: string; isAdmin: boolean }) {}

  async canEditContent(contentId: string) {
    const { data } = await this.userClient.from("contents").select("id, created_by, status").eq("id", contentId).maybeSingle();
    return Boolean(data && ["draft", "changes_requested"].includes(data.status) && (this.user.isAdmin || data.created_by === this.user.id));
  }

  async getReferenceAsset(assetId: string) {
    const { data } = await this.userClient.from("media_assets")
      .select("id, bucket, storage_path, sensitivity, mime_type, deleted_at").eq("id", assetId).maybeSingle();
    if (!data || data.deleted_at) return null;
    return { id: data.id, bucket: data.bucket, storagePath: data.storage_path, sensitivity: data.sensitivity, mimeType: data.mime_type };
  }

  async createSignedUrl(bucket: string, path: string, seconds: number) {
    const { data } = await this.adminClient.storage.from(bucket).createSignedUrl(path, seconds);
    return data?.signedUrl ?? null;
  }

  async reserveJob(input: Parameters<GenerationRepository["reserveJob"]>[0]) {
    const { data, error } = await this.adminClient.rpc("reserve_generation_job", {
      p_user_id: input.userId, p_content_id: input.contentId, p_provider: input.provider, p_model: input.model,
      p_prompt: input.prompt, p_settings: input.settings as Json, p_image_count: input.imageCount,
      p_estimated_cost: input.estimatedCost, p_parent_job_id: input.parentJobId,
    });
    if (error || !data?.[0]) throw new Error(error?.message ?? "RESERVE_FAILED");
    return data[0].job_id;
  }

  async getJob(jobId: string) {
    // Visibilidade verificada com o cliente do usuário; nenhum job fora do alcance do usuário é processado.
    const { data } = await this.userClient.from("generation_jobs").select(jobColumns).eq("id", jobId).maybeSingle();
    return data ? toJobRecord(data) : null;
  }

  async updateJob(jobId: string, patch: Parameters<GenerationRepository["updateJob"]>[1]) {
    const update: Database["public"]["Tables"]["generation_jobs"]["Update"] = {};
    if (patch.status) update.status = patch.status;
    if (patch.externalRequestId !== undefined) update.external_request_id = patch.externalRequestId;
    if (patch.errorMessage !== undefined) update.error_message = patch.errorMessage;
    if (patch.actualCost !== undefined) update.actual_cost = patch.actualCost;
    if (patch.completedAt !== undefined) update.completed_at = patch.completedAt;
    if (patch.settings !== undefined) update.settings = patch.settings as Json;
    const { error } = await this.adminClient.from("generation_jobs").update(update).eq("id", jobId);
    if (error) throw new Error("JOB_UPDATE_FAILED");
  }

  async claimFinalize(jobId: string) {
    const staleBefore = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data } = await this.adminClient.from("generation_jobs").update({ finalizing_at: new Date().toISOString() })
      .eq("id", jobId).eq("status", "processing").or(`finalizing_at.is.null,finalizing_at.lt.${staleBefore}`).select("id");
    return Boolean(data?.length);
  }

  async releaseFinalize(jobId: string) {
    await this.adminClient.from("generation_jobs").update({ finalizing_at: null }).eq("id", jobId);
  }

  async countJobImages(jobId: string) {
    const { count } = await this.adminClient.from("media_assets").select("id", { count: "exact", head: true }).eq("generation_job_id", jobId);
    return count ?? 0;
  }

  async storeGeneratedImage({ job, bytes, info, index }: Parameters<GenerationRepository["storeGeneratedImage"]>[0]) {
    const path = `${job.createdBy}/${job.contentId}/${job.id}-${index + 1}.${info.extension}`;
    const upload = await this.adminClient.storage.from("ai-generated").upload(path, bytes, { contentType: info.mimeType, upsert: true });
    if (upload.error) throw new Error("STORAGE_UPLOAD_FAILED");
    const { data, error } = await this.adminClient.from("media_assets").upsert({
      content_id: job.contentId, storage_path: path, file_name: `ia-${job.id.slice(0, 8)}-${index + 1}.${info.extension}`,
      mime_type: info.mimeType, created_by: job.createdBy, bucket: "ai-generated", source: "ai_generation",
      generation_job_id: job.id, width: info.width, height: info.height, size_bytes: bytes.byteLength, in_library: false, sensitivity: "internal",
    }, { onConflict: "storage_path" }).select("id").single();
    if (error || !data) throw new Error("MEDIA_ASSET_FAILED");
    return { assetId: data.id, storagePath: path };
  }

  async audit(actorId: string, action: string, entityId: string, metadata: Record<string, unknown>) {
    await this.adminClient.from("audit_logs").insert({ actor_id: actorId, action, entity_type: "generation_jobs", entity_id: entityId, metadata: metadata as Json });
  }
}

export async function loadAiConfiguration(client: Client) {
  const [{ data: modelRows }, { data: settings }] = await Promise.all([
    client.from("ai_models").select("id, is_enabled, estimated_cost_per_image, cost_currency"),
    client.from("ai_settings").select("integration_enabled, default_max_requests, period_days, allow_restricted_references").maybeSingle(),
  ]);
  return {
    models: mergeCatalog(modelRows ?? []),
    integrationEnabled: settings?.integration_enabled ?? false,
    allowRestrictedReferences: settings?.allow_restricted_references ?? false,
    defaultMaxRequests: settings?.default_max_requests ?? 0,
    periodDays: settings?.period_days ?? 30,
  };
}
