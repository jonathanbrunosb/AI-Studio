import type { AspectRatio, ModelDefinition, ResolutionId } from "../models/model-types";

export type ProviderSubmitRequest = {
  model: ModelDefinition;
  prompt: string;
  aspectRatio: AspectRatio;
  resolution: ResolutionId;
  imageCount: number;
  /** URL temporária (assinada) para a referência visual, quando suportada. */
  referenceImageUrl?: string;
};

/** Dados necessários para acompanhar uma solicitação. Não pode conter credenciais. */
export type ProviderRequestRef = {
  externalId: string;
  modelId: string;
  statusUrl?: string;
  responseUrl?: string;
  cancelUrl?: string;
};

export type ProviderStatus =
  | { state: "pending"; queuePosition?: number }
  | { state: "processing" }
  | { state: "completed" }
  | { state: "failed"; error: string };

export type ProviderImage = { url: string; width?: number; height?: number; contentType?: string };
export type ProviderResult = { images: ProviderImage[]; actualCost: number | null };
export type CancelOutcome = "canceled" | "not_cancelable" | "unsupported";

export type ProviderErrorCode = "not_configured" | "invalid_credentials" | "rate_limited" | "invalid_request" | "provider_error" | "network_error";

export class ProviderError extends Error {
  constructor(public readonly code: ProviderErrorCode, message: string, public readonly httpStatus?: number) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface ImageGenerationProvider {
  readonly id: string;
  readonly name: string;
  readonly supportsCancel: boolean;
  isConfigured(): boolean;
  submit(request: ProviderSubmitRequest): Promise<ProviderRequestRef>;
  getStatus(ref: ProviderRequestRef): Promise<ProviderStatus>;
  getResult(ref: ProviderRequestRef): Promise<ProviderResult>;
  cancel(ref: ProviderRequestRef): Promise<CancelOutcome>;
}
