import { ArrowRight, CheckCircle2, Archive, GitBranchPlus, MessageSquareWarning, Send } from "lucide-react";
import { contentStatusLabels } from "@/types/content";
import { editorialActionLabels, type EditorialAction } from "@/lib/editorial/workflow-rules";
import type { HistoryEvent } from "@/lib/editorial/workflow-service";

const icons: Record<EditorialAction, typeof Send> = { submitted: Send, approved: CheckCircle2, changes_requested: MessageSquareWarning, new_version: GitBranchPlus, archived: Archive };
const tones: Record<EditorialAction, string> = { submitted: "bg-amber-50 text-amber-700", approved: "bg-blue-50 text-blue-700", changes_requested: "bg-rose-50 text-rose-700", new_version: "bg-slate-100 text-slate-600", archived: "bg-slate-100 text-slate-500" };

export function EditorialHistory({ events, showContent = false, compact = false }: { events: HistoryEvent[]; showContent?: boolean; compact?: boolean }) {
  if (!events.length) return <p className="p-6 text-center text-sm text-slate-500">Nenhum evento editorial registrado.</p>;
  return <ol className="relative space-y-4 border-l border-slate-200 pl-5">{events.map((event) => {
    const Icon = icons[event.action] ?? Send;
    return <li key={event.id} className="relative">
      <span className={`absolute -left-[31px] grid size-5 place-items-center rounded-full ring-4 ring-white ${tones[event.action]}`}><Icon size={11} /></span>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-xs font-bold text-slate-800">{editorialActionLabels[event.action] ?? event.action}</p>
        {event.versionNumber != null && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">v{event.versionNumber}</span>}
        {event.cycle != null && event.cycle > 0 && <span className="text-[10px] text-slate-400">ciclo {event.cycle}</span>}
      </div>
      {showContent && event.contentTitle && <a href={`/gestao-editorial/revisao/${event.contentId}`} className="mt-0.5 block text-xs font-semibold text-blue-700 hover:underline">{event.contentTitle}</a>}
      <p className="mt-0.5 text-[11px] text-slate-500">{event.actorName} · {new Date(event.createdAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
      {!compact && event.fromStatus && event.toStatus && <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">{contentStatusLabels[event.fromStatus]}<ArrowRight size={11} />{contentStatusLabels[event.toStatus]}</p>}
      {event.comment && <p className="mt-1.5 whitespace-pre-line rounded-lg bg-slate-50 p-2 text-xs leading-5 text-slate-700">{event.comment}</p>}
    </li>;
  })}</ol>;
}
