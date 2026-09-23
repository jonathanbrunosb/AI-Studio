import Link from "next/link";
import { CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Clock3, Eye, MessageSquareWarning, Search, Send } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ContentStatusBadge } from "@/components/shared/content-status-badge";
import { EditorialHistory } from "@/components/editorial/editorial-history";
import { ProjectPreview } from "@/components/editorial/project-preview";
import { requireUser } from "@/lib/auth/authorization";
import { canReviewQueue } from "@/lib/editorial/workflow-rules";
import { getStatusCounts, listEditorialContents, listHistory, PAGE_SIZE, type EditorialTab } from "@/lib/editorial/workflow-service";
import { contentCategoryLabels, contentStatusLabels, type ContentCategory, type ContentStatus } from "@/types/content";

const tabs: { id: EditorialTab; label: string; reviewerOnly?: boolean }[] = [
  { id: "all", label: "Todos os conteúdos" },
  { id: "awaiting", label: "Aguardando minha aprovação", reviewerOnly: true },
  { id: "changes", label: "Ajustes solicitados" },
  { id: "approved", label: "Aprovados" },
  { id: "history", label: "Histórico" },
];

type Params = Record<string, string | undefined>;

export default async function EditorialPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, roles, user } = await requireUser();
  const isReviewer = canReviewQueue(roles);
  const visibleTabs = tabs.filter((tab) => !tab.reviewerOnly || isReviewer);
  const tab = (visibleTabs.find((item) => item.id === params.tab)?.id ?? (isReviewer ? "awaiting" : "all")) as EditorialTab;
  const page = Math.max(1, Math.min(1000, Number(params.page) || 1));

  let counts: Record<ContentStatus, number> | null = null;
  try { counts = await getStatusCounts(supabase); } catch { counts = null; }
  const [{ data: owners }] = await Promise.all([supabase.from("profiles").select("id, full_name").order("full_name")]);

  const href = (next: Params) => {
    const merged = { ...params, ...next };
    const query = new URLSearchParams(Object.entries(merged).filter(([, value]) => value) as [string, string][]);
    return `/gestao-editorial?${query.toString()}`;
  };

  const kpis = [
    { label: "Em revisão", value: counts?.in_review, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
    { label: "Ajustes solicitados", value: counts?.changes_requested, icon: MessageSquareWarning, tone: "bg-rose-50 text-rose-700" },
    { label: "Aprovados", value: counts?.approved, icon: CheckCircle2, tone: "bg-blue-50 text-blue-700" },
    { label: "Publicados", value: counts?.published, icon: Send, tone: "bg-emerald-50 text-emerald-700" },
  ];

  return <div>
    <PageHeader eyebrow="Governança de conteúdo" title="Gestão Editorial" description="Controle, revisão e aprovação dos conteúdos de comunicação da Contabilidade." />
    {params.decided && <p role="status" className="mb-5 rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-800">Decisão registrada com sucesso.</p>}
    <section aria-label="Indicadores editoriais" className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{kpis.map(({ label, value, icon: Icon, tone }) => <article key={label} className="surface-card flex items-center gap-4 p-5"><span className={`grid size-11 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="text-3xl font-bold text-slate-900">{value ?? "—"}</p></div></article>)}</section>

    <nav aria-label="Abas editoriais" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">{visibleTabs.map((item) => <Link key={item.id} href={`/gestao-editorial?tab=${item.id}`} className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-bold ${tab === item.id ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{item.label}</Link>)}</nav>

    {tab === "history" ? <HistoryTab page={page} supabase={supabase} href={href} /> : <>
      <form className="surface-card mb-4 grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.6fr)_repeat(5,minmax(0,1fr))_auto]" action="/gestao-editorial">
        <input type="hidden" name="tab" value={tab} />
        <label className="relative"><Search size={16} className="absolute left-3 top-3 text-slate-400" /><input name="q" defaultValue={params.q} className="field pl-9" placeholder="Buscar por título" aria-label="Buscar por título" /></label>
        <select name="category" defaultValue={params.category ?? ""} className="field" aria-label="Categoria"><option value="">Todas as categorias</option>{Object.entries(contentCategoryLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
        {tab === "all" ? <select name="status" defaultValue={params.status ?? ""} className="field" aria-label="Status"><option value="">Ativos (exceto arquivados)</option>{Object.entries(contentStatusLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select> : <span className="hidden xl:block" />}
        <select name="owner" defaultValue={params.owner ?? ""} className="field" aria-label="Responsável"><option value="">Todos os responsáveis</option>{owners?.map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select>
        <input type="date" name="from" defaultValue={params.from} className="field" aria-label="Período inicial" />
        <input type="date" name="to" defaultValue={params.to} className="field" aria-label="Período final" />
        <button className="secondary-button">Filtrar</button>
      </form>
      <ContentsTab tab={tab} page={page} params={params} supabase={supabase} user={{ id: user.id, roles }} href={href} isReviewer={isReviewer} />
    </>}
  </div>;
}

async function ContentsTab({ tab, page, params, supabase, user, href, isReviewer }: {
  tab: EditorialTab; page: number; params: Params; supabase: Awaited<ReturnType<typeof requireUser>>["supabase"];
  user: { id: string; roles: Awaited<ReturnType<typeof requireUser>>["roles"] }; href: (next: Params) => string; isReviewer: boolean;
}) {
  let result;
  try {
    result = await listEditorialContents(supabase, { tab, page, q: params.q, category: params.category, status: params.status, owner: params.owner, from: params.from, to: params.to }, user);
  } catch {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Não foi possível consultar os conteúdos. Tente novamente em instantes.</div>;
  }
  const pages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
  const empty = { all: "Nenhum conteúdo encontrado com os filtros atuais.", awaiting: "Nenhum conteúdo aguardando sua aprovação.", changes: "Nenhum conteúdo com ajustes solicitados.", approved: "Nenhum conteúdo aprovado.", history: "" }[tab];

  return <section className="surface-card overflow-hidden">
    {!result.items.length ? <div className="p-12 text-center text-sm text-slate-500"><ClipboardCheck className="mx-auto mb-3 text-slate-300" />{empty}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left">
      <thead><tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Conteúdo</th><th className="px-3 py-3">Categoria</th><th className="px-3 py-3">Responsável</th><th className="px-3 py-3">Versão</th><th className="px-3 py-3">Envio</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Aprovador</th><th className="px-5 py-3 text-right">Ações</th></tr></thead>
      <tbody>{result.items.map((item) => {
        const canAct = isReviewer && item.status === "in_review" && item.ownerId !== user.id;
        return <tr key={item.id} className="border-t border-slate-100 hover:bg-blue-50/30">
          <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="w-16 shrink-0">{item.thumbnail ? <ProjectPreview snapshot={item.thumbnail} label={`Miniatura de ${item.title}`} /> : <span className="block aspect-square rounded-lg" style={{ backgroundColor: item.accent, opacity: .2 }} />}</div><p className="font-bold text-slate-800">{item.title}</p></div></td>
          <td className="px-3 py-3 text-sm text-slate-600">{contentCategoryLabels[item.category as ContentCategory]}</td>
          <td className="px-3 py-3 text-sm text-slate-600">{item.ownerName}</td>
          <td className="px-3 py-3 text-sm text-slate-600">{item.versionNumber ? `v${item.versionNumber}` : "—"}</td>
          <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-500">{item.submittedAt ? new Date(item.submittedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</td>
          <td className="px-3 py-3"><ContentStatusBadge status={item.status} /></td>
          <td className="px-3 py-3 text-sm text-slate-600">{item.reviewerName ?? (item.status === "in_review" ? "Fila geral" : "—")}</td>
          <td className="px-5 py-3 text-right"><div className="flex justify-end gap-2">
            {canAct && <Link href={`/gestao-editorial/revisao/${item.id}`} className="primary-button h-9 px-3 text-xs"><ClipboardCheck size={14} />Revisar</Link>}
            <Link href={item.status === "in_review" || item.status === "approved" || !["draft", "changes_requested"].includes(item.status) ? `/gestao-editorial/revisao/${item.id}` : `/studio?id=${item.id}`} className="secondary-button h-9 px-3 text-xs"><Eye size={14} />Abrir</Link>
          </div></td>
        </tr>;
      })}</tbody>
    </table></div>}
    <Pagination page={page} pages={pages} total={result.total} href={href} />
  </section>;
}

async function HistoryTab({ page, supabase, href }: { page: number; supabase: Awaited<ReturnType<typeof requireUser>>["supabase"]; href: (next: Params) => string }) {
  let result;
  try { result = await listHistory(supabase, { page, pageSize: 20 }); } catch {
    return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Não foi possível consultar o histórico.</div>;
  }
  return <section className="surface-card overflow-hidden"><div className="p-6"><EditorialHistory events={result.items} showContent /></div><Pagination page={page} pages={Math.max(1, Math.ceil(result.total / 20))} total={result.total} href={href} /></section>;
}

function Pagination({ page, pages, total, href }: { page: number; pages: number; total: number; href: (next: Params) => string }) {
  return <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><span>{total} registro(s) · página {Math.min(page, pages)} de {pages}</span><div className="flex gap-2">
    {page > 1 ? <Link className="secondary-button h-8 px-2" href={href({ page: String(page - 1) })} aria-label="Página anterior"><ChevronLeft size={14} /></Link> : <span className="secondary-button h-8 cursor-not-allowed px-2 opacity-40"><ChevronLeft size={14} /></span>}
    {page < pages ? <Link className="secondary-button h-8 px-2" href={href({ page: String(page + 1) })} aria-label="Próxima página"><ChevronRight size={14} /></Link> : <span className="secondary-button h-8 cursor-not-allowed px-2 opacity-40"><ChevronRight size={14} /></span>}
  </div></div>;
}
