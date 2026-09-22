import { describe, expect, it, vi } from "vitest";
import { listEnabledModels, mergeCatalog, modelCatalog } from "@/lib/ai/models/model-catalog";
import { buildFinalPrompt, detectsTextRequest } from "@/lib/ai/prompts/prompt-builder";
import { FalImageProvider, isAllowedFalHost } from "@/lib/ai/providers/fal-provider";
import { ProviderError, type ImageGenerationProvider, type ProviderStatus } from "@/lib/ai/providers/provider.interface";
import { getProvider, setProviderOverride } from "@/lib/ai/providers/provider-registry";
import {
  cancelGeneration, refreshGeneration, submitGeneration, GenerationError,
  type GenerationDeps, type GenerationRepository, type JobRecord,
} from "@/lib/ai/services/generation-service";
import { referenceAllowed, validateAgainstModel } from "@/lib/ai/services/generation-validation";
import { summarizeUsage } from "@/lib/ai/services/usage-summary";
import { estimateCost, formatCost } from "@/lib/ai/utils/cost-calculator";
import { dimensionsFor, inspectImage, isAllowedResultUrl, validateImageFile } from "@/lib/ai/utils/image-processing";
import { EDITOR_CUSTOM_PROPERTIES } from "@/lib/editor/editor-utils";

const CONTENT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const REF_ASSET = "33333333-3333-4333-8333-333333333333";

function png(width = 64, height = 32) {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width); view.setUint32(20, height);
  return bytes;
}

const allEnabled = mergeCatalog(modelCatalog.map((model) => ({ id: model.id, is_enabled: true, estimated_cost_per_image: model.referenceCostPerImage, cost_currency: "USD" })));

class MemoryRepo implements GenerationRepository {
  jobs = new Map<string, JobRecord>();
  assets: { jobId: string; path: string; width: number }[] = [];
  audits: string[] = [];
  quota = 5;
  editable = true;
  failStorage = false;
  finalizing = new Set<string>();
  reference = { id: REF_ASSET, bucket: "ai-references", storagePath: `${USER}/ref.png`, sensitivity: "internal", mimeType: "image/png" };
  async canEditContent() { return this.editable; }
  async getReferenceAsset(id: string) { return id === REF_ASSET ? this.reference : null; }
  async createSignedUrl(_bucket: string, path: string) { return `https://storage.example/signed/${path}?token=temp`; }
  async reserveJob(input: Parameters<GenerationRepository["reserveJob"]>[0]) {
    const inFlightOrDone = [...this.jobs.values()].filter((job) => job.createdBy === input.userId && job.status !== "failed" && job.status !== "canceled").length;
    if (inFlightOrDone >= this.quota) throw new Error("QUOTA_EXCEEDED");
    const id = crypto.randomUUID();
    this.jobs.set(id, { id, contentId: input.contentId, createdBy: input.userId, provider: input.provider, model: input.model, prompt: input.prompt, status: "pending", settings: input.settings, externalRequestId: null, errorMessage: null, imageCount: input.imageCount, estimatedCost: input.estimatedCost, actualCost: null, createdAt: new Date().toISOString(), completedAt: null });
    return id;
  }
  async getJob(id: string) { const job = this.jobs.get(id); return job ? structuredClone(job) : null; }
  async updateJob(id: string, patch: Partial<JobRecord>) { this.jobs.set(id, { ...this.jobs.get(id)!, ...patch }); }
  async claimFinalize(id: string) { if (this.finalizing.has(id)) return false; this.finalizing.add(id); return true; }
  async releaseFinalize(id: string) { this.finalizing.delete(id); }
  async countJobImages(id: string) { return this.assets.filter((asset) => asset.jobId === id).length; }
  async storeGeneratedImage({ job, info, index }: Parameters<GenerationRepository["storeGeneratedImage"]>[0]) {
    if (this.failStorage) throw new Error("STORAGE");
    const path = `${job.createdBy}/${job.contentId}/${job.id}-${index + 1}.${info.extension}`;
    this.assets.push({ jobId: job.id, path, width: info.width });
    return { assetId: crypto.randomUUID(), storagePath: path };
  }
  async audit(_actor: string, action: string) { this.audits.push(action); }
}

function mockProvider(statuses: ProviderStatus[] = [{ state: "completed" }]) {
  const provider = {
    id: "fal", name: "Mock", supportsCancel: true,
    isConfigured: vi.fn(() => true),
    submit: vi.fn(async () => ({ externalId: "req-1", modelId: "fal-ai/flux/schnell" })),
    getStatus: vi.fn(async () => statuses.shift() ?? { state: "completed" as const }),
    getResult: vi.fn(async () => ({ images: [{ url: "https://v3.fal.media/files/a.png" }, { url: "https://v3.fal.media/files/b.png" }], actualCost: null })),
    cancel: vi.fn(async () => "canceled" as const),
  } satisfies ImageGenerationProvider;
  return provider;
}

function deps(repo: MemoryRepo, provider: ImageGenerationProvider | null = mockProvider(), extra: Partial<GenerationDeps> = {}): GenerationDeps {
  const fetchImpl = vi.fn(async () => new Response(png(), { status: 200, headers: { "content-type": "image/png" } })) as unknown as typeof fetch;
  return { repo, provider, models: allEnabled, integrationEnabled: true, allowRestrictedReferences: false, fetchImpl, ...extra };
}

const baseRequest = { contentId: CONTENT, modelId: "fal-ai/flux/schnell", prompt: "Ambiente corporativo moderno em tons de azul", imageCount: 2, aspectRatio: "16:9" as const, resolution: "standard" as const };
const user = { userId: USER, canGenerate: true };

describe("catálogo de modelos", () => {
  it("apresenta apenas modelos implementados e habilitados", () => {
    const models = listEnabledModels([
      { id: "fal-ai/flux/schnell", is_enabled: true, estimated_cost_per_image: "0.003", cost_currency: "USD" },
      { id: "fal-ai/flux/dev", is_enabled: false, estimated_cost_per_image: null, cost_currency: "USD" },
      { id: "modelo-inexistente", is_enabled: true, estimated_cost_per_image: null, cost_currency: "USD" },
    ]);
    expect(models.map((model) => model.id)).toEqual(["fal-ai/flux/schnell"]);
    expect(models[0].estimatedCostPerImage).toBe(0.003);
  });

  it("mantém desabilitados os modelos sem registro administrativo", () => {
    expect(mergeCatalog([]).every((model) => !model.isEnabled)).toBe(true);
  });
});

describe("configuração de parâmetros", () => {
  const schnell = allEnabled.find((model) => model.id === "fal-ai/flux/schnell")!;
  const i2i = allEnabled.find((model) => model.id === "fal-ai/flux/dev/image-to-image")!;

  it("respeita o limite de imagens do modelo", () => {
    expect(validateAgainstModel({ ...baseRequest, imageCount: 5 }, schnell).ok).toBe(false);
  });

  it("bloqueia referência em modelo que não a suporta", () => {
    const result = validateAgainstModel({ ...baseRequest, referenceAssetId: REF_ASSET, referenceAuthorized: true }, schnell);
    expect(result).toMatchObject({ ok: false });
  });

  it("exige referência e confirmação de autorização no modelo image-to-image", () => {
    expect(validateAgainstModel({ ...baseRequest, modelId: i2i.id }, i2i).ok).toBe(false);
    expect(validateAgainstModel({ ...baseRequest, modelId: i2i.id, referenceAssetId: REF_ASSET }, i2i).ok).toBe(false);
    expect(validateAgainstModel({ ...baseRequest, modelId: i2i.id, referenceAssetId: REF_ASSET, referenceAuthorized: true }, i2i).ok).toBe(true);
  });

  it("recusa modelo desabilitado", () => {
    expect(validateAgainstModel(baseRequest, { ...schnell, isEnabled: false })).toMatchObject({ ok: false, error: expect.stringContaining("indisponível") });
  });

  it("calcula dimensões múltiplas de 16 conforme proporção", () => {
    const size = dimensionsFor("16:9", "standard");
    expect(size.width % 16).toBe(0);
    expect(size.height % 16).toBe(0);
    expect(size.width / size.height).toBeCloseTo(16 / 9, 1);
  });
});

describe("prompts", () => {
  it("acrescenta diretrizes e proibição de textos", () => {
    const prompt = buildFinalPrompt("Escritório moderno", "comunicado");
    expect(prompt).toContain("Escritório moderno");
    expect(prompt).toContain("espaço livre para inserção de texto");
    expect(prompt).toContain("sem textos");
  });

  it("detecta pedidos de texto institucional na imagem", () => {
    expect(detectsTextRequest('Banner com o título "Fechamento de março"')).toBe(true);
    expect(detectsTextRequest("Prazo de entrega 31/03")).toBe(true);
    expect(detectsTextRequest("Ambiente corporativo com iluminação suave")).toBe(false);
  });
});

describe("serviço de geração com provedor simulado", () => {
  it("envia a solicitação ao provedor configurado e registra o job", async () => {
    const repo = new MemoryRepo(); const provider = mockProvider();
    const jobId = await submitGeneration(user, baseRequest, deps(repo, provider));
    expect(provider.submit).toHaveBeenCalledWith(expect.objectContaining({ imageCount: 2, aspectRatio: "16:9", prompt: expect.stringContaining("sem textos") }));
    expect(repo.jobs.get(jobId)).toMatchObject({ status: "processing", externalRequestId: "req-1", estimatedCost: 0.006 });
    expect(repo.jobs.get(jobId)!.settings).toMatchObject({ userPrompt: baseRequest.prompt });
  });

  it("acompanha o status e armazena os resultados ao concluir", async () => {
    const repo = new MemoryRepo(); const provider = mockProvider([{ state: "pending" }, { state: "processing" }, { state: "completed" }]);
    const d = deps(repo, provider);
    const jobId = await submitGeneration(user, baseRequest, d);
    expect((await refreshGeneration(jobId, d)).status).toBe("processing");
    expect((await refreshGeneration(jobId, d)).status).toBe("processing");
    const done = await refreshGeneration(jobId, d);
    expect(done.status).toBe("completed");
    expect(done.completedAt).toBeTruthy();
    expect(done.actualCost).toBeNull();
    expect(repo.assets).toHaveLength(2);
    expect(repo.assets[0].path).toMatch(new RegExp(`^${USER}/${CONTENT}/`));
    expect(repo.audits).toContain("ai_generation.completed");
  });

  it("não informa sucesso quando o provedor não está configurado", async () => {
    const provider = mockProvider(); provider.isConfigured.mockReturnValue(false);
    await expect(submitGeneration(user, baseRequest, deps(new MemoryRepo(), provider))).rejects.toMatchObject({ code: "not_configured" });
    expect(provider.submit).not.toHaveBeenCalled();
  });

  it("registra falha da API sem expor detalhes e preserva o job", async () => {
    const repo = new MemoryRepo(); const provider = mockProvider();
    provider.submit.mockRejectedValueOnce(new ProviderError("invalid_credentials", "401 secret-token-xyz"));
    const error = await submitGeneration(user, baseRequest, deps(repo, provider)).then(() => null, (e: unknown) => e as GenerationError);
    expect(error).toMatchObject({ code: "invalid_credentials" });
    expect(error?.message).not.toContain("secret-token");
    const [job] = repo.jobs.values();
    expect(job.status).toBe("failed");
  });

  it("marca falha informada pelo provedor e permite nova tentativa", async () => {
    const repo = new MemoryRepo(); const d = deps(repo, mockProvider([{ state: "failed", error: "Falha" }]));
    const jobId = await submitGeneration(user, baseRequest, d);
    expect((await refreshGeneration(jobId, d)).status).toBe("failed");
    await expect(submitGeneration(user, { ...baseRequest, parentJobId: jobId }, d)).resolves.toBeTruthy();
  });

  it("mantém o job recuperável quando o Storage falha", async () => {
    const repo = new MemoryRepo(); repo.failStorage = true; const d = deps(repo);
    const jobId = await submitGeneration(user, baseRequest, d);
    const result = await refreshGeneration(jobId, d);
    expect(result.status).toBe("processing");
    expect(result.errorMessage).toContain("não pôde ser armazenada");
    repo.failStorage = false;
    expect((await refreshGeneration(jobId, d)).status).toBe("completed");
  });

  it("bloqueia usuário sem permissão e conteúdo inacessível", async () => {
    await expect(submitGeneration({ userId: USER, canGenerate: false }, baseRequest, deps(new MemoryRepo()))).rejects.toMatchObject({ code: "forbidden" });
    const repo = new MemoryRepo(); repo.editable = false;
    await expect(submitGeneration(user, baseRequest, deps(repo))).rejects.toMatchObject({ code: "forbidden" });
  });

  it("impede solicitações acima da cota, considerando as em andamento", async () => {
    const repo = new MemoryRepo(); repo.quota = 2; const provider = mockProvider(); const d = deps(repo, provider);
    await submitGeneration(user, baseRequest, d);
    await submitGeneration(user, baseRequest, d);
    await expect(submitGeneration(user, baseRequest, d)).rejects.toMatchObject({ code: "quota_exceeded" });
    expect(provider.submit).toHaveBeenCalledTimes(2);
  });

  it("bloqueia referência confidencial e envia apenas URL temporária quando permitida", async () => {
    const repo = new MemoryRepo(); const provider = mockProvider();
    const request = { ...baseRequest, modelId: "fal-ai/flux/dev/image-to-image", imageCount: 1, referenceAssetId: REF_ASSET, referenceAuthorized: true };
    repo.reference = { ...repo.reference, sensitivity: "confidential" };
    await expect(submitGeneration(user, request, deps(repo, provider))).rejects.toMatchObject({ code: "reference_blocked" });
    repo.reference = { ...repo.reference, sensitivity: "internal" };
    await submitGeneration(user, request, deps(repo, provider));
    expect(provider.submit).toHaveBeenCalledWith(expect.objectContaining({ referenceImageUrl: expect.stringContaining("token=temp") }));
    expect(referenceAllowed("restricted", true)).toBe(true);
  });

  it("só marca cancelamento quando o provedor confirma", async () => {
    const repo = new MemoryRepo(); const provider = mockProvider([{ state: "pending" }]); const d = deps(repo, provider);
    const jobId = await submitGeneration(user, baseRequest, d);
    provider.cancel.mockResolvedValueOnce("not_cancelable" as never);
    expect((await cancelGeneration(jobId, USER, d)).canceled).toBe(false);
    expect(repo.jobs.get(jobId)!.status).toBe("processing");
    expect((await cancelGeneration(jobId, USER, d)).canceled).toBe(true);
    expect(repo.jobs.get(jobId)!.status).toBe("canceled");
    await expect(cancelGeneration(jobId, "outro", d)).rejects.toBeInstanceOf(GenerationError);
  });

  it("recusa URLs de resultado fora do provedor (SSRF)", async () => {
    const repo = new MemoryRepo(); const provider = mockProvider();
    provider.getResult.mockResolvedValueOnce({ images: [{ url: "http://169.254.169.254/latest" }], actualCost: null });
    const d = deps(repo, provider);
    const jobId = await submitGeneration(user, baseRequest, d);
    const job = await refreshGeneration(jobId, d);
    expect(job.status).toBe("processing");
    expect(repo.assets).toHaveLength(0);
  });
});

describe("provedor fal.ai (HTTP simulado)", () => {
  const model = modelCatalog[0];

  it("envia autenticação apenas no cabeçalho e mapeia a resposta da fila", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ request_id: "abc", status_url: "https://queue.fal.run/fal-ai/flux/requests/abc/status", response_url: "https://queue.fal.run/fal-ai/flux/requests/abc", cancel_url: "https://queue.fal.run/fal-ai/flux/requests/abc/cancel" }));
    const provider = new FalImageProvider({ apiKey: "test-key-123456", fetchImpl: fetchImpl as unknown as typeof fetch });
    const ref = await provider.submit({ model, prompt: "teste", aspectRatio: "1:1", resolution: "standard", imageCount: 1 });
    expect(ref.externalId).toBe("abc");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://queue.fal.run/fal-ai/flux/schnell");
    expect((init.headers as Record<string, string>).Authorization).toBe("Key test-key-123456");
    expect(JSON.parse(init.body as string)).toMatchObject({ prompt: "teste", num_images: 1, image_size: { width: 1024, height: 1024 } });
    expect(JSON.parse(init.body as string)).not.toHaveProperty("image_url");
  });

  it("não envia parâmetros de tamanho no modelo baseado em referência", () => {
    const provider = new FalImageProvider({ apiKey: "test-key-123456" });
    const input = provider.buildInput({ model: modelCatalog[2], prompt: "x", aspectRatio: "1:1", resolution: "standard", imageCount: 1, referenceImageUrl: "https://s/x" });
    expect(input).not.toHaveProperty("image_size");
    expect(input.image_url).toBe("https://s/x");
  });

  it("classifica credencial inválida e ausência de configuração", async () => {
    const provider = new FalImageProvider({ apiKey: "test-key-123456", fetchImpl: (async () => new Response("", { status: 401 })) as typeof fetch });
    await expect(provider.submit({ model, prompt: "x", aspectRatio: "1:1", resolution: "standard", imageCount: 1 })).rejects.toMatchObject({ code: "invalid_credentials" });
    const unconfigured = new FalImageProvider({ apiKey: "" });
    expect(unconfigured.isConfigured()).toBe(false);
    await expect(unconfigured.submit({ model, prompt: "x", aspectRatio: "1:1", resolution: "standard", imageCount: 1 })).rejects.toMatchObject({ code: "not_configured" });
  });

  it("mapeia status da fila e cancelamento", async () => {
    const responses = [Response.json({ status: "IN_QUEUE", queue_position: 2 }), Response.json({ status: "IN_PROGRESS" }), Response.json({ status: "COMPLETED" }), new Response(null, { status: 202 }), new Response(null, { status: 400 })];
    const provider = new FalImageProvider({ apiKey: "test-key-123456", fetchImpl: (async () => responses.shift()!) as typeof fetch });
    const ref = { externalId: "abc", modelId: "fal-ai/flux/dev" };
    expect(await provider.getStatus(ref)).toEqual({ state: "pending", queuePosition: 2 });
    expect(await provider.getStatus(ref)).toEqual({ state: "processing" });
    expect(await provider.getStatus(ref)).toEqual({ state: "completed" });
    expect(await provider.cancel(ref)).toBe("canceled");
    expect(await provider.cancel(ref)).toBe("not_cancelable");
  });

  it("restringe hosts do provedor e resultados", () => {
    expect(isAllowedFalHost("https://queue.fal.run/x")).toBe(true);
    expect(isAllowedFalHost("https://evil.example/queue.fal.run")).toBe(false);
    expect(isAllowedResultUrl("https://v3.fal.media/files/a.png")).toBe(true);
    expect(isAllowedResultUrl("http://v3.fal.media/files/a.png")).toBe(false);
  });

  it("permite substituir o provedor por mock no registro", () => {
    const mock = mockProvider();
    setProviderOverride("fal", mock);
    expect(getProvider("fal")).toBe(mock);
    setProviderOverride("fal", null);
    expect(getProvider("fal")).toBeInstanceOf(FalImageProvider);
  });
});

describe("arquivos, custos e consumo", () => {
  it("valida formato e tamanho de imagens", () => {
    expect(validateImageFile({ type: "image/gif", size: 10 })).toContain("Formato");
    expect(validateImageFile({ type: "image/png", size: 11 * 1024 * 1024 })).toContain("10 MB");
    expect(validateImageFile({ type: "image/webp", size: 1000 })).toBeNull();
  });

  it("identifica imagem pelo conteúdo", () => {
    expect(inspectImage(png(300, 200))).toMatchObject({ mimeType: "image/png", width: 300, height: 200 });
    expect(inspectImage(new TextEncoder().encode("<svg></svg>"))).toBeNull();
  });

  it("não atribui custo fictício quando indisponível", () => {
    expect(estimateCost(null, 3)).toBeNull();
    expect(formatCost(null)).toBe("Indisponível");
    const usage = summarizeUsage([
      { created_by: "a", model: "m1", status: "completed", image_count: 2, estimated_cost: "0.05", actual_cost: null },
      { created_by: "b", model: "m1", status: "failed", image_count: 1, estimated_cost: null, actual_cost: null },
      { created_by: "a", model: "m2", status: "processing", image_count: 1, estimated_cost: 0.01, actual_cost: null },
    ], new Map([["m1", 2]]));
    expect(usage).toMatchObject({ total: 3, completed: 1, failed: 1, inProgress: 1, images: 2, estimatedCost: 0.06, actualCost: null });
    expect(usage.byUser[0]).toMatchObject({ userId: "a", requests: 2 });
  });
});

describe("compatibilidade com o editor", () => {
  it("serializa o papel de plano de fundo junto aos elementos", () => {
    expect(EDITOR_CUSTOM_PROPERTIES).toEqual(expect.arrayContaining(["storagePath", "assetId", "role"]));
  });
});
