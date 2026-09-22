import { Activity, ArrowUpRight, Database, Palette, Settings2, ShieldCheck, Users } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";

const sections = [
  { title: "Usuários e perfis", description: "Gerencie acessos, funções e responsabilidades do time.", icon: Users, meta: "18 usuários mockados" },
  { title: "Integrações", description: "Prepare conexões com Supabase, Railway e serviços externos.", icon: Database, meta: "Nenhuma integração ativa" },
  { title: "Configurações visuais", description: "Cores, tipografia, assinaturas e identidade dos materiais.", icon: Palette, meta: "Tema corporativo ativo" },
  { title: "Auditoria", description: "Consulte eventos, decisões editoriais e histórico de alterações.", icon: ShieldCheck, meta: "Dados demonstrativos" },
  { title: "Parâmetros da plataforma", description: "Ajuste categorias, formatos, status e regras do fluxo.", icon: Settings2, meta: "Configuração padrão" },
  { title: "Saúde do ambiente", description: "Visão futura de disponibilidade, serviços e integrações.", icon: Activity, meta: "Ambiente de desenvolvimento" },
];

export default function AdminPage() {
  return <div><PageHeader eyebrow="Configuração" title="Administração" description="Central de gestão da plataforma, preparada para receber controles e integrações futuras." /><div className="mb-5 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900"><strong>Ambiente seguro de demonstração.</strong> As opções abaixo são estruturais e ainda não persistem alterações.</div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{sections.map(({ title, description, icon: Icon, meta }) => <button key={title} className="surface-card group p-5 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl"><div className="flex items-start justify-between"><span className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon size={21} /></span><ArrowUpRight size={18} className="text-slate-300 group-hover:text-blue-600" /></div><h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3><p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">{description}</p><p className="mt-5 border-t border-slate-100 pt-3 text-xs font-semibold text-slate-400">{meta}</p></button>)}</div></div>;
}
