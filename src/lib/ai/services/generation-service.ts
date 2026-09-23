import { errorName, log } from "@/lib/observability/logger";
import { getModelDefinition } from "../models/model-catalog";
import type { AvailableModel } from "../models/model-types";
import { buildFinalPrompt } from "../prompts/prompt-builder";
import { ProviderError, type ImageGenerationProvider, type ProviderRequestRef } from "../providers/provider.interface";
import { estimateCost } from "../utils/cost-calculator";
import { generatedMaxBytes, inspectImage, isAllowedResultUrl, type ImageInfo } from "../utils/image-processing";
import { isTerminal, type GenerationStatus } from "./generation-status";
import { referenceAllowed, validateAgainstModel, type GenerationRequest } from "./generation-validation";

export type GenerationErrorCode =
  | "not_configured" | "disabled" | "invalid_request" | "forbidden" | "model_unavailable" | "quota_exceeded"
  | "reference_blocked" | "invalid_credentials" | "provider_error" | "storage_error" | "not_found";

export class GenerationError extends Error {
  constructor(public readonly code: GenerationErrorCode, message: string) {
    super(message);
    this.name = "GenerationError";
  }
}

export type JobRecord = {
  id: string;
  contentId: string;
  createdBy: string;
  provider: string;
  model: string;
  prompt: string;
  status: GenerationStatus;
  settings: Record<string, unknown>;
  externalRequestId: string | null;
  errorMessage: string | null;
  imageCount: number;
  estimatedCost: number | null;
  actualCost: number | null;
  createdAt: string;
  completedAt: string | null;
};

export type StoredImage = { assetId: string; storagePath: string };

export interface GenerationRepository {
  canEditContent(contentId: string): Promise<boolean>;
  getReferenceAsset(assetId: string): Promise<{ id: string; bucket: string; storagePath: string; sensitivity: string; mimeType: string | null } | null>;
  createSignedUrl(bucket: string, path: string, seconds: number): Promise<string | null>;
  reserveJob(input: { userId: string; contentId: string; provider: string; model: string; prompt: string; settings: Record<string, unknown>; imageCount: number; estimatedCost: number | null; parentJobId: string | null }): Promise<string>;
  getJob(jobId: string): Promise<JobRecord | null>;
  updateJob(jobId: string, patch: Partial<Pick<JobRecord, "status" | "externalRequestId" | "errorMessage" | "actualCost" | "completedAt" | "settings">>): Promise<void>;
  claimFinalize(jobId: string): Promise<boolean>;
  releaseFinalize(jobId: string): Promise<void>;
  countJobImages(jobId: string): Promise<number>;
  storeGeneratedImage(input: { job: JobRecord; bytes: Uint8Array; info: ImageInfo; index: number }): Promise<StoredImage>;
  audit(actorId: string, action: string, entityId: string, metadata: Record<string, unknown>): Promise<void>;
}

export type GenerationDeps = {
  repo: GenerationRepository;
  provider: ImageGenerationProvider | null;
  models: AvailableModel[];
  integrationEnabled: boolean;
  allowRestrictedReferences: boolean;
  fetchImpl?: typeof fetch;
};

export type UserContext = { userId: string; canGenerate: boolean };

function refFromJob(job: JobRecord): ProviderRequestRef {
  const tracking = (job.settings.tracking ?? {}) as Record<string, string | undefined>;
  return { externalId: job.externalRequestId ?? "", modelId: job.model, statusUrl: tracking.statusUrl, responseUrl: tracking.responseUrl, cancelUrl: tracking.cancelUrl };
}

function providerFailure(error: unknown) {
  if (error instanceof ProviderError) {
    if (error.code === "not_configured") return new GenerationError("not_configured", "A integração de IA está indisponível. Solicite ao administrador a configuração do provedor.");
    if (error.code === "invalid_credentials") return new GenerationError("invalid_credentials", "A integração de IA está com a credencial inválida. O administrador foi orientado a revisá-la.");
    if (error.code === "invalid_request") return new GenerationError("invalid_request", error.message);
    return new GenerationError("provider_error", error.message);
  }
  return new GenerationError("provider_error", "Falha inesperada ao comunicar com o provedor de IA.");
}

export async function submitGeneration(user: UserContext, request: GenerationRequest, deps: GenerationDeps) {
  if (!user.canGenerate) throw new GenerationError("forbidden", "Seu perfil não permite gerar imagens.");
  if (!deps.integrationEnabled) throw new GenerationError("disabled", "A geração com IA foi desabilitada pelo administrador.");
  if (!deps.provider || !deps.provider.isConfigured()) throw new GenerationError("not_configured", "A integração de IA está indisponível. Solicite ao administrador a configuração do provedor.");

  const model = deps.models.find((item) => item.id === request.modelId) ?? null;
  const validation = validateAgainstModel(request, model);
  if (!validation.ok) throw new GenerationError(model?.isEnabled ? "invalid_request" : "model_unavailable", validation.error);
  const value = validation.value;
  const definition = getModelDefinition(value.modelId)!;
  if (definition.providerId !== deps.provider.id) throw new GenerationError("model_unavailable", "Modelo indisponível para o provedor configurado.");

  if (!(await deps.repo.canEditContent(value.contentId))) throw new GenerationError("forbidden", "Este conteúdo não está disponível para edição.");

  let referenceImageUrl: string | undefined;
  if (value.referenceAssetId) {
    const reference = await deps.repo.getReferenceAsset(value.referenceAssetId);
    if (!reference) throw new GenerationError("not_found", "Imagem de referência não encontrada.");
    if (!referenceAllowed(reference.sensitivity, deps.allowRestrictedReferences)) {
      throw new GenerationError("reference_blocked", "Imagens classificadas como restritas ou confidenciais não podem ser enviadas ao provedor externo sem autorização expressa.");
    }
    referenceImageUrl = await deps.repo.createSignedUrl(reference.bucket, reference.storagePath, 600) ?? undefined;
    if (!referenceImageUrl) throw new GenerationError("storage_error", "Não foi possível disponibilizar a imagem de referência.");
  }

  const finalPrompt = buildFinalPrompt(value.prompt, value.presetId);
  const settings: Record<string, unknown> = {
    userPrompt: value.prompt,
    presetId: value.presetId ?? null,
    aspectRatio: definition.capabilities.sizeFromReference ? null : value.aspectRatio,
    resolution: definition.capabilities.sizeFromReference ? null : value.resolution,
    referenceAssetId: value.referenceAssetId ?? null,
  };

  let jobId: string;
  try {
    jobId = await deps.repo.reserveJob({
      userId: user.userId, contentId: value.contentId, provider: deps.provider.id, model: value.modelId, prompt: finalPrompt,
      settings, imageCount: value.imageCount, estimatedCost: estimateCost(model!.estimatedCostPerImage, value.imageCount), parentJobId: value.parentJobId ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("QUOTA_EXCEEDED")) throw new GenerationError("quota_exceeded", "Você atingiu o limite de gerações do período. Procure o administrador para ampliar a cota.");
    if (message.includes("MODEL_DISABLED")) throw new GenerationError("model_unavailable", "Modelo indisponível. Selecione outro modelo habilitado.");
    if (message.includes("AI_DISABLED")) throw new GenerationError("disabled", "A geração com IA foi desabilitada pelo administrador.");
    if (message.includes("USER_INACTIVE")) throw new GenerationError("forbidden", "Usuários inativos não podem utilizar os recursos de IA.");
    throw new GenerationError("provider_error", "Não foi possível registrar a solicitação.");
  }

  try {
    const ref = await deps.provider.submit({ model: definition, prompt: finalPrompt, aspectRatio: value.aspectRatio, resolution: value.resolution, imageCount: value.imageCount, referenceImageUrl });
    await deps.repo.updateJob(jobId, {
      status: "processing",
      externalRequestId: ref.externalId,
      settings: { ...settings, tracking: { statusUrl: ref.statusUrl, responseUrl: ref.responseUrl, cancelUrl: ref.cancelUrl } },
    });
  } catch (error) {
    const failure = providerFailure(error);
    await deps.repo.updateJob(jobId, { status: "failed", errorMessage: failure.message, completedAt: new Date().toISOString() });
    await deps.repo.audit(user.userId, "ai_generation.failed", jobId, { code: failure.code });
    throw failure;
  }
  return jobId;
}

async function downloadImage(url: string, fetchImpl: typeof fetch) {
  if (!isAllowedResultUrl(url)) throw new GenerationError("provider_error", "O provedor retornou um endereço de resultado não permitido.");
  const response = await fetchImpl(url, { signal: AbortSignal.timeout(30_000), cache: "no-store" });
  if (!response.ok) throw new GenerationError("provider_error", "Não foi possível recuperar a imagem gerada.");
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > generatedMaxBytes) throw new GenerationError("provider_error", "A imagem gerada excede o tamanho permitido.");
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > generatedMaxBytes) throw new GenerationError("provider_error", "A imagem gerada excede o tamanho permitido.");
  const info = inspectImage(bytes);
  if (!info) throw new GenerationError("provider_error", "O arquivo retornado não é uma imagem válida.");
  return { bytes, info };
}

/** Consulta o provedor e, ao concluir, recupera, valida e persiste o resultado na infraestrutura própria. */
export async function refreshGeneration(jobId: string, deps: GenerationDeps): Promise<JobRecord> {
  const job = await deps.repo.getJob(jobId);
  if (!job) throw new GenerationError("not_found", "Solicitação não encontrada.");
  if (isTerminal(job.status) || !job.externalRequestId) return job;
  if (!deps.provider || deps.provider.id !== job.provider) throw new GenerationError("not_configured", "O provedor desta solicitação não está disponível.");

  const ref = refFromJob(job);
  let status;
  try {
    status = await deps.provider.getStatus(ref);
  } catch (error) {
    const failure = providerFailure(error);
    if (failure.code === "invalid_credentials" || failure.code === "not_configured") throw failure;
    log("warn", "ai.provider_transient", { jobId: job.id, code: failure.code, error: errorName(error), detail: error instanceof ProviderError ? error.message : undefined });
    return job; // Falhas transitórias preservam o estado; o acompanhamento tenta novamente.
  }

  if (status.state === "pending" || status.state === "processing") {
    if (job.status !== "processing") await deps.repo.updateJob(job.id, { status: "processing" });
    return { ...job, status: "processing" };
  }
  if (status.state === "failed") {
    const patch = { status: "failed" as const, errorMessage: status.error, completedAt: new Date().toISOString() };
    await deps.repo.updateJob(job.id, patch);
    await deps.repo.audit(job.createdBy, "ai_generation.failed", job.id, { model: job.model });
    return { ...job, ...patch };
  }

  if (!(await deps.repo.claimFinalize(job.id))) return job; // outra requisição já está persistindo o resultado
  try {
    const result = await deps.provider.getResult(ref);
    if (!result.images.length) {
      const patch = { status: "failed" as const, errorMessage: "O provedor não retornou imagens (possível bloqueio pelo filtro de segurança).", completedAt: new Date().toISOString() };
      await deps.repo.updateJob(job.id, patch);
      return { ...job, ...patch };
    }
    const already = await deps.repo.countJobImages(job.id);
    const fetchImpl = deps.fetchImpl ?? fetch;
    for (let index = already; index < result.images.length; index += 1) {
      const { bytes, info } = await downloadImage(result.images[index].url, fetchImpl);
      try {
        await deps.repo.storeGeneratedImage({ job, bytes, info, index });
      } catch {
        throw new GenerationError("storage_error", "A imagem foi gerada, mas não pôde ser armazenada. Uma nova tentativa será feita automaticamente.");
      }
    }
    const patch = { status: "completed" as const, completedAt: new Date().toISOString(), actualCost: result.actualCost, errorMessage: null };
    await deps.repo.updateJob(job.id, patch);
    await deps.repo.audit(job.createdBy, "ai_generation.completed", job.id, { model: job.model, images: result.images.length });
    return { ...job, ...patch };
  } catch (error) {
    await deps.repo.releaseFinalize(job.id);
    const failure = error instanceof GenerationError ? error : providerFailure(error);
    log("error", "ai.finalize_failed", { jobId: job.id, code: failure.code });
    await deps.repo.updateJob(job.id, { errorMessage: failure.message });
    return { ...job, errorMessage: failure.message };
  }
}

export async function cancelGeneration(jobId: string, actorId: string, deps: GenerationDeps) {
  const job = await deps.repo.getJob(jobId);
  if (!job) throw new GenerationError("not_found", "Solicitação não encontrada.");
  if (job.createdBy !== actorId) throw new GenerationError("forbidden", "Somente o solicitante pode cancelar a geração.");
  if (isTerminal(job.status)) return { canceled: false, message: "A solicitação já foi finalizada." };
  if (!deps.provider?.supportsCancel || !job.externalRequestId) return { canceled: false, message: "O provedor não permite cancelar esta solicitação." };
  try {
    const outcome = await deps.provider.cancel(refFromJob(job));
    if (outcome !== "canceled") return { canceled: false, message: "A geração já está em andamento no provedor e não pode mais ser cancelada." };
  } catch (error) {
    throw providerFailure(error);
  }
  await deps.repo.updateJob(job.id, { status: "canceled", completedAt: new Date().toISOString() });
  await deps.repo.audit(actorId, "ai_generation.canceled", job.id, { model: job.model });
  return { canceled: true, message: "Cancelamento confirmado pelo provedor." };
}
