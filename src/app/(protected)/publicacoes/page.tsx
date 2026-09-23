import Link from "next/link";
import { AlertOctagon, CheckCircle2, ChevronLeft, ChevronRight, Clock3, History, PackageCheck, Send, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ProjectPreview } from "@/components/editorial/project-preview";
import { PreparePublicationButton, type PrepareData } from "@/components/publications/prepare-publication-dialog";
import { DownloadPackageLink, PublicationAdminActions } from "@/components/publications/publication-actions";
import { PublicationStatusBadge } from "@/components/publications/publication-status-badge";
import { requireUser } from "@/lib/auth/authorization";
import { canConfirm, canPrepare, publicationStatusLabels } from "@/lib/publications/publication-rules";
import { getPublicationKpis, listPublicationEvents, listPublicationRows, PUBLICATIONS_PAGE_SIZE } from "@/lib/publications/publication-service";
import { contentCategoryLabels } from "@/types/content";

type Params = Record<string, string | undefined>;
const eventLabels: Record<string, string> = { prepared: "Pacote preparado", repackaged: "Pacote regerado", exported: "Pacote exportado", received: "Recebido pelo portal", pending_publication: "Aguardando publicação", published: "Publicação confirmada", failed: "Falha registrada", retry: "Nova tentativa liberada", superseded: "Substituída por nova versão", duplicate_ack: "Confirmação repetida ignorada" };

export default async function PublicationsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const { supabase, roles, user } = await requireUser();
  const page = Math.max(1, Math.min(1000, Number(params.page) || 1));
  const [kpis, list, { data: owners }, { data: mappings }] = await Promise.all([
    getPublicationKpis(supabase).catch(() => null),
    listPublicationRows(supabase, { page, category: params.category, status: params.status, owner: params.owner, from: params.from, to: params.to }).catch(() => null),
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("content_category_destinations").select("category, is_default, portal_destinations(id, label, portal_category, enabled)"),
  ]);
  const events = params.historico && /^[0-9a-f-]{36}$/i.test(params.historico) ? await listPublicationEvents(supabase, params.historico) : null;
  const destinationsFor = (category: string) => (mappings ?? []).filter((row) => row.category === category)
    .map((row) => ({ ...(row.portal_destinations as unknown as { id: string; label: string; portal_category: string; enabled: boolean }), isDefault: row.is_default }))
    .filter((row) => row.enabled).sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  const href = (next: Params) => `/publicacoes?${new URLSearchParams(Object.entries({ ...params, ...next }).filter(([, value]) => value) as [string, string][]).toString()}`;
  const pages = Math.max(1, Math.ceil((list?.total ?? 0) / PUBLICATIONS_PAGE_SIZE));
  const cards = [
    { label: "Aprovados", value: kpis?.approved, icon: ShieldCheck, tone: "bg-blue-50 text-blue-700" },
    { label: "Preparados", value: kpis?.prepared, icon: PackageCheck, tone: "bg-indigo-50 text-indigo-700" },
    { label: "Aguardando publicação", value: kpis?.awaiting, icon: Clock3, tone: "bg-amber-50 text-amber-700" },
    { label: "Publicados", value: kpis?.published, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Falhas de integração", value: kpis?.failed, icon: AlertOctagon, tone: "bg-rose-50 text-rose-700" },
  ];

  return <div>
    <PageHeader eyebrow="Portal da Contabilidade" title="Central de Publicações" description="Gerencie a disponibilização dos conteúdos aprovados para os canais de comunicação da Contabilidade." />
    <section aria-label="Indicadores de publicação" className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">{cards.map(({ label, value, icon: Icon, tone }) => <article key={label} className="surface-card flex items-center gap-4 p-5"><span className={`grid size-11 place-items-center rounded-xl ${tone}`}><Icon size={20} /></span><div><p className="text-sm font-semibold text-slate-500">{label}</p><p className="text-3xl font-bold text-slate-900">{value ?? "—"}</p></div></article>)}</section>
    <p className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900"><Send size={13} className="mr-1 inline" />A aprovação editorial autoriza o encaminhamento, mas não publica. Fluxo atual: <strong>preparar → baixar ZIP → importar no portal (Administração → Importar do AI Studio) → publicar no Painel Editorial do portal → confirmar aqui</strong>.</p>

    {events && <section className="surface-card mb-4 p-5"><div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 font-bold text-slate-900"><History size={17} className="text-blue-700" />Histórico de publicação</h3><Link href={href({ historico: undefined })} className="text-xs font-bold text-blue-700">Fechar</Link></div>{events.length ? <ol className="space-y-2">{events.map((event) => <li key={event.id} className="rounded-lg bg-slate-50 p-3 text-xs"><p className="font-bold text-slate-800">{eventLabels[event.event] ?? event.event}{event.to_status && event.from_status !== event.to_status ? ` · ${publicationStatusLabels[event.to_status as keyof typeof publicationStatusLabels] ?? event.to_status}` : ""}</p><p className="mt-0.5 text-slate-500">{event.actorName} · {new Date(event.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>{event.details && Object.keys(event.details as object).length > 0 && <p className="mt-1 break-all text-[11px] text-slate-500">{Object.entries(event.details as Record<string, unknown>).filter(([, value]) => value !== null && value !== "").map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}</p>}</li>)}</ol> : <p className="text-sm text-slate-500">Nenhum evento registrado.</p>}</section>}

    <form className="surface-card mb-4 grid gap-2 p-4 md:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]" action="/publicacoes">
      <select name="category" defaultValue={params.category ?? ""} className="field" aria-label="Categoria"><option value="">Todas as categorias</option>{Object.entries(contentCategoryLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <select name="status" defaultValue={params.status ?? ""} className="field" aria-label="Status da publicação"><option value="">Todos os status</option>{Object.entries(publicationStatusLabels).filter(([id]) => id !== "superseded").map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select>
      <select name="owner" defaultValue={params.owner ?? ""} className="field" aria-label="Responsável"><option value="">Todos os responsáveis</option>{owners?.map((owner) => <option key={owner.id} value={owner.id}>{owner.full_name}</option>)}</select>
      <input type="date" name="from" defaultValue={params.from} className="field" aria-label="Aprovados desde" />
      <input type="date" name="to" defaultValue={params.to} className="field" aria-label="Aprovados até" />
      <button className="secondary-button">Filtrar</button>
    </form>

    <section className="surface-card overflow-hidden">
      {!list ? <p className="p-6 text-sm text-rose-700">Não foi possível consultar as publicações.</p> : !list.items.length ? <p className="p-12 text-center text-sm text-slate-500">Nenhum conteúdo aprovado encontrado com os filtros atuais.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left">
        <thead><tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><th className="px-5 py-3">Conteúdo</th><th className="px-3 py-3">Categoria</th><th className="px-3 py-3">Responsável</th><th className="px-3 py-3">Versão aprovada</th><th className="px-3 py-3">Aprovação</th><th className="px-3 py-3">Destino</th><th className="px-3 py-3">Publicação</th><th className="px-5 py-3 text-right">Ações</th></tr></thead>
        <tbody>{list.items.map((row) => {
          const pub = row.publication;
          const status = pub ? (pub.isCurrentVersion ? pub.status : pub.status === "published" ? "published" : pub.status) : "not_prepared";
          const needsPreparation = !pub || !pub.isCurrentVersion || pub.status === "failed" || pub.status === "superseded";
          const preparable = canPrepare(roles, user.id, { created_by: row.ownerId, status: row.contentStatus, approved_version_id: row.approvedVersionId });
          const prepareData: PrepareData = {
            contentId: row.contentId, versionId: row.approvedVersionId, versionNumber: row.approvedVersionNumber ?? 0, category: row.category, approvedAt: row.approvedAt,
            contentStatus: row.contentStatus, editorial: row.editorial, snapshot: row.thumbnail, destinations: destinationsFor(row.category),
            unavailableAssets: row.unavailableAssets, supersedes: row.supersedesPublished ? pub?.id ?? null : null,
          };
          return <tr key={row.contentId} className="border-t border-slate-100 align-top hover:bg-blue-50/30">
            <td className="px-5 py-3"><div className="flex items-center gap-3"><div className="w-16 shrink-0">{row.thumbnail ? <ProjectPreview snapshot={row.thumbnail} label={`Miniatura de ${row.title}`} /> : null}</div><div><p className="font-bold text-slate-800">{row.editorial.title ?? row.title}</p>{!pub?.isCurrentVersion && pub && <p className="text-[11px] text-amber-700">Publicação registrada refere-se a uma versão anterior.</p>}</div></div></td>
            <td className="px-3 py-3 text-sm text-slate-600">{contentCategoryLabels[row.category]}</td>
            <td className="px-3 py-3 text-sm text-slate-600">{row.ownerName}</td>
            <td className="px-3 py-3 text-sm text-slate-600">v{row.approvedVersionNumber ?? "?"}</td>
            <td className="whitespace-nowrap px-3 py-3 text-sm text-slate-500">{row.approvedAt ? new Date(row.approvedAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—"}</td>
            <td className="px-3 py-3 text-xs text-slate-600">{pub?.destinationLabel ?? destinationsFor(row.category)[0]?.label ?? "Sem destino habilitado"}</td>
            <td className="px-3 py-3"><PublicationStatusBadge status={status as keyof typeof publicationStatusLabels} />{pub?.status === "failed" && pub.errorMessage && <p className="mt-1 max-w-48 text-[11px] text-rose-700">{pub.errorMessage}</p>}{pub?.externalUrl && <a href={pub.externalUrl} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[11px] font-bold text-blue-700">Ver no portal ↗</a>}</td>
            <td className="px-5 py-3"><div className="flex flex-wrap justify-end gap-2">
              {preparable && needsPreparation && <PreparePublicationButton data={prepareData} label={pub?.status === "published" ? "Preparar atualização" : "Preparar publicação"} />}
              {preparable && pub?.isCurrentVersion && ["prepared", "exported"].includes(pub.status) && <PreparePublicationButton data={prepareData} label="Regerar pacote" />}
              {pub && pub.isCurrentVersion && !["failed", "superseded"].includes(pub.status) && <DownloadPackageLink publicationId={pub.id} />}
              {canConfirm(roles) && pub && pub.isCurrentVersion && <PublicationAdminActions publicationId={pub.id} status={pub.status} />}
              <Link href={href({ historico: row.contentId })} className="secondary-button h-9 px-3 text-xs"><History size={14} />Histórico</Link>
            </div></td>
          </tr>;
        })}</tbody>
      </table></div>}
      <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><span>{list?.total ?? 0} conteúdo(s) · página {Math.min(page, pages)} de {pages}</span><div className="flex gap-2">
        {page > 1 ? <Link className="secondary-button h-8 px-2" href={href({ page: String(page - 1) })} aria-label="Página anterior"><ChevronLeft size={14} /></Link> : <span className="secondary-button h-8 px-2 opacity-40"><ChevronLeft size={14} /></span>}
        {page < pages ? <Link className="secondary-button h-8 px-2" href={href({ page: String(page + 1) })} aria-label="Próxima página"><ChevronRight size={14} /></Link> : <span className="secondary-button h-8 px-2 opacity-40"><ChevronRight size={14} /></span>}
      </div></div>
    </section>
  </div>;
}
