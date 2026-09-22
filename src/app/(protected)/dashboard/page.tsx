import Link from "next/link";
import { ArrowRight, BookOpen, CheckSquare2, FilePlus2, Megaphone, MonitorUp, Newspaper, Sparkles } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { RecentContentTable } from "@/components/dashboard/recent-content-table";
import { WorkflowOverview } from "@/components/dashboard/workflow-overview";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";
import { requireUser } from "@/lib/auth/authorization";
import { getDashboardData } from "@/lib/content/content-service";

const actions = [
  { title: "Novo Comunicado", description: "Crie uma comunicação interna objetiva.", href: "/studio?category=internal_communication", icon: Megaphone, tone: "blue" as const },
  { title: "Nova Newsletter", description: "Organize notícias em uma nova edição.", href: "/studio?category=accounting_newsletter", icon: Newspaper, tone: "violet" as const },
  { title: "Divulgação de Sistema", description: "Apresente mudanças e novas rotinas.", href: "/studio?category=system_announcement", icon: MonitorUp, tone: "amber" as const },
  { title: "Nova Campanha", description: "Estruture uma campanha interna.", href: "/studio?category=internal_campaign", icon: Sparkles, tone: "blue" as const },
  { title: "Ver Biblioteca", description: "Consulte conteúdos e materiais publicados.", icon: BookOpen, href: "/biblioteca", tone: "slate" as const },
  { title: "Revisar Aprovações", description: "Trate conteúdos aguardando decisão.", icon: CheckSquare2, href: "/gestao-editorial", tone: "amber" as const },
];

export default async function DashboardPage() {
  const { profile, supabase } = await requireUser();
  let data;
  try { data = await getDashboardData(supabase); } catch { data = null; }
  const firstName = profile.full_name.split(" ")[0];
  const stats = data ? [
    { title: "Total de conteúdos", value: data.total, change: "Dados persistidos", tone: "blue" as const },
    { title: "Em elaboração", value: data.counts.draft, change: "Rascunhos ativos", tone: "slate" as const },
    { title: "Aguardando aprovação", value: data.counts.in_review, change: "Em revisão", tone: "amber" as const },
    { title: "Aprovados", value: data.counts.approved, change: "Registros aprovados", tone: "indigo" as const },
    { title: "Publicados", value: data.counts.published, change: "Conteúdos disponíveis", tone: "emerald" as const },
  ] : [];

  return <div className="space-y-6"><section className="relative overflow-hidden rounded-[22px] bg-[#0b2b50] px-6 py-7 text-white shadow-xl shadow-blue-950/15 md:px-8 md:py-8"><div className="absolute -right-16 -top-28 size-72 rounded-full border-[46px] border-blue-400/10" /><div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.17em] text-sky-300">Visão geral · dados em tempo real</p><h2 className="text-3xl font-bold tracking-tight md:text-4xl">Olá, {firstName}.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/80 md:text-base">Gerencie comunicados, newsletters e materiais visuais da Contabilidade em um só ambiente.</p></div><Link href="/studio" className="inline-flex w-fit items-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-900 shadow-lg transition hover:bg-blue-50"><FilePlus2 size={18} />Começar nova criação<ArrowRight size={16} /></Link></div></section>{!data ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">Não foi possível consultar o banco de dados. Tente novamente em instantes.</div> : <><section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{stats.map((stat) => <StatCard key={stat.title} {...stat} />)}</section><section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.7fr)]"><SectionCard title="Conteúdos recentes" description="Registros mais recentes disponíveis para seu perfil" action={<Link href="/biblioteca" className="text-xs font-bold text-blue-700 hover:underline">Ver todos</Link>}>{data.recent.length ? <RecentContentTable items={data.recent} /> : <EmptyDashboard />}</SectionCard><SectionCard title="Fluxo editorial" description="Volume real por etapa"><WorkflowOverview stages={data.stages} /></SectionCard></section></>}<section><div className="mb-4"><p className="eyebrow">Atalhos</p><h3 className="mt-1 text-xl font-bold text-slate-900">O que você deseja criar?</h3></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{actions.map(({ href = "/studio", ...action }) => <QuickActionCard key={action.title} href={href} {...action} />)}</div></section></div>;
}

function EmptyDashboard() { return <div className="p-10 text-center"><p className="font-bold text-slate-700">Nenhum conteúdo cadastrado</p><p className="mt-1 text-sm text-slate-500">Crie seu primeiro rascunho para iniciar o fluxo editorial.</p><Link href="/studio" className="primary-button mt-4">Criar primeiro conteúdo</Link></div>; }
