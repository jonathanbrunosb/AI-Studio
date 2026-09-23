import Link from "next/link";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, Cpu, Gauge, Settings2, Users, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requireAdmin } from "@/lib/auth/authorization";
import { aspectRatioLabels, resolutionLabels } from "@/lib/ai/models/model-types";
import { getModelDefinition } from "@/lib/ai/models/model-catalog";
import { getProviderConfigurationStatus } from "@/lib/ai/providers/selected-provider";
import { loadAiConfiguration } from "@/lib/ai/repository/supabase-generation-repository";
import { summarizeUsage } from "@/lib/ai/services/usage-summary";
import { formatCost } from "@/lib/ai/utils/cost-calculator";
import { updateAiSettingsAction, updateModelAction, updateUserLimitAction } from "./actions";

export default async function AiAdminPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const [config, { data: jobs }, { data: images }, { data: profiles }, { data: limits }] = await Promise.all([
    loadAiConfiguration(supabase),
    supabase.from("generation_jobs").select("id, created_by, model, status, image_count, estimated_cost, actual_cost").order("created_at", { ascending: false }).limit(5000),
    supabase.from("media_assets").select("generation_job_id").eq("source", "ai_generation").limit(20000),
    supabase.from("profiles").select("id, full_name, email, is_active").order("full_name"),
    supabase.from("ai_user_limits").select("user_id, max_requests"),
  ]);
  const provider = getProviderConfigurationStatus();
  const modelByJob = new Map((jobs ?? []).map((job) => [job.id, job.model]));
  const imagesByModel = new Map<string, number>();
  for (const image of images ?? []) {
    const model = image.generation_job_id ? modelByJob.get(image.generation_job_id) : undefined;
    if (model) imagesByModel.set(model, (imagesByModel.get(model) ?? 0) + 1);
  }
  const usage = summarizeUsage(jobs ?? [], imagesByModel);
  const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));
  const limitByUser = new Map((limits ?? []).map((limit) => [limit.user_id, limit.max_requests]));
  const pending = [
    !provider.configured && `Definir ${provider.requiredEnv.join(", ")} no ambiente do servidor (Railway › Variables). Obtenha a chave em fal.ai › Dashboard › Keys.`,
    !provider.serviceRoleConfigured && "Definir SUPABASE_SERVICE_ROLE_KEY no servidor (necessária para registrar jobs e armazenar imagens geradas).",
  ].filter(Boolean) as string[];

  return <div>
    <PageHeader eyebrow="Governança de IA" title="Inteligência Artificial — Modelos e Consumo" description="Habilite modelos, acompanhe o consumo e defina limites de utilização por colaborador." />
    <Link href="/administracao" className="mb-5 inline-flex items-center gap-1 text-xs font-bold text-blue-700"><ArrowLeft size={14} />Voltar à Administração</Link>
    {params.success && <Notice tone="success">{params.success}</Notice>}
    {params.error && <Notice tone="error">{params.error}</Notice>}

    <section className="surface-card mb-5 p-5">
      <div className="flex flex-wrap items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700"><Cpu size={19} /></span><div className="flex-1"><h3 className="font-bold text-slate-900">Provedor: {provider.providerName}</h3><p className="text-xs text-slate-500">Integração via Queue API oficial. Credenciais mantidas exclusivamente no servidor.</p></div>
        {pending.length ? <span className="flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700"><AlertTriangle size={13} />Configuração pendente</span> : <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={13} />Credenciais presentes</span>}
      </div>
      {pending.length > 0 && <ul className="mt-4 list-disc space-y-1 rounded-xl bg-amber-50 p-4 pl-8 text-xs leading-5 text-amber-800">{pending.map((item) => <li key={item}>{item}</li>)}</ul>}
      {!pending.length && <p className="mt-3 text-xs text-slate-500">A presença da credencial não comprova que a integração está operacional. Valide com uma geração real de baixo custo antes da liberação.</p>}
    </section>

    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Stat icon={<BarChart3 size={17} />} label="Total de solicitações" value={usage.total} />
      <Stat icon={<CheckCircle2 size={17} />} label="Gerações concluídas" value={usage.completed} />
      <Stat icon={<XCircle size={17} />} label="Gerações com falha" value={usage.failed} />
      <Stat icon={<Gauge size={17} />} label="Imagens geradas" value={usage.images} />
      <Stat label="Em andamento" value={usage.inProgress} />
      <Stat label="Custo estimado (USD)" value={formatCost(usage.estimatedCost)} />
      <Stat label="Custo efetivo (USD)" value={formatCost(usage.actualCost)} hint="O provedor não informa o valor cobrado por solicitação; consulte o faturamento do fal.ai." />
    </div>

    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.8fr)]">
      <section className="surface-card overflow-hidden">
        <div className="border-b border-slate-100 p-5"><h3 className="font-bold text-slate-900">Modelos configurados</h3><p className="mt-1 text-xs text-slate-500">Somente modelos com integração implementada. Usuários veem apenas os habilitados.</p></div>
        <div className="divide-y divide-slate-100">{config.models.map((model) => { const def = getModelDefinition(model.id)!; const used = usage.byModel.find((item) => item.model === model.id); return <article key={model.id} className="p-5">
          <div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-800">{model.name}</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${model.isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{model.isEnabled ? "Habilitado" : "Desabilitado"}</span><code className="text-[10px] text-slate-400">{model.id}</code></div>
          <p className="mt-1 text-xs text-slate-500">{model.description}</p>
          <dl className="mt-3 grid gap-2 text-[11px] text-slate-600 sm:grid-cols-2">
            <div><dt className="font-bold">Proporções</dt><dd>{def.capabilities.sizeFromReference ? "Segue a referência" : def.capabilities.aspectRatios.map((ratio) => aspectRatioLabels[ratio]).join(", ")}</dd></div>
            <div><dt className="font-bold">Resoluções</dt><dd>{def.capabilities.sizeFromReference ? "Segue a referência" : def.capabilities.resolutions.map((item) => resolutionLabels[item]).join(", ")}</dd></div>
            <div><dt className="font-bold">Imagem de referência</dt><dd>{def.capabilities.requiresReference ? "Obrigatória" : def.capabilities.supportsReference ? "Suportada" : "Não suportada"}</dd></div>
            <div><dt className="font-bold">Máx. por solicitação</dt><dd>{def.capabilities.maxImages}</dd></div>
            <div><dt className="font-bold">Consumo</dt><dd>{used?.requests ?? 0} solicitações · {used?.images ?? 0} imagens · {formatCost(used?.estimatedCost ?? null)}</dd></div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2">
            <form action={updateModelAction}><input type="hidden" name="model_id" value={model.id} /><input type="hidden" name="is_enabled" value={String(!model.isEnabled)} /><button className="secondary-button h-9 px-3 text-xs">{model.isEnabled ? "Desabilitar" : "Habilitar"}</button></form>
            <form action={updateModelAction} className="flex gap-2"><input type="hidden" name="model_id" value={model.id} /><input name="estimated_cost_per_image" defaultValue={model.estimatedCostPerImage ?? ""} className="field h-9 w-32 py-1 text-xs" placeholder="USD/imagem" aria-label="Custo estimado por imagem" /><button className="secondary-button h-9 px-3 text-xs">Salvar custo</button></form>
          </div>
        </article>; })}</div>
      </section>

      <div className="space-y-5">
        <section className="surface-card p-5">
          <div className="flex items-center gap-2"><Settings2 size={18} className="text-blue-700" /><h3 className="font-bold text-slate-900">Integração e limites</h3></div>
          <form action={updateAiSettingsAction} className="mt-4 space-y-3 text-xs">
            <label className="block font-bold text-slate-600">Status da integração<select name="integration_enabled" defaultValue={String(config.integrationEnabled)} className="field mt-1"><option value="true">Habilitada</option><option value="false">Desabilitada</option></select></label>
            <div className="grid grid-cols-2 gap-2"><label className="block font-bold text-slate-600">Solicitações por usuário<input name="default_max_requests" type="number" min={0} max={10000} defaultValue={config.defaultMaxRequests} className="field mt-1" /></label><label className="block font-bold text-slate-600">Período (dias)<input name="period_days" type="number" min={1} max={365} defaultValue={config.periodDays} className="field mt-1" /></label></div>
            <label className="flex items-start gap-2 text-slate-600"><input type="checkbox" name="allow_restricted_references" defaultChecked={config.allowRestrictedReferences} className="mt-0.5" />Autorizar expressamente o envio de referências classificadas como restritas/confidenciais ao provedor externo.</label>
            <p className="text-[11px] text-slate-400">Solicitações em andamento contam na cota. A verificação ocorre no banco de dados, antes do envio ao provedor.</p>
            <button className="primary-button w-full">Salvar configurações</button>
          </form>
        </section>

        <section className="surface-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 p-5"><Users size={18} className="text-blue-700" /><h3 className="font-bold text-slate-900">Consumo e limite por usuário</h3></div>
          <div className="divide-y divide-slate-100">{(profiles ?? []).map((profile) => { const used = usage.byUser.find((item) => item.userId === profile.id); return <div key={profile.id} className="flex flex-wrap items-center gap-2 p-4">
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-700">{names.get(profile.id)}</p><p className="text-[10px] text-slate-400">{used?.requests ?? 0} solicitações · {used?.completed ?? 0} concluídas</p></div>
            <form action={updateUserLimitAction} className="flex gap-1"><input type="hidden" name="user_id" value={profile.id} /><input name="max_requests" defaultValue={limitByUser.get(profile.id) ?? ""} placeholder={`Padrão (${config.defaultMaxRequests})`} className="field h-8 w-28 py-1 text-[11px]" aria-label="Limite individual" /><button className="secondary-button h-8 px-2 text-[11px]">Salvar</button></form>
          </div>; })}</div>
        </section>
      </div>
    </div>
  </div>;
}

function Stat({ label, value, icon, hint }: { label: string; value: string | number; icon?: React.ReactNode; hint?: string }) {
  return <div className="surface-card p-4" title={hint}><div className="flex items-center gap-2 text-slate-500">{icon}<p className="text-[11px] font-bold uppercase tracking-wide">{label}</p></div><p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>{hint && <p className="mt-1 text-[10px] leading-4 text-slate-400">{hint}</p>}</div>;
}

function Notice({ tone, children }: { tone: "success" | "error"; children: React.ReactNode }) {
  return <div className={`mb-5 rounded-xl border p-3 text-sm font-semibold ${tone === "success" ? "border-blue-100 bg-blue-50 text-blue-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{children}</div>;
}
