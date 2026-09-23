import { z } from "zod";
import type { AvailableModel } from "../models/model-types";

export const generationRequestSchema = z.object({
  contentId: z.string().uuid(),
  modelId: z.string().min(3).max(120),
  prompt: z.string().trim().min(10, "Descreva a imagem com pelo menos 10 caracteres.").max(1500, "O prompt deve ter até 1.500 caracteres."),
  presetId: z.enum(["comunicado", "newsletter", "sistemas", "campanha"]).nullable().optional(),
  aspectRatio: z.enum(["1:1", "16:9", "9:16", "4:3", "3:4"]).optional(),
  resolution: z.enum(["standard", "high"]).optional(),
  imageCount: z.number().int().min(1).max(8),
  referenceAssetId: z.string().uuid().nullable().optional(),
  referenceAuthorized: z.boolean().optional(),
  parentJobId: z.string().uuid().nullable().optional(),
});

export type GenerationRequest = z.infer<typeof generationRequestSchema>;

export type ValidatedGeneration = GenerationRequest & { aspectRatio: NonNullable<GenerationRequest["aspectRatio"]>; resolution: NonNullable<GenerationRequest["resolution"]> };

/** Valida a solicitação contra as capacidades reais do modelo, sem enviar parâmetros não suportados. */
export function validateAgainstModel(request: GenerationRequest, model: AvailableModel | null): { ok: true; value: ValidatedGeneration } | { ok: false; error: string } {
  if (!model || !model.isEnabled) return { ok: false, error: "Modelo indisponível. Selecione outro modelo habilitado." };
  const caps = model.capabilities;
  if (request.imageCount > caps.maxImages) return { ok: false, error: `Este modelo gera no máximo ${caps.maxImages} imagem(ns) por solicitação.` };
  if (request.referenceAssetId && !caps.supportsReference) return { ok: false, error: "O modelo selecionado não aceita imagem de referência." };
  if (caps.requiresReference && !request.referenceAssetId) return { ok: false, error: "Selecione uma imagem de referência para este modelo." };
  if (request.referenceAssetId && !request.referenceAuthorized) return { ok: false, error: "Confirme que você possui autorização para usar a imagem de referência." };
  let aspectRatio = request.aspectRatio ?? caps.aspectRatios[0] ?? "1:1";
  let resolution = request.resolution ?? caps.resolutions[0] ?? "standard";
  if (!caps.sizeFromReference) {
    if (!caps.aspectRatios.includes(aspectRatio)) return { ok: false, error: "Proporção não suportada pelo modelo." };
    if (!caps.resolutions.includes(resolution)) return { ok: false, error: "Resolução não suportada pelo modelo." };
  } else {
    aspectRatio = "1:1"; resolution = "standard";
  }
  return { ok: true, value: { ...request, aspectRatio, resolution } };
}

export const blockedSensitivities = new Set(["restricted", "confidential"]);

export function referenceAllowed(sensitivity: string, allowRestricted: boolean) {
  return allowRestricted || !blockedSensitivities.has(sensitivity);
}
