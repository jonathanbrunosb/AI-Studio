"use client";

import { ArrowDownToLine, ArrowUpToLine, Eye, EyeOff, Lock, Trash2, Unlock } from "lucide-react";
import type { LayerItem } from "@/hooks/use-editor";
import type { LucideIcon } from "lucide-react";

type LayerAction = "visibility" | "lock" | "front" | "back" | "delete";

export function LayersPanel({ layers, onSelect, onAction }: {
  layers: LayerItem[]; onSelect: (id: string) => void;
  onAction: (id: string, action: "visibility" | "lock" | "front" | "back" | "delete") => void;
}) {
  return <div className="space-y-2">{layers.map((layer) => <div key={layer.id} className="rounded-xl border border-slate-200 bg-white p-3">
    <button className="w-full truncate text-left text-xs font-bold text-slate-700" onClick={() => onSelect(layer.id)}>{layer.name}</button>
    <p className="mt-1 text-[10px] uppercase text-slate-400">{layer.type}</p>
    <div className="mt-2 flex gap-1">{([
      [layer.visible ? Eye : EyeOff, "visibility" as const, layer.visible ? "Ocultar" : "Exibir"],
      [layer.locked ? Lock : Unlock, "lock" as const, layer.locked ? "Desbloquear" : "Bloquear"],
      [ArrowUpToLine, "front" as const, "Trazer à frente"], [ArrowDownToLine, "back" as const, "Enviar para trás"],
      [Trash2, "delete" as const, "Excluir"],
    ] satisfies Array<[LucideIcon, LayerAction, string]>).map(([Icon, action, title]) => <button key={action} title={title} className="grid size-7 place-items-center rounded text-slate-500 hover:bg-slate-100" onClick={() => onAction(layer.id, action)}><Icon size={13} /></button>)}</div>
  </div>)}{!layers.length && <p className="py-6 text-center text-xs text-slate-400">Nenhuma camada.</p>}</div>;
}
