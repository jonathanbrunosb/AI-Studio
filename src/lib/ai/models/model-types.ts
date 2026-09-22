export type AspectRatio = "1:1" | "16:9" | "9:16" | "4:3" | "3:4";
export type ResolutionId = "standard" | "high";

export type ModelCapabilities = {
  aspectRatios: AspectRatio[];
  resolutions: ResolutionId[];
  maxImages: number;
  supportsReference: boolean;
  requiresReference: boolean;
  /** Quando verdadeiro, proporção e resolução seguem a imagem de referência e não são enviadas ao provedor. */
  sizeFromReference: boolean;
  referenceMimeTypes: string[];
  referenceMaxBytes: number;
};

export type ModelDefinition = {
  id: string;
  providerId: string;
  name: string;
  description: string;
  kind: "image";
  capabilities: ModelCapabilities;
  /** Valor de referência (USD por imagem ≈1 MP). O valor administrado no banco prevalece. */
  referenceCostPerImage: number | null;
};

/** Modelo do catálogo combinado com a configuração administrativa (tabela ai_models). */
export type AvailableModel = ModelDefinition & {
  isEnabled: boolean;
  estimatedCostPerImage: number | null;
  costCurrency: string;
};

export const resolutionLabels: Record<ResolutionId, string> = {
  standard: "Padrão (≈1 MP)",
  high: "Alta (≈2 MP)",
};

export const aspectRatioLabels: Record<AspectRatio, string> = {
  "1:1": "Quadrado · 1:1",
  "16:9": "Horizontal · 16:9",
  "9:16": "Vertical · 9:16",
  "4:3": "Paisagem · 4:3",
  "3:4": "Retrato · 3:4",
};
