import type { MediaAsset } from "@/lib/editor/editor-types";
import { getModelDefinition } from "../models/model-catalog";
import type { GenerationStatus } from "./generation-status";
import type { JobRecord } from "./generation-service";

export type GenerationJobView = {
  id: string;
  status: GenerationStatus;
  modelId: string;
  modelName: string;
  userPrompt: string;
  presetId: string | null;
  aspectRatio: string | null;
  resolution: string | null;
  imageCount: number;
  referenceAssetId: string | null;
  errorMessage: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  createdAt: string;
  completedAt: string | null;
  images: (MediaAsset & { inLibrary: boolean })[];
};

export function toJobView(job: JobRecord, images: GenerationJobView["images"]): GenerationJobView {
  const settings = job.settings;
  return {
    id: job.id, status: job.status, modelId: job.model, modelName: getModelDefinition(job.model)?.name ?? job.model,
    userPrompt: typeof settings.userPrompt === "string" ? settings.userPrompt : job.prompt,
    presetId: typeof settings.presetId === "string" ? settings.presetId : null,
    aspectRatio: typeof settings.aspectRatio === "string" ? settings.aspectRatio : null,
    resolution: typeof settings.resolution === "string" ? settings.resolution : null,
    imageCount: job.imageCount,
    referenceAssetId: typeof settings.referenceAssetId === "string" ? settings.referenceAssetId : null,
    errorMessage: job.errorMessage, estimatedCost: job.estimatedCost, actualCost: job.actualCost,
    createdAt: job.createdAt, completedAt: job.completedAt, images,
  };
}
