import { contentStatusLabels, type ContentStatus } from "@/types/content";

const styles: Record<ContentStatus, string> = {
  draft: "bg-slate-100 text-slate-600 ring-slate-200",
  in_review: "bg-amber-50 text-amber-700 ring-amber-200",
  changes_requested: "bg-rose-50 text-rose-700 ring-rose-200",
  approved: "bg-blue-50 text-blue-700 ring-blue-200",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  archived: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function ContentStatusBadge({ status }: { status: ContentStatus }) {
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold ring-1 ring-inset ${styles[status]}`}><span className="size-1.5 rounded-full bg-current" />{contentStatusLabels[status]}</span>;
}
