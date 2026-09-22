"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, BookmarkPlus, Eye, ImagePlus, Layers, LoaderCircle, RefreshCw, Sparkles, Trash2, Wallpaper, WandSparkles, X,
} from "lucide-react";
import type { MediaAsset } from "@/lib/editor/editor-types";
import { aspectRatioLabels, resolutionLabels, type AspectRatio, type AvailableModel, type ResolutionId } from "@/lib/ai/models/model-types";
import { detectsTextRequest } from "@/lib/ai/prompts/prompt-builder";
import { promptPresets, type PromptPresetId } from "@/lib/ai/prompts/prompt-templates";
import { CLIENT_POLL_INTERVAL_MS, CLIENT_TRACKING_TIMEOUT_MS, isTerminal, statusLabels } from "@/lib/ai/services/generation-status";
import type { GenerationJobView } from "@/lib/ai/services/job-view";
import { formatCost } from "@/lib/ai/utils/cost-calculator";
import { validateImageFile } from "@/lib/ai/utils/image-processing";

export type AiAvailability = { available: boolean; reason: string | null };
type GeneratedImage = GenerationJobView["images"][number];

export function AiPanel({ contentId, models, availability, initialJobs, library, onInsert, onBackground, onLibraryAdd }: {
  contentId: string; models: AvailableModel[]; availability: AiAvailability; initialJobs: GenerationJobView[];
  library: MediaAsset[]; onInsert: (asset: MediaAsset) => void; onBackground: (asset: MediaAsset) => void;
  onLibraryAdd: (asset: MediaAsset) => void;
}) {
  const [modelId, setModelId] = useState(models[0]?.id ?? "");
  const model = models.find((item) => item.id === modelId) ?? null;
  const caps = model?.capabilities;
  const [presetId, setPresetId] = useState<PromptPresetId | "">("");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [resolution, setResolution] = useState<ResolutionId>("standard");
  const [imageCount, setImageCount] = useState(1);
  const [reference, setReference] = useState<MediaAsset | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [sensitivity, setSensitivity] = useState("internal");
  const [uploading, setUploading] = useState(false);
  const [parentJobId, setParentJobId] = useState<string | null>(null);
  const [jobs, setJobs] = useState(initialJobs);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<GeneratedImage | null>(null);
  const [trackingStopped, setTrackingStopped] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const trackingStart = useRef(new Map<string, number>());
  const fileRef = useRef<HTMLInputElement>(null);

  const textWarning = useMemo(() => detectsTextRequest(prompt), [prompt]);
  const effectiveRatio = caps?.aspectRatios.includes(aspectRatio) ? aspectRatio : caps?.aspectRatios[0];
  const effectiveResolution = caps?.resolutions.includes(resolution) ? resolution : caps?.resolutions[0];
  const count = Math.min(imageCount, caps?.maxImages ?? 1);
  const estimated = model?.estimatedCostPerImage != null ? model.estimatedCostPerImage * count : null;
  const active = jobs.filter((job) => !isTerminal(job.status) && !trackingStopped.has(job.id));

  const upsertJob = useCallback((job: GenerationJobView) => {
    setJobs((current) => [job, ...current.filter((item) => item.id !== job.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }, []);

  useEffect(() => {
    if (!active.length) return;
    const timer = window.setInterval(async () => {
      setNow(Date.now());
      for (const job of active) {
        const started = trackingStart.current.get(job.id) ?? Date.now();
        trackingStart.current.set(job.id, started);
        if (Date.now() - started > CLIENT_TRACKING_TIMEOUT_MS) {
          setTrackingStopped((current) => new Set(current).add(job.id));
          continue;
        }
        const response = await fetch(`/api/ai/generations/${job.id}`, { cache: "no-store" }).catch(() => null);
        if (!response) continue;
        const body = await response.json().catch(() => ({}));
        if (response.ok && body.job) upsertJob(body.job);
        else if (body.code === "invalid_credentials" || body.code === "not_configured") {
          setError(body.error); setTrackingStopped((current) => new Set(current).add(job.id));
        }
      }
    }, CLIENT_POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [active, upsertJob]);

  function resumeTracking(jobId: string) {
    trackingStart.current.delete(jobId);
    setTrackingStopped((current) => { const next = new Set(current); next.delete(jobId); return next; });
  }

  async function generate() {
    if (!model) return;
    setSubmitting(true); setError(null); setNotice(null);
    const response = await fetch("/api/ai/generations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contentId, modelId: model.id, prompt, presetId: presetId || null, imageCount: count,
        aspectRatio: caps?.sizeFromReference ? undefined : effectiveRatio,
        resolution: caps?.sizeFromReference ? undefined : effectiveResolution,
        referenceAssetId: caps?.supportsReference ? reference?.id ?? null : null,
        referenceAuthorized: caps?.supportsReference && reference ? authorized : undefined,
        parentJobId,
      }),
    }).catch(() => null);
    setSubmitting(false);
    const body = await response?.json().catch(() => ({})) ?? {};
    if (!response?.ok || !body.job) { setError(body.error ?? "Não foi possível enviar a solicitação. Verifique sua conexão."); return; }
    upsertJob(body.job); setParentJobId(null);
  }

  async function cancel(jobId: string) {
    const response = await fetch(`/api/ai/generations/${jobId}/cancel`, { method: "POST" }).catch(() => null);
    const body = await response?.json().catch(() => ({})) ?? {};
    if (body.canceled) setJobs((current) => current.map((job) => job.id === jobId ? { ...job, status: "canceled" } : job));
    setNotice(body.message ?? body.error ?? "Não foi possível cancelar.");
  }

  async function uploadReference(file?: File) {
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) { setError(invalid); return; }
    if (!authorized) { setError("Confirme que você possui autorização para usar esta imagem antes do envio."); return; }
    setUploading(true); setError(null);
    const form = new FormData();
    form.set("file", file); form.set("contentId", contentId); form.set("sensitivity", sensitivity); form.set("authorized", "true");
    const response = await fetch("/api/ai/references", { method: "POST", body: form }).catch(() => null);
    const body = await response?.json().catch(() => ({})) ?? {};
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
    if (!response?.ok || !body.asset) { setError(body.error ?? "Falha ao enviar a referência."); return; }
    setReference(body.asset);
  }

  function regenerate(job: GenerationJobView) {
    setModelId(models.some((item) => item.id === job.modelId) ? job.modelId : modelId);
    setPrompt(job.userPrompt); setPresetId((job.presetId as PromptPresetId) ?? "");
    if (job.aspectRatio) setAspectRatio(job.aspectRatio as AspectRatio);
    if (job.resolution) setResolution(job.resolution as ResolutionId);
    setImageCount(job.imageCount); setParentJobId(job.id);
    setNotice(models.some((item) => item.id === job.modelId) ? "Prompt e configurações recuperados. Revise e clique em Gerar imagem." : "O modelo original está indisponível; selecione outro modelo habilitado.");
  }

  async function saveToLibrary(image: GeneratedImage) {
    const response = await fetch(`/api/ai/assets/${image.id}`, { method: "PATCH" }).catch(() => null);
    if (!response?.ok) { setError("Não foi possível salvar na biblioteca."); return; }
    setJobs((current) => current.map((job) => ({ ...job, images: job.images.map((item) => item.id === image.id ? { ...item, inLibrary: true } : item) })));
    onLibraryAdd(image); setNotice("Imagem disponível na biblioteca de mídias.");
  }

  async function remove(image: GeneratedImage) {
    if (!window.confirm("Excluir esta imagem? Arquivos vinculados a versões do conteúdo serão preservados.")) return;
    const response = await fetch(`/api/ai/assets/${image.id}`, { method: "DELETE" }).catch(() => null);
    const body = await response?.json().catch(() => ({})) ?? {};
    if (!response?.ok) { setError(body.error ?? "Não foi possível excluir."); return; }
    setJobs((current) => current.map((job) => ({ ...job, images: job.images.filter((item) => item.id !== image.id) })));
    setPreview(null); setNotice(body.message);
  }

  const disabled = !availability.available || !model || submitting || prompt.trim().length < 10
    || Boolean(caps?.requiresReference && (!reference || !authorized));

  return <div className="space-y-4 text-sm">
    <div><p className="eyebrow">Inteligência Artificial</p><h3 className="mt-1 font-bold text-slate-900">Geração com Inteligência Artificial</h3><p className="mt-1 text-xs leading-5 text-slate-500">Crie elementos visuais para seus comunicados e newsletters.</p></div>

    {!availability.available && <Alert tone="warning">{availability.reason}</Alert>}
    {availability.available && !models.length && <Alert tone="warning">Nenhum modelo de IA habilitado. Solicite ao administrador a habilitação em Administração › Inteligência Artificial.</Alert>}

    <Field label="Modelo"><select className="field" value={modelId} onChange={(event) => { setModelId(event.target.value); setReference(null); }} disabled={!models.length}>{models.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{model && <p className="mt-1 text-[11px] leading-4 text-slate-500">{model.description}</p>}</Field>

    <Field label="Modelo de prompt"><select className="field" value={presetId} onChange={(event) => { const id = event.target.value as PromptPresetId | ""; setPresetId(id); if (id && !prompt.trim()) setPrompt(promptPresets[id].example); }}><option value="">Prompt livre</option>{Object.entries(promptPresets).map(([id, preset]) => <option key={id} value={id}>{preset.label}</option>)}</select>{presetId && <p className="mt-1 text-[11px] leading-4 text-slate-500">Diretriz aplicada: {promptPresets[presetId].guideline}.</p>}</Field>

    <Field label="Prompt"><textarea className="field min-h-28 resize-y" maxLength={1500} value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ex.: ambiente corporativo moderno com elementos de tecnologia e transformação digital na Contabilidade, tons de azul." /><p className="mt-1 text-right text-[10px] text-slate-400">{prompt.length}/1500</p></Field>
    {textWarning && <Alert tone="info">Títulos, datas, indicadores e informações contábeis devem ser adicionados com os textos editáveis do editor. A IA gerará apenas elementos visuais.</Alert>}

    {caps && !caps.sizeFromReference && <div className="grid grid-cols-2 gap-2">
      <Field label="Proporção"><select className="field" value={effectiveRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}>{caps.aspectRatios.map((ratio) => <option key={ratio} value={ratio}>{aspectRatioLabels[ratio]}</option>)}</select></Field>
      <Field label="Resolução"><select className="field" value={effectiveResolution} onChange={(event) => setResolution(event.target.value as ResolutionId)}>{caps.resolutions.map((item) => <option key={item} value={item}>{resolutionLabels[item]}</option>)}</select></Field>
    </div>}
    {caps?.sizeFromReference && <p className="text-[11px] text-slate-500">Proporção e resolução seguem a imagem de referência neste modelo.</p>}

    <Field label={`Quantidade (máx. ${caps?.maxImages ?? 1})`}><input type="number" className="field" min={1} max={caps?.maxImages ?? 1} value={count} onChange={(event) => setImageCount(Math.max(1, Math.min(caps?.maxImages ?? 1, Number(event.target.value) || 1)))} /></Field>

    <fieldset className={`rounded-xl border p-3 ${caps?.supportsReference ? "border-slate-200" : "border-slate-100 bg-slate-50 opacity-60"}`} disabled={!caps?.supportsReference}>
      <legend className="px-1 text-xs font-bold text-slate-600">Referência visual</legend>
      {!caps?.supportsReference ? <p className="text-[11px] text-slate-500">O modelo selecionado não aceita imagem de referência.</p> : <div className="space-y-2">
        <label className="flex items-start gap-2 text-[11px] leading-4 text-slate-600"><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} className="mt-0.5" />Confirmo que possuo autorização para usar esta imagem e que ela não contém dados pessoais, financeiros, contábeis ou informações internas sensíveis. Esta confirmação não substitui as políticas corporativas.</label>
        <select className="field py-2 text-xs" value={sensitivity} onChange={(event) => setSensitivity(event.target.value)} aria-label="Classificação da imagem"><option value="public">Classificação: Pública</option><option value="internal">Classificação: Interna</option><option value="restricted">Classificação: Restrita</option><option value="confidential">Classificação: Confidencial</option></select>
        {reference ? <div className="flex items-center gap-2 rounded-lg bg-blue-50 p-2"><img src={reference.signedUrl} alt="" className="size-12 rounded object-cover" /><span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{reference.fileName}</span><button className="text-slate-500 hover:text-rose-600" onClick={() => setReference(null)} title="Remover referência"><X size={14} /></button></div> : null}
        <input ref={fileRef} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadReference(event.target.files?.[0])} />
        <button className="secondary-button w-full py-2 text-xs" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <LoaderCircle className="animate-spin" size={14} /> : <ImagePlus size={14} />}{reference ? "Substituir por arquivo" : "Enviar do computador"}</button>
        {library.length > 0 && <select className="field py-2 text-xs" value="" onChange={(event) => { const asset = library.find((item) => item.id === event.target.value); if (asset) setReference(asset); }}><option value="">Selecionar da biblioteca…</option>{library.map((asset) => <option key={asset.id} value={asset.id}>{asset.fileName}</option>)}</select>}
        <p className="text-[10px] text-slate-400">PNG, JPG ou WebP até 10 MB. Arquivos restritos ou confidenciais são bloqueados.</p>
      </div>}
    </fieldset>

    {error && <Alert tone="error">{error}</Alert>}
    {notice && <Alert tone="info">{notice}</Alert>}
    <div className="flex items-center justify-between text-[11px] text-slate-500"><span>Custo estimado</span><span className="font-bold">{formatCost(estimated, model?.costCurrency)}</span></div>
    <button className="primary-button w-full disabled:cursor-not-allowed disabled:bg-slate-300" disabled={disabled} onClick={() => void generate()}>{submitting ? <LoaderCircle className="animate-spin" size={17} /> : <WandSparkles size={17} />}{parentJobId ? "Gerar nova versão" : "Gerar imagem"}</button>

    <section>
      <p className="mb-2 text-xs font-bold text-slate-600">Resultados e histórico</p>
      {!jobs.length && <p className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">As imagens geradas para este conteúdo aparecerão aqui.</p>}
      <div className="space-y-3">{jobs.map((job) => <article key={job.id} className="rounded-xl border border-slate-200 p-3">
        <div className="flex items-center gap-2">
          {!isTerminal(job.status) && !trackingStopped.has(job.id) ? <LoaderCircle size={14} className="animate-spin text-blue-700" /> : <Sparkles size={14} className="text-blue-700" />}
          <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700">{job.modelName}</span>
          <StatusBadge status={job.status} />
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{job.userPrompt}</p>
        <p className="mt-1 text-[10px] text-slate-400">{new Date(job.createdAt).toLocaleString("pt-BR")}{!isTerminal(job.status) && ` · ${Math.max(0, Math.round((now - new Date(job.createdAt).getTime()) / 1000))}s decorridos`}</p>
        {job.status === "failed" && <p className="mt-2 text-[11px] text-rose-600">{job.errorMessage ?? "A geração não foi concluída."}</p>}
        {!isTerminal(job.status) && job.errorMessage && <p className="mt-2 text-[11px] text-amber-700">{job.errorMessage}</p>}
        {trackingStopped.has(job.id) && !isTerminal(job.status) && <div className="mt-2 rounded-lg bg-amber-50 p-2 text-[11px] text-amber-800">Acompanhamento interrompido neste navegador. A solicitação continua registrada no provedor. <button className="font-bold underline" onClick={() => resumeTracking(job.id)}>Retomar</button></div>}
        {!isTerminal(job.status) && <button className="mt-2 text-[11px] font-bold text-slate-500 hover:text-rose-600" onClick={() => void cancel(job.id)}>Cancelar solicitação</button>}
        {job.images.length > 0 && <div className="mt-2 grid grid-cols-2 gap-2">{job.images.map((image) => <div key={image.id} className="group relative overflow-hidden rounded-lg border border-slate-200">
          <img src={image.signedUrl} alt="Imagem gerada por IA" className="aspect-square w-full object-cover" />
          <div className="grid grid-cols-3 gap-px bg-slate-100">
            <IconAction label="Inserir na composição" onClick={() => onInsert(image)}><Layers size={13} /></IconAction>
            <IconAction label="Utilizar como fundo" onClick={() => onBackground(image)}><Wallpaper size={13} /></IconAction>
            <IconAction label="Visualizar" onClick={() => setPreview(image)}><Eye size={13} /></IconAction>
          </div>
        </div>)}</div>}
        {isTerminal(job.status) && <div className="mt-2 flex flex-wrap gap-3 text-[11px]"><button className="flex items-center gap-1 font-bold text-blue-700" onClick={() => regenerate(job)}><RefreshCw size={12} />Regenerar</button><span className="ml-auto text-slate-400">Est.: {formatCost(job.estimatedCost)} · Efetivo: {formatCost(job.actualCost)}</span></div>}
      </article>)}</div>
    </section>

    {preview && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4" onClick={() => setPreview(null)}>
      <div className="max-h-full w-full max-w-3xl overflow-auto rounded-2xl bg-white p-4" onClick={(event) => event.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between"><p className="font-bold text-slate-800">Visualização</p><button onClick={() => setPreview(null)} title="Fechar"><X size={18} /></button></div>
        <img src={preview.signedUrl} alt="Imagem gerada por IA ampliada" className="max-h-[65vh] w-full rounded-xl object-contain bg-slate-50" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="primary-button" onClick={() => { onInsert(preview); setPreview(null); }}><Layers size={15} />Inserir na composição</button>
          <button className="secondary-button" onClick={() => { onBackground(preview); setPreview(null); }}><Wallpaper size={15} />Utilizar como fundo</button>
          <button className="secondary-button" disabled={preview.inLibrary} onClick={() => void saveToLibrary(preview)}><BookmarkPlus size={15} />{preview.inLibrary ? "Na biblioteca" : "Salvar na biblioteca"}</button>
          <button className="secondary-button text-rose-700" onClick={() => void remove(preview)}><Trash2 size={15} />Excluir</button>
        </div>
      </div>
    </div>}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">{label}</span>{children}</label>;
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return <button title={label} aria-label={label} onClick={onClick} className="grid h-8 place-items-center bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700">{children}</button>;
}

function StatusBadge({ status }: { status: GenerationJobView["status"] }) {
  const tone = status === "completed" ? "bg-emerald-50 text-emerald-700" : status === "failed" ? "bg-rose-50 text-rose-700" : status === "canceled" ? "bg-slate-100 text-slate-500" : "bg-blue-50 text-blue-700";
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}>{statusLabels[status]}</span>;
}

function Alert({ tone, children }: { tone: "warning" | "error" | "info"; children: React.ReactNode }) {
  const styles = { warning: "border-amber-200 bg-amber-50 text-amber-800", error: "border-rose-200 bg-rose-50 text-rose-700", info: "border-blue-100 bg-blue-50 text-blue-800" }[tone];
  return <div role={tone === "error" ? "alert" : "status"} className={`flex gap-2 rounded-xl border p-3 text-xs leading-5 ${styles}`}><AlertTriangle size={14} className="mt-0.5 shrink-0" /><div>{children}</div></div>;
}
