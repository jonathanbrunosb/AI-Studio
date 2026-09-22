export const generationStatuses = ["pending", "processing", "completed", "failed", "canceled"] as const;
export type GenerationStatus = (typeof generationStatuses)[number];

export const statusLabels: Record<GenerationStatus, string> = {
  pending: "Na fila",
  processing: "Processando",
  completed: "Concluída",
  failed: "Falhou",
  canceled: "Cancelada",
};

export function isTerminal(status: GenerationStatus) {
  return status === "completed" || status === "failed" || status === "canceled";
}

/** Tempo máximo em que o navegador acompanha uma solicitação antes de interromper o polling local. */
export const CLIENT_TRACKING_TIMEOUT_MS = 5 * 60 * 1000;
export const CLIENT_POLL_INTERVAL_MS = 3000;
