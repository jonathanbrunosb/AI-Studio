import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({ title, description, action, children, className }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("surface-card overflow-hidden", className)}>
      {(title || description || action) && <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 md:px-6"><div>{title && <h3 className="text-base font-bold text-slate-900">{title}</h3>}{description && <p className="mt-1 text-xs text-slate-500">{description}</p>}</div>{action}</div>}
      {children}
    </section>
  );
}
