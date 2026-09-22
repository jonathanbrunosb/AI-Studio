export type UsageJob = { created_by: string; model: string; status: string; image_count: number; estimated_cost: number | string | null; actual_cost: number | string | null };

export type UsageSummary = {
  total: number; completed: number; failed: number; inProgress: number; images: number;
  estimatedCost: number | null; actualCost: number | null;
  byModel: { model: string; requests: number; images: number; estimatedCost: number | null }[];
  byUser: { userId: string; requests: number; completed: number }[];
};

/** Consolida indicadores de consumo. Custos ausentes permanecem nulos (indisponíveis), nunca zero fictício. */
export function summarizeUsage(jobs: UsageJob[], imagesByModel: Map<string, number> = new Map()): UsageSummary {
  const sum = (values: (number | string | null)[]) => {
    const known = values.filter((value) => value !== null && value !== "").map(Number);
    return known.length ? Math.round(known.reduce((total, value) => total + value, 0) * 10000) / 10000 : null;
  };
  const models = new Map<string, UsageJob[]>();
  const users = new Map<string, UsageJob[]>();
  for (const job of jobs) {
    models.set(job.model, [...(models.get(job.model) ?? []), job]);
    users.set(job.created_by, [...(users.get(job.created_by) ?? []), job]);
  }
  return {
    total: jobs.length,
    completed: jobs.filter((job) => job.status === "completed").length,
    failed: jobs.filter((job) => job.status === "failed").length,
    inProgress: jobs.filter((job) => job.status === "pending" || job.status === "processing").length,
    images: [...imagesByModel.values()].reduce((total, value) => total + value, 0),
    estimatedCost: sum(jobs.map((job) => job.estimated_cost)),
    actualCost: sum(jobs.map((job) => job.actual_cost)),
    byModel: [...models].map(([model, list]) => ({ model, requests: list.length, images: imagesByModel.get(model) ?? 0, estimatedCost: sum(list.map((job) => job.estimated_cost)) }))
      .sort((a, b) => b.requests - a.requests),
    byUser: [...users].map(([userId, list]) => ({ userId, requests: list.length, completed: list.filter((job) => job.status === "completed").length }))
      .sort((a, b) => b.requests - a.requests),
  };
}
