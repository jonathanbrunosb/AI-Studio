import type { AvailableModel, ModelDefinition } from "./model-types";

const imageMimeTypes = ["image/png", "image/jpeg", "image/webp"];
const allRatios: ModelDefinition["capabilities"]["aspectRatios"] = ["1:1", "16:9", "9:16", "4:3", "3:4"];

/**
 * Catálogo dos modelos com integração efetivamente implementada.
 * Incluir aqui somente modelos cujo contrato de API foi validado na documentação oficial do provedor.
 */
export const modelCatalog: readonly ModelDefinition[] = [
  {
    id: "fal-ai/flux/schnell",
    providerId: "fal",
    name: "FLUX.1 [schnell]",
    description: "Geração rápida e de baixo custo, indicada para rascunhos e fundos.",
    kind: "image",
    capabilities: { aspectRatios: allRatios, resolutions: ["standard", "high"], maxImages: 4, supportsReference: false, requiresReference: false, sizeFromReference: false, referenceMimeTypes: [], referenceMaxBytes: 0 },
    referenceCostPerImage: 0.003,
  },
  {
    id: "fal-ai/flux/dev",
    providerId: "fal",
    name: "FLUX.1 [dev]",
    description: "Maior fidelidade ao prompt e acabamento superior para peças finais.",
    kind: "image",
    capabilities: { aspectRatios: allRatios, resolutions: ["standard", "high"], maxImages: 4, supportsReference: false, requiresReference: false, sizeFromReference: false, referenceMimeTypes: [], referenceMaxBytes: 0 },
    referenceCostPerImage: 0.025,
  },
  {
    id: "fal-ai/flux/dev/image-to-image",
    providerId: "fal",
    name: "FLUX.1 [dev] · Imagem de referência",
    description: "Cria variações a partir de uma imagem de referência autorizada.",
    kind: "image",
    capabilities: { aspectRatios: [], resolutions: [], maxImages: 4, supportsReference: true, requiresReference: true, sizeFromReference: true, referenceMimeTypes: imageMimeTypes, referenceMaxBytes: 10 * 1024 * 1024 },
    referenceCostPerImage: 0.03,
  },
];

export function getModelDefinition(id: string) {
  return modelCatalog.find((model) => model.id === id) ?? null;
}

export type ModelSettingRow = { id: string; is_enabled: boolean; estimated_cost_per_image: number | string | null; cost_currency: string };

/** Combina o catálogo com a configuração do banco. Modelos sem registro no banco ficam desabilitados. */
export function mergeCatalog(rows: ModelSettingRow[]): AvailableModel[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return modelCatalog.map((model) => {
    const row = byId.get(model.id);
    const cost = row?.estimated_cost_per_image;
    return {
      ...model,
      isEnabled: Boolean(row?.is_enabled),
      estimatedCostPerImage: cost === null || cost === undefined ? null : Number(cost),
      costCurrency: row?.cost_currency ?? "USD",
    };
  });
}

export function listEnabledModels(rows: ModelSettingRow[]) {
  return mergeCatalog(rows).filter((model) => model.isEnabled);
}
