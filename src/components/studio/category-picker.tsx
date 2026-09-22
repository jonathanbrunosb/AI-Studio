import Link from "next/link";
import { ArrowRight, Megaphone, Newspaper, MonitorUp, Sparkles } from "lucide-react";
import { contentCategoryLabels } from "@/types/content";
import { categories } from "@/lib/content/editorial";

const icons = [Megaphone, Newspaper, MonitorUp, Sparkles];
const descriptions = ["Orientações, avisos e rotinas da Contabilidade.", "Notícias relevantes, fontes e atualização contábil.", "Novas soluções, funcionalidades e melhorias.", "Mobilização e participação dos colaboradores."];
export function CategoryPicker() {
  return <div className="grid gap-5 md:grid-cols-2">{categories.map((category, index) => {
    const Icon = icons[index];
    return <Link href={`/studio?category=${category}`} key={category} className="surface-card group flex gap-5 p-7 transition hover:border-blue-300 hover:shadow-lg">
      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon size={24} /></span>
      <div><h3 className="text-lg font-bold text-slate-900">{contentCategoryLabels[category]}</h3><p className="mt-2 text-sm leading-6 text-slate-500">{descriptions[index]}</p><span className="mt-5 flex items-center gap-2 text-xs font-bold text-blue-700">Começar material<ArrowRight size={14} /></span></div>
    </Link>;
  })}</div>;
}
