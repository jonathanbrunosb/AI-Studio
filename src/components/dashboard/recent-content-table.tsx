import { Eye, MoreHorizontal } from "lucide-react";
import { ContentStatusBadge } from "@/components/shared/content-status-badge";
import { contentCategoryLabels, type ContentItem } from "@/types/content";

export function RecentContentTable({ items }: { items: ContentItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-left">
        <thead><tr className="border-b border-slate-100 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-slate-500"><th className="px-6 py-3">Conteúdo</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Ações</th></tr></thead>
        <tbody>{items.map((item) => <tr key={item.id} className="group border-b border-slate-100 last:border-0 hover:bg-blue-50/35"><td className="px-6 py-4"><div className="flex items-center gap-3"><span className="h-9 w-1 rounded-full" style={{ backgroundColor: item.accent }} /><div><p className="font-bold text-slate-800">{item.title}</p><p className="mt-0.5 text-[11px] text-slate-400">{item.id.slice(0, 8).toUpperCase()}</p></div></div></td><td className="px-4 py-4 text-sm text-slate-600">{contentCategoryLabels[item.category]}</td><td className="px-4 py-4"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{item.owner.split(" ").map(n => n[0]).join("").slice(0,2)}</span><span className="text-sm text-slate-600">{item.owner}</span></div></td><td className="whitespace-nowrap px-4 py-4 text-sm text-slate-500">{item.date}</td><td className="px-4 py-4"><ContentStatusBadge status={item.status} /></td><td className="px-5 py-4"><div className="flex justify-end gap-1"><a href={`/studio?id=${item.id}`} title="Visualizar" className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-blue-50 hover:text-blue-700"><Eye size={16} /></a><button title="Mais ações" className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><MoreHorizontal size={17} /></button></div></td></tr>)}</tbody>
      </table>
    </div>
  );
}
