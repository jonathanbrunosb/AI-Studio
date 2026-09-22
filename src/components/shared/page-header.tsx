import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">{eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}<h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-[30px]">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-500 md:text-base">{description}</p></div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
