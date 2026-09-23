import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { jobColumns, toJobRecord } from "../repository/supabase-generation-repository";
import type { JobRecord } from "./generation-service";
import { toJobView, type GenerationJobView } from "./job-view";

type Client = SupabaseClient<Database>;

/** Carrega imagens dos jobs com URLs assinadas pelo cliente do usuário (respeita RLS do Storage). */
export async function buildJobViews(client: Client, jobs: JobRecord[]): Promise<GenerationJobView[]> {
  if (!jobs.length) return [];
  const { data: assets } = await client.from("media_assets")
    .select("id, file_name, storage_path, mime_type, bucket, generation_job_id, in_library, width, height")
    .in("generation_job_id", jobs.map((job) => job.id)).is("deleted_at", null).order("storage_path");
  const byJob = new Map<string, GenerationJobView["images"]>();
  for (const asset of assets ?? []) {
    const signed = await client.storage.from(asset.bucket).createSignedUrl(asset.storage_path, 3600);
    if (!signed.data?.signedUrl || !asset.generation_job_id) continue;
    const list = byJob.get(asset.generation_job_id) ?? [];
    list.push({ id: asset.id, fileName: asset.file_name, storagePath: asset.storage_path, mimeType: asset.mime_type, bucket: asset.bucket, signedUrl: signed.data.signedUrl, inLibrary: asset.in_library, width: asset.width, height: asset.height });
    byJob.set(asset.generation_job_id, list);
  }
  return jobs.map((job) => toJobView(job, byJob.get(job.id) ?? []));
}

export async function listContentJobs(client: Client, contentId: string, limit = 20) {
  const { data } = await client.from("generation_jobs").select(jobColumns).eq("content_id", contentId)
    .order("created_at", { ascending: false }).limit(limit);
  return buildJobViews(client, (data ?? []).map(toJobRecord));
}
