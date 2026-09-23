import { ArrowUpRight, CheckCircle2, Clock3, FileText, Layers3, MessageSquareWarning } from "lucide-react";

const tones = {
  blue: { icon: Layers3, box: "bg-blue-50 text-blue-700", line: "bg-blue-600" },
  slate: { icon: FileText, box: "bg-slate-100 text-slate-600", line: "bg-slate-500" },
  amber: { icon: Clock3, box: "bg-amber-50 text-amber-700", line: "bg-amber-500" },
  indigo: { icon: CheckCircle2, box: "bg-indigo-50 text-indigo-700", line: "bg-indigo-500" },
  rose: { icon: MessageSquareWarning, box: "bg-rose-50 text-rose-700", line: "bg-rose-400" },
  emerald: { icon: ArrowUpRight, box: "bg-emerald-50 text-emerald-700", line: "bg-emerald-500" },
};

export function StatCard({ title, value, change, tone }: { title: string; value: number; change: string; tone: keyof typeof tones }) {
  const style = tones[tone]; const Icon = style.icon;
  return <article className="surface-card relative min-w-0 overflow-hidden p-5"><span className={`absolute inset-x-0 top-0 h-1 ${style.line}`} /><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-slate-500">{title}</p><p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{value}</p></div><span className={`grid size-10 place-items-center rounded-xl ${style.box}`}><Icon size={19} /></span></div><p className="mt-4 text-xs font-semibold text-slate-500">{change}</p></article>;
}
