import { getProvider } from "./provider-registry";

/** Provedor ativo da primeira versão. Alterável por AI_IMAGE_PROVIDER quando novos provedores forem registrados. */
export const SELECTED_PROVIDER_ID = process.env.AI_IMAGE_PROVIDER || "fal";

export function getSelectedProvider() {
  return getProvider(SELECTED_PROVIDER_ID);
}

export function getProviderConfigurationStatus() {
  const provider = getSelectedProvider();
  return {
    providerId: SELECTED_PROVIDER_ID,
    providerName: provider?.name ?? SELECTED_PROVIDER_ID,
    configured: Boolean(provider?.isConfigured()),
    requiredEnv: SELECTED_PROVIDER_ID === "fal" ? ["FAL_KEY"] : [],
    serviceRoleConfigured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  };
}
