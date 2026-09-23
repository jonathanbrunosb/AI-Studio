import Link from "next/link";
import { ArrowRight, BookOpen, CheckSquare2, FilePlus2, Megaphone, MonitorUp, Newspaper, Sparkles } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { RecentContentTable } from "@/components/dashboard/recent-content-table";
import { WorkflowOverview } from "@/components/dashboard/workflow-overview";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { requireUser } from "@/lib/auth/authorization";
import { getDashboardData } from "@/lib/content/content-service";
import { getPendencies } from "@/lib/editorial/workflow-service";
import { getPublicationDashboard } from "@/lib/publications/publication-service";
import { ContentStatusBadge } from "@/components/shared/content-status-badge";
import { contentCategoryLabels } from "@/types/content";

const actions = [
  { title: "Novo Comunicado", description: "Crie uma comunicação interna objetiva.", href: "/studio?category=internal_communication", icon: Megaphone, tone: "blue" as const },
  { title: "Nova Newsletter", description: "Organize notícias em uma nova edição.", href: "/studio?category=accounting_newsletter", icon: Newspaper, tone: "violet" as const },
  { title: "Divulgação de Sistema", description: "Apresente mudanças e novas rotinas.", href: "/studio?category=system_announcement", icon: MonitorUp, tone: "amber" as const },
  { title: "Nova Campanha", description: "Estruture uma campanha interna.", href: "/studio?category=internal_campaign", icon: Sparkles, tone: "blue" as const },
  { title: "Ver Biblioteca", description: "Consulte conteúdos e materiais publicados.", icon: BookOpen, href: "/biblioteca", tone: "slate" as const },
  { title: "Revisar Aprovações", description: "Trate conteúdos aguardando decisão.", icon: CheckSquare2, href: "/gestao-editorial", tone: "amber" as const },
];

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { periodo } = await searchParams;
  const periodDays = periodo === "all" ? null : [7, 30, 90, 365].includes(Number(periodo)) ? Number(periodo) : 30;
  const { profile, supabase, user, roles } = await requireUser();
  let data;
  try { data = await getDashboardData(supabase); } catch { data = null; }
  const [pendencies, publications] = await Promise.all([
    getPendencies(supabase, { id: user.id, roles }).catch(() => null),
    getPublicationDashboard(supabase, periodDays).catch(() => null),
  ]);
  const pendencyTitle = roles.includes("admin") ? "Visão consolidada dos materiais pendentes" : roles.includes("approver") ? "Conteúdos aguardando sua decisão" : "Materiais devolvidos para ajustes";
  const firstName = profile.full_name.split(" ")[0];
  const stats = data ? [
    { title: "Total de conteúdos", value: data.total, change: "Dados persistidos", tone: "blue" as const },
    { title: "Em elaboração", value: data.counts.draft, change: "Rascunhos ativos", tone: "slate" as const },
    { title: "Aguardando aprovação", value: data.counts.in_review, change: "Em revisão", tone: "amber" as const },
    { title: "Ajustes solicitados", value: data.counts.changes_requested, change: "Devolvidos ao autor", tone: "rose" as const },
    { title: "Aprovados", value: data.counts.approved, change: "Registros aprovados", tone: "indigo" as const },
    { title: "Publicados", value: data.counts.published, change: "Conteúdos disponíveis", tone: "emerald" as const },
  ] : [];

  return <div className="space-y-6"><section className="relative overflow-hidden rounded-[22px] bg-[#0b2b50] px-6 py-7 text-white shadow-xl shadow-blue-950/15 md:px-8 md:py-8"><div className="absolute -right-16 -top-28 size-72 rounded-full border-[46px] border-blue-400/10" /><div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.17em] text-sky-300">Visão geral · dados em tempo real</p><h2 className="text-3xl font-bold tracking-tight md:text-4xl">Olá, {firstName}.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/80 md:text-base">Gerencie comunicados, newsletters e materiais visuais da Contabilidade em um só ambiente.</p></div><Link href="/studio" className="inline-flex w-fit items-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-900 shadow-lg transition hover:bg-blue-50"><FilePlus2 size={18} />Começar nova criação<ArrowRight size={16} /></Link></div></section>{!data ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Não foi possível consultar o banco de dados. Tente novamente em instantes.</div> : <><section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">{stats.map((stat) => <StatCard key={stat.title} {...stat} />)}</section><SectionCard title="Publicações e Comunicação" description="Situação por conteúdo (tentativas repetidas não são somadas)" action={<div className="flex items-center gap-1 text-[11px]">{[["7", "7 dias"], ["30", "30 dias"], ["90", "90 dias"], ["365", "12 meses"], ["all", "Tudo"]].map(([value, label]) => <Link key={value} href={`/dashboard?periodo=${value}`} className={`rounded-lg px-2 py-1 font-bold ${String(periodDays ?? "all") === value ? "bg-blue-700 text-white" : "text-slate-500 hover:bg-slate-100"}`}>{label}</Link>)}</div>}>{!publications ? <p className="p-6 text-sm text-rose-700">Não foi possível consultar as publicações.</p> : <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">{[["Aprovados aguardando publicação", publications.approvedWaiting, "text-blue-700"], ["Preparados para exportação", publications.prepared, "text-indigo-700"], ["Aguardando publicação no portal", publications.awaiting, "text-amber-700"], ["Publicações confirmadas", publications.published, "text-emerald-700"], ["Falhas de integração pendentes", publications.failed, "text-rose-700"]].map(([label, value, tone]) => <Link key={String(label)} href="/publicacoes" className="rounded-xl border border-slate-200 p-4 hover:border-blue-200"><p className="text-xs font-semibold text-slate-500">{label}</p><p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p></Link>)}</div>}</SectionCard><SectionCard title="Pendências editoriais" description={pendencyTitle} action={<Link href="/gestao-editorial" className="text-xs font-bold text-blue-700 hover:underline">Abrir Gestão Editorial</Link>}>{!pendencies ? <p className="p-6 text-sm text-rose-700">Não foi possível consultar as pendências.</p> : pendencies.length ? <ul className="divide-y divide-slate-100">{pendencies.map((item) => <li key={`${item.kind}-${item.id}`}><Link href={item.kind === "review" ? `/gestao-editorial/revisao/${item.id}` : `/studio?id=${item.id}`} className="flex flex-wrap items-center gap-3 px-6 py-3 hover:bg-blue-50/40"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${item.kind === "review" ? "bg-amber-50 text-amber-700" : "bg-rose-50 text-rose-700"}`}>{item.kind === "review" ? "Decidir" : "Ajustar"}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-slate-800">{item.title}</span><span className="text-[11px] text-slate-500">{contentCategoryLabels[item.category]} · {item.owner} · {new Date(item.date).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span></span><ContentStatusBadge status={item.status} /></Link></li>)}</ul> : <p className="p-6 text-center text-sm text-slate-500">Nenhuma pendência editorial para você no momento.</p>}</SectionCard><section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.7fr)]"><SectionCard title="Conteúdos recentes" description="Registros mais recentes disponíveis para seu perfil" action={<Link href="/biblioteca" className="text-xs font-bold text-blue-700 hover:underline">Ver todos</Link>}>{data.recent.length ? <RecentContentTable items={data.recent} /> : <EmptyDashboard />}</SectionCard><SectionCard title="Fluxo editorial" description="Volume real por etapa"><WorkflowOverview stages={data.stages} /></SectionCard></section></>}<section><div className="mb-4"><p className="eyebrow">Atalhos</p><h3 className="mt-1 text-xl font-bold text-slate-900">O que você deseja criar?</h3></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{actions.map(({ href = "/studio", ...action }) => <QuickActionCard key={action.title} href={href} {...action} />)}</div></section></div>;
}

function EmptyDashboard() { return <div className="p-10 text-center"><p className="font-bold text-slate-700">Nenhum conteúdo cadastrado</p><p className="mt-1 text-sm text-slate-500">Crie seu primeiro rascunho para iniciar o fluxo editorial.</p><Link href="/studio" className="primary-button mt-4">Criar primeiro conteúdo</Link></div>; }
