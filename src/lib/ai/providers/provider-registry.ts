import { FalImageProvider } from "./fal-provider";
import type { ImageGenerationProvider } from "./provider.interface";

type Factory = () => ImageGenerationProvider;

const factories = new Map<string, Factory>([["fal", () => new FalImageProvider()]]);
const overrides = new Map<string, ImageGenerationProvider>();

export function registerProvider(id: string, factory: Factory) {
  factories.set(id, factory);
}

/** Permite injetar mocks em testes automatizados sem consumir créditos reais. */
export function setProviderOverride(id: string, provider: ImageGenerationProvider | null) {
  if (provider) overrides.set(id, provider); else overrides.delete(id);
}

export function getProvider(id: string): ImageGenerationProvider | null {
  return overrides.get(id) ?? factories.get(id)?.() ?? null;
}

export function listProviderIds() {
  return [...factories.keys()];
}
