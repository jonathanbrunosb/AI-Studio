import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

export function QuickActionCard({ title, description, href, icon: Icon, tone = "blue" }: { title: string; description: string; href: string; icon: LucideIcon; tone?: "blue" | "violet" | "amber" | "slate" }) {
  const tones = { blue: "bg-blue-50 text-blue-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700", slate: "bg-slate-100 text-slate-700" };
  return <Link href={href} className="group flex min-h-28 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/60"><span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tones[tone]}`}><Icon size={19} /></span><span className="min-w-0"><span className="flex items-start justify-between gap-2 font-bold text-slate-800">{title}<ArrowUpRight size={16} className="shrink-0 text-slate-300 transition group-hover:text-blue-600" /></span><span className="mt-1 block text-xs leading-4 text-slate-500">{description}</span></span></Link>;
}
