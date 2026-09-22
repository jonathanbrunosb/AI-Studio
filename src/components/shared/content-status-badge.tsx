import type { ContentStatus } from "@/types/content";

const styles: Record<ContentStatus, string> = {
  "Rascunho": "bg-slate-100 text-slate-600 ring-slate-200",
  "Em revisão": "bg-amber-50 text-amber-700 ring-amber-200",
  "Ajustes solicitados": "bg-rose-50 text-rose-700 ring-rose-200",
  "Aprovado": "bg-blue-50 text-blue-700 ring-blue-200",
  "Publicado": "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${styles[status]}`}><span className="size-1.5 rounded-full bg-current" />{status}</span>;
}
