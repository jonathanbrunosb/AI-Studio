"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, Plus, Search } from "lucide-react";
import { getPageTitle } from "@/lib/navigation";
import { logoutAction } from "@/app/auth/actions";
import type { AppRole } from "@/lib/auth/authorization";

export function Topbar({ onOpenMobile, user }: { onOpenMobile: () => void; user: { fullName: string; email: string; roles: AppRole[] } }) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const initials = user.fullName.split(" ").filter(Boolean).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-[84px] items-center border-b border-slate-200/70 bg-white/90 px-4 backdrop-blur-xl md:px-6 lg:px-8">
      <button onClick={onOpenMobile} aria-label="Abrir menu" className="mr-3 grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-700 lg:hidden"><Menu size={20} /></button>
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="hidden text-xs text-slate-500 sm:block">Ambiente integrado para criação, gestão e aprovação de conteúdos.</p>
      </div>
      <div className="ml-auto flex items-center gap-2 md:gap-3">
        <label className="hidden h-10 w-[min(24vw,300px)] items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-400 xl:flex">
          <Search size={17} /><input aria-label="Buscar conteúdos" placeholder="Buscar no AI Studio..." className="w-full bg-transparent text-sm text-slate-700 outline-none" />
          <kbd className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px]">⌘ K</kbd>
        </label>
        {user.roles.some((role) => role === "admin" || role === "editor") && <Link href="/studio" aria-label="Criar conteúdo" className="primary-button h-10 px-3 md:px-4"><Plus size={17} /><span className="hidden sm:inline">Criar conteúdo</span></Link>}
        <button aria-label="Notificações" className="relative grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50"><Bell size={18} /><span className="absolute right-2 top-2 size-2 rounded-full border-2 border-white bg-amber-500" /></button>
        <div className="flex items-center gap-2 rounded-xl pl-1 text-left">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-blue-700 to-blue-500 text-sm font-bold text-white">{initials || "AI"}</span>
          <span className="hidden 2xl:block"><span className="block max-w-40 truncate text-sm font-bold text-slate-800">{user.fullName}</span><span className="block max-w-40 truncate text-[11px] text-slate-500">{user.email}</span></span>
          <form action={logoutAction}><button title="Encerrar sessão" aria-label="Encerrar sessão" className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"><LogOut size={16} /></button></form>
        </div>
      </div>
    </header>
  );
}
