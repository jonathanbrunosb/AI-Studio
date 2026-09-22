import Link from "next/link";
import { ArrowRight, BookOpen, CheckSquare2, FilePlus2, Megaphone, MonitorUp, Newspaper, Sparkles } from "lucide-react";
import { dashboardStats } from "@/data/mock-data";
import { StatCard } from "@/components/dashboard/stat-card";
import { SectionCard } from "@/components/shared/section-card";
import { RecentContentTable } from "@/components/dashboard/recent-content-table";
import { WorkflowOverview } from "@/components/dashboard/workflow-overview";
import { QuickActionCard } from "@/components/dashboard/quick-action-card";

const actions = [
  { title: "Novo Comunicado", description: "Crie uma comunicação interna objetiva.", icon: Megaphone, tone: "blue" as const },
  { title: "Nova Newsletter", description: "Organize notícias em uma nova edição.", icon: Newspaper, tone: "violet" as const },
  { title: "Divulgação de Sistema", description: "Apresente mudanças e novas rotinas.", icon: MonitorUp, tone: "amber" as const },
  { title: "Nova Campanha", description: "Estruture uma campanha interna.", icon: Sparkles, tone: "blue" as const },
  { title: "Ver Biblioteca", description: "Consulte conteúdos e materiais publicados.", icon: BookOpen, href: "/biblioteca", tone: "slate" as const },
  { title: "Revisar Aprovações", description: "Trate conteúdos aguardando decisão.", icon: CheckSquare2, href: "/gestao-editorial", tone: "amber" as const },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[22px] bg-[#0b2b50] px-6 py-7 text-white shadow-xl shadow-blue-950/15 md:px-8 md:py-8">
        <div className="absolute -right-16 -top-28 size-72 rounded-full border-[46px] border-blue-400/10" /><div className="absolute bottom-0 right-1/4 h-24 w-48 skew-x-[-24deg] bg-blue-500/5" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div><p className="mb-2 text-xs font-bold uppercase tracking-[0.17em] text-sky-300">Visão geral · 22 de setembro</p><h2 className="text-3xl font-bold tracking-tight md:text-4xl">Bom dia, Jonathan.</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100/80 md:text-base">Gerencie comunicados, newsletters e materiais visuais da Contabilidade em um só ambiente.</p></div>
          <Link href="/studio" className="inline-flex w-fit items-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-900 shadow-lg transition hover:bg-blue-50"><FilePlus2 size={18} />Começar nova criação<ArrowRight size={16} /></Link>
        </div>
      </section>

      <section aria-label="Indicadores" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{dashboardStats.map((stat) => <StatCard key={stat.title} {...stat} />)}</section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,.7fr)]">
        <SectionCard title="Conteúdos recentes" description="Acompanhe as últimas movimentações editoriais" action={<Link href="/biblioteca" className="text-xs font-bold text-blue-700 hover:underline">Ver todos</Link>}><RecentContentTable /></SectionCard>
        <SectionCard title="Fluxo editorial" description="Volume atual por etapa"><WorkflowOverview /><div className="mx-5 mb-5 rounded-xl bg-blue-50 p-4 md:mx-6"><p className="text-xs font-bold text-blue-900">Taxa de publicação</p><div className="mt-2 flex items-end gap-2"><span className="text-2xl font-bold text-blue-800">52,6%</span><span className="pb-1 text-[11px] text-blue-600">do fluxo total</span></div></div></SectionCard>
      </section>

      <section><div className="mb-4 flex items-end justify-between"><div><p className="eyebrow">Atalhos</p><h3 className="mt-1 text-xl font-bold text-slate-900">O que você deseja criar?</h3></div><span className="hidden text-xs text-slate-400 md:block">Ações mais utilizadas pelo time</span></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{actions.map(({ href = "/studio", ...action }) => <QuickActionCard key={action.title} href={href} {...action} />)}</div></section>
    </div>
  );
}
