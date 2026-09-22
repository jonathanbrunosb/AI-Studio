import { ArrowRight, LayoutTemplate, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";

const templates = [
  { name: "Comunicado Corporativo", description: "Mensagens objetivas para orientações, prazos e avisos internos.", color: "from-blue-950 to-blue-600", tag: "Comunicados" },
  { name: "Newsletter Contábil", description: "Estrutura editorial para notícias, indicadores e destaques mensais.", color: "from-indigo-900 to-violet-500", tag: "Newsletters" },
  { name: "Divulgação de Sistemas", description: "Apresente atualizações, novos recursos e instruções operacionais.", color: "from-slate-800 to-sky-500", tag: "Sistemas" },
  { name: "Campanha Interna", description: "Formato versátil para mobilização e comunicação institucional.", color: "from-blue-800 to-cyan-500", tag: "Campanhas" },
];

export default function TemplatesPage() {
  return <div><PageHeader eyebrow="Padronização visual" title="Modelos" description="Comece com estruturas aprovadas e preserve a consistência da comunicação contábil." actions={<button className="secondary-button"><Plus size={16} />Solicitar modelo</button>} /><div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">{templates.map((template, index) => <article key={template.name} className="surface-card overflow-hidden"><div className={`relative h-56 bg-gradient-to-br ${template.color} p-5 text-white`}><span className="grid size-10 place-items-center rounded-xl bg-white/15 backdrop-blur"><LayoutTemplate size={20} /></span><div className="absolute inset-x-5 bottom-5 rounded-xl border border-white/15 bg-white/10 p-4 backdrop-blur"><p className="text-[10px] font-bold uppercase tracking-[.15em] text-white/65">{template.tag}</p><p className="mt-1 text-xl font-bold leading-tight">{template.name}</p></div><span className="absolute right-4 top-4 text-5xl font-bold text-white/5">0{index + 1}</span></div><div className="p-5"><p className="min-h-12 text-sm leading-5 text-slate-500">{template.description}</p><button className="primary-button mt-5 w-full">Usar modelo<ArrowRight size={16} /></button></div></article>)}</div></div>;
}
