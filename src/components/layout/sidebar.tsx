"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Layers3, X } from "lucide-react";
import { navigationItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/lib/auth/authorization";

interface SidebarProps { collapsed: boolean; mobileOpen: boolean; onCloseMobile: () => void; onToggle: () => void; roles: AppRole[] }

export function Sidebar({ collapsed, mobileOpen, onCloseMobile, onToggle, roles }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = navigationItems.filter((item) => item.href !== "/administracao" || roles.includes("admin"));

  return (
    <>
      {mobileOpen && <button aria-label="Fechar menu" className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm lg:hidden" onClick={onCloseMobile} />}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden bg-[#081e38] text-white shadow-2xl transition-all duration-300",
        collapsed ? "w-[84px]" : "w-[268px]",
        mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
      )}>
        <div className="flex h-[84px] items-center gap-3 border-b border-white/10 px-5">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 shadow-lg shadow-blue-950/40"><Layers3 size={22} /></div>
          {!collapsed && <div className="min-w-0"><p className="truncate text-[17px] font-bold leading-tight">AI Studio</p><p className="mt-0.5 truncate text-xs text-blue-200/75">Comunicação Contábil</p></div>}
          <button aria-label="Fechar menu" onClick={onCloseMobile} className="ml-auto rounded-lg p-2 text-blue-100 lg:hidden"><X size={20} /></button>
        </div>

        <nav className="flex-1 space-y-1.5 overflow-y-auto px-3 py-6" aria-label="Navegação principal">
          {!collapsed && <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-blue-200/50">Workspace</p>}
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} title={collapsed ? item.label : undefined} onClick={onCloseMobile}
                className={cn("group relative flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition", active ? "bg-blue-600 text-white shadow-lg shadow-blue-950/30" : "text-blue-100/75 hover:bg-white/7 hover:text-white")}>
                {active && <span className="absolute -left-3 h-6 w-1 rounded-r-full bg-sky-300" />}
                <Icon size={19} className="shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          {!collapsed && <div className="mb-3 rounded-xl border border-white/8 bg-white/5 p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Ambiente corporativo</p><p className="mt-1.5 text-xs leading-4 text-blue-100/65">AI Studio — Comunicação Contábil</p></div>}
          <button onClick={onToggle} className="hidden h-10 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-blue-100/65 transition hover:bg-white/7 hover:text-white lg:flex">
            {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /> Recolher menu</>}
          </button>
        </div>
      </aside>
    </>
  );
}
