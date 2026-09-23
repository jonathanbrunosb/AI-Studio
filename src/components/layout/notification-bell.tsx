"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { markNotificationsReadAction } from "@/app/(protected)/gestao-editorial/actions";

export type NotificationItem = { id: string; content_id: string | null; type: string; title: string; message: string; created_at: string; read_at: string | null };

export function NotificationBell({ items, unread }: { items: NotificationItem[]; unread: number }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function markRead(ids: string[] | "all") {
    startTransition(async () => { await markNotificationsReadAction(ids); router.refresh(); });
  }

  const target = (item: NotificationItem) => !item.content_id ? "/gestao-editorial"
    : item.type === "review_requested" || item.type === "resubmitted" ? `/gestao-editorial/revisao/${item.content_id}` : `/studio?id=${item.content_id}`;

  return <div ref={ref} className="relative">
    <button aria-label={`Notificações${unread ? ` (${unread} não lidas)` : ""}`} aria-expanded={open} onClick={() => setOpen((value) => !value)} className="relative grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50">
      <Bell size={18} />
      {unread > 0 && <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? "99+" : unread}</span>}
    </button>
    {open && <div className="absolute right-0 top-12 z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><p className="text-sm font-bold text-slate-800">Notificações</p>{unread > 0 && <button className="flex items-center gap-1 text-[11px] font-bold text-blue-700" onClick={() => markRead("all")}><CheckCheck size={13} />Marcar todas como lidas</button>}</div>
      <div className="max-h-96 overflow-y-auto">{items.length ? items.map((item) => <Link key={item.id} href={target(item)} onClick={() => { setOpen(false); if (!item.read_at) markRead([item.id]); }} className={`block border-b border-slate-50 px-4 py-3 hover:bg-slate-50 ${item.read_at ? "" : "bg-blue-50/50"}`}>
        <p className="flex items-center gap-2 text-xs font-bold text-slate-800">{!item.read_at && <span className="size-2 rounded-full bg-blue-600" />}{item.title}</p>
        <p className="mt-1 line-clamp-2 text-xs text-slate-600">{item.message}</p>
        <p className="mt-1 text-[10px] text-slate-400">{new Date(item.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
      </Link>) : <p className="p-6 text-center text-xs text-slate-400">Nenhuma notificação.</p>}</div>
    </div>}
  </div>;
}
