import { dimensionsFor } from "../utils/image-processing";
import { e2eFalBaseUrl } from "./test-mode";
import {
  ProviderError, type CancelOutcome, type ImageGenerationProvider, type ProviderRequestRef,
  type ProviderResult, type ProviderStatus, type ProviderSubmitRequest,
} from "./provider.interface";

/**
 * Integração com a Queue API oficial do fal.ai (https://docs.fal.ai/model-endpoints/queue).
 * Autenticação: cabeçalho `Authorization: Key <FAL_KEY>`, somente no servidor.
 */
const QUEUE_BASE = "https://queue.fal.run";
const allowedApiHosts = ["queue.fal.run"];
const queueBase = () => e2eFalBaseUrl() ?? QUEUE_BASE;

type FetchLike = typeof fetch;

export type FalProviderOptions = { apiKey?: string; fetchImpl?: FetchLike; timeoutMs?: number };

export function isAllowedFalHost(rawUrl: string, hosts = allowedApiHosts) {
  try {
    const url = new URL(rawUrl);
    const testBase = e2eFalBaseUrl();
    if (testBase && url.origin === testBase) return true;
    return url.protocol === "https:" && hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

export class FalImageProvider implements ImageGenerationProvider {
  readonly id = "fal";
  readonly name = "fal.ai";
  readonly supportsCancel = true;
  private readonly apiKey?: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(options: FalProviderOptions = {}) {
    this.apiKey = options.apiKey ?? process.env.FAL_KEY;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  isConfigured() {
    return Boolean(this.apiKey && this.apiKey.trim().length > 8);
  }

  buildInput(request: ProviderSubmitRequest) {
    const input: Record<string, unknown> = {
      prompt: request.prompt,
      num_images: request.imageCount,
      enable_safety_checker: true,
      output_format: "png",
    };
    if (request.model.capabilities.sizeFromReference) {
      if (!request.referenceImageUrl) throw new ProviderError("invalid_request", "Este modelo exige uma imagem de referência.");
      input.image_url = request.referenceImageUrl;
    } else {
      input.image_size = dimensionsFor(request.aspectRatio, request.resolution);
    }
    return input;
  }

  async submit(request: ProviderSubmitRequest): Promise<ProviderRequestRef> {
    const body = await this.call(`${queueBase()}/${request.model.id}`, { method: "POST", body: JSON.stringify(this.buildInput(request)) });
    const data = body as { request_id?: string; status_url?: string; response_url?: string; cancel_url?: string };
    if (!data.request_id) throw new ProviderError("provider_error", "O provedor não retornou o identificador da solicitação.");
    return {
      externalId: data.request_id,
      modelId: request.model.id,
      statusUrl: data.status_url,
      responseUrl: data.response_url,
      cancelUrl: data.cancel_url,
    };
  }

  async getStatus(ref: ProviderRequestRef): Promise<ProviderStatus> {
    const data = await this.call(this.url(ref, "status"), { method: "GET" }) as { status?: string; queue_position?: number; error?: string };
    switch (data.status) {
      case "IN_QUEUE": return { state: "pending", queuePosition: data.queue_position };
      case "IN_PROGRESS": return { state: "processing" };
      case "COMPLETED": return data.error ? { state: "failed", error: "O provedor informou falha na geração." } : { state: "completed" };
      default: return { state: "failed", error: "Status desconhecido informado pelo provedor." };
    }
  }

  async getResult(ref: ProviderRequestRef): Promise<ProviderResult> {
    const data = await this.call(this.url(ref, "response"), { method: "GET" }) as { images?: Array<{ url?: string; width?: number; height?: number; content_type?: string }> };
    const images = (data.images ?? [])
      .filter((image): image is { url: string; width?: number; height?: number; content_type?: string } => typeof image.url === "string")
      .map((image) => ({ url: image.url, width: image.width, height: image.height, contentType: image.content_type }));
    // A Queue API não informa o valor cobrado por solicitação; o custo efetivo permanece indisponível.
    return { images, actualCost: null };
  }

  async cancel(ref: ProviderRequestRef): Promise<CancelOutcome> {
    const response = await this.raw(this.url(ref, "cancel"), { method: "PUT" });
    if (response.status === 202) return "canceled";
    if (response.status === 400 || response.status === 404 || response.status === 409) return "not_cancelable";
    throw this.errorFor(response.status);
  }

  private url(ref: ProviderRequestRef, kind: "status" | "response" | "cancel") {
    const given = kind === "status" ? ref.statusUrl : kind === "response" ? ref.responseUrl : ref.cancelUrl;
    if (given && isAllowedFalHost(given)) return given;
    // Fallback documentado: rotas de status usam o id do app (owner/app), sem subcaminho.
    const appId = ref.modelId.split("/").slice(0, 2).join("/");
    const base = `${queueBase()}/${appId}/requests/${encodeURIComponent(ref.externalId)}`;
    return kind === "status" ? `${base}/status` : kind === "cancel" ? `${base}/cancel` : base;
  }

  private async raw(url: string, init: RequestInit) {
    if (!this.isConfigured()) throw new ProviderError("not_configured", "Provedor de IA não configurado.");
    if (!isAllowedFalHost(url)) throw new ProviderError("invalid_request", "Endereço do provedor não permitido.");
    try {
      return await this.fetchImpl(url, {
        ...init,
        headers: { Authorization: `Key ${this.apiKey}`, "Content-Type": "application/json", Accept: "application/json" },
        signal: AbortSignal.timeout(this.timeoutMs),
        cache: "no-store",
      });
    } catch {
      throw new ProviderError("network_error", "Não foi possível comunicar com o provedor de IA.");
    }
  }

  private async call(url: string, init: RequestInit) {
    const response = await this.raw(url, init);
    if (!response.ok) throw this.errorFor(response.status);
    try {
      return await response.json() as unknown;
    } catch {
      throw new ProviderError("provider_error", "Resposta inválida do provedor de IA.");
    }
  }

  private errorFor(status: number) {
    if (status === 401 || status === 403) return new ProviderError("invalid_credentials", "Credencial do provedor de IA inválida ou sem permissão.", status);
    if (status === 429) return new ProviderError("rate_limited", "Limite de requisições do provedor atingido. Tente novamente em instantes.", status);
    if (status === 400 || status === 422) return new ProviderError("invalid_request", "Parâmetros recusados pelo provedor de IA.", status);
    return new ProviderError("provider_error", "O provedor de IA não concluiu a operação.", status);
  }
}
