/** Estimativa simples: custo por imagem × quantidade. Retorna null quando não há valor de referência. */
export function estimateCost(costPerImage: number | null, imageCount: number) {
  if (costPerImage === null || !Number.isFinite(costPerImage)) return null;
  return Math.round(costPerImage * imageCount * 10000) / 10000;
}

export function formatCost(value: number | string | null | undefined, currency = "USD") {
  if (value === null || value === undefined || value === "") return "Indisponível";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Indisponível";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(number);
}
