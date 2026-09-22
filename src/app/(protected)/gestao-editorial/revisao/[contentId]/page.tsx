import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, History, ShieldCheck } from "lucide-react";
import { ContentStatusBadge } from "@/components/shared/content-status-badge";
import { DecisionPanel } from "@/components/editorial/decision-panel";
import { EditorialHistory } from "@/components/editorial/editorial-history";
import { ProjectPreview } from "@/components/editorial/project-preview";
import { requireUser } from "@/lib/auth/authorization";
import { signSnapshotAssets } from "@/lib/editor/snapshot-assets";
import { canDecide, lockMessages } from "@/lib/editorial/workflow-rules";
import { listHistory } from "@/lib/editorial/workflow-service";
import { contentCategoryLabels, type ContentCategory, type ContentStatus } from "@/types/content";

type Editorial = { title?: string; subtitle?: string | null; description?: string | null; category?: string; reference_date?: string | null; source_name?: string | null; source_url?: string | null; author_name?: string };

export default async function ReviewPage({ params }: { params: Promise<{ contentId: string }> }) {
  const { contentId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(contentId)) notFound();
  const { supabase, roles, user } = await requireUser();
  const { data: content } = await supabase.from("contents").select("*").eq("id", contentId).maybeSingle();
  if (!content) notFound();
  const status = content.status as ContentStatus;

  const versionId = status === "approved" || status === "published" ? content.approved_version_id ?? content.submitted_version_id
    : status === "archived" ? content.approved_version_id ?? content.submitted_version_id : content.submitted_version_id;
  const [{ data: version }, { data: owner }, history] = await Promise.all([
    versionId ? supabase.from("content_versions").select("id, version_number, snapshot, created_by, created_at").eq("id", versionId).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("profiles").select("full_name").eq("id", content.created_by).maybeSingle(),
    listHistory(supabase, { contentId, pageSize: 200 }),
  ]);
  const signed = version ? await signSnapshotAssets(supabase, version.snapshot) : null;
  const snapshot = signed?.snapshot as (Record<string, unknown> & { editorial?: Editorial; submission?: { submitted_at?: string } }) | undefined;
  const editorial: Editorial = snapshot?.editorial ?? { title: content.title, subtitle: content.subtitle, description: content.description, reference_date: content.reference_date, source_name: content.source_name, source_url: content.source_url };

  const { data: reviewer } = content.assigned_reviewer_id ? await supabase.from("profiles").select("full_name").eq("id", content.assigned_reviewer_id).maybeSingle() : { data: null };
  const decidable = version ? canDecide(roles, user.id, { created_by: content.created_by, status, assigned_reviewer_id: content.assigned_reviewer_id }, version.created_by) : false;
  const disabledReason = status !== "in_review" ? (lockMessages[status]?.message ?? "Este conteúdo não está em revisão.")
    : content.created_by === user.id || version?.created_by === user.id ? "Segregação de funções: você não pode decidir sobre um conteúdo de sua autoria ou enviado por você."
      : !decidable ? "Seu perfil não permite decidir sobre este conteúdo ou ele foi designado a outro aprovador." : null;

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><Link href="/gestao-editorial" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><ArrowLeft size={14} />Gestão Editorial</Link><h2 className="mt-1 text-xl font-bold text-slate-900">Revisão editorial</h2></div>
      <ContentStatusBadge status={status} />
    </div>
    {!version && <p className="rounded-xl bg-slate-100 p-4 text-sm text-slate-600">Este conteúdo ainda não possui versão submetida à revisão.</p>}
    {signed && signed.unavailable.length > 0 && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">{signed.unavailable.length} arquivo(s) da peça não puderam ser carregados para o seu perfil. Verifique antes de decidir.</p>}
    <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_320px]">
      <aside className="surface-card space-y-4 p-5 text-sm">
        <div><p className="eyebrow">Informações do conteúdo</p><h3 className="mt-1 text-lg font-bold text-slate-900">{editorial.title}</h3>{editorial.subtitle && <p className="mt-1 text-slate-600">{editorial.subtitle}</p>}</div>
        <dl className="space-y-2 text-xs">
          <Row label="Categoria" value={contentCategoryLabels[content.category as ContentCategory]} />
          <Row label="Responsável" value={editorial.author_name ?? owner?.full_name ?? "—"} />
          <Row label="Versão em análise" value={version ? `v${version.version_number} · ciclo ${content.review_cycle}` : "—"} />
          <Row label="Enviado em" value={snapshot?.submission?.submitted_at ? new Date(snapshot.submission.submitted_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"} />
          <Row label="Data de referência" value={editorial.reference_date ? new Date(`${editorial.reference_date}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada"} />
          <Row label="Fonte" value={editorial.source_name ?? "Não informada"} />
          <Row label="Aprovador designado" value={reviewer?.full_name ?? "Fila geral de aprovadores"} />
        </dl>
        {editorial.source_url && <a href={editorial.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline"><ExternalLink size={13} />Link de referência</a>}
        {editorial.description && <div><p className="text-xs font-bold text-slate-500">Descrição</p><p className="mt-1 whitespace-pre-line text-xs leading-5 text-slate-700">{editorial.description}</p></div>}
        <div><p className="mb-2 text-xs font-bold text-slate-500">Histórico resumido</p><EditorialHistory events={history.items.slice(-3)} compact /></div>
      </aside>
      <section className="surface-card p-5">
        <p className="mb-3 text-xs font-bold text-slate-500">Pré-visualização da versão submetida (somente leitura)</p>
        {snapshot ? <ProjectPreview snapshot={snapshot} zoomable className="mx-auto max-h-[75vh] max-w-full" /> : <p className="p-10 text-center text-sm text-slate-400">Sem pré-visualização disponível.</p>}
      </section>
      <aside className="space-y-4">
        <section className="surface-card p-5"><div className="mb-3 flex items-center gap-2"><ShieldCheck size={18} className="text-blue-700" /><h3 className="font-bold text-slate-900">Decisão editorial</h3></div>
          {version ? <DecisionPanel contentId={content.id} versionId={version.id} versionNumber={version.version_number} disabledReason={disabledReason} /> : <p className="text-xs text-slate-500">Sem versão para decidir.</p>}
        </section>
        <section id="historico" className="surface-card p-5"><div className="mb-3 flex items-center gap-2"><History size={18} className="text-blue-700" /><h3 className="font-bold text-slate-900">Histórico completo</h3></div><EditorialHistory events={history.items} /></section>
      </aside>
    </div>
  </div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3"><dt className="font-bold text-slate-500">{label}</dt><dd className="text-right text-slate-800">{value}</dd></div>;
}
