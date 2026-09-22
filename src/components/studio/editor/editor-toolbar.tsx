"use client";

import { Copy, Download, Group, Redo2, Save, Trash2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import type { SaveStatus } from "@/lib/editor/editor-types";

const labels: Record<SaveStatus, string> = {
  dirty: "Alterações não salvas", saving: "Salvando…", saved: "Todas as alterações salvas", error: "Erro ao salvar",
};

export function EditorToolbar({ status, zoom, canUndo, canRedo, onZoom, onUndo, onRedo, onDuplicate, onDelete, onGroup, onSave, onExport }: {
  status: SaveStatus; zoom: number; canUndo: boolean; canRedo: boolean;
  onZoom: (zoom: number) => void; onUndo: () => void; onRedo: () => void;
  onDuplicate: () => void; onDelete: () => void; onGroup: () => void;
  onSave: () => void; onExport: () => void;
}) {
  const button = "grid size-9 place-items-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-35";
  return <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white p-3">
    <button className={button} onClick={onUndo} disabled={!canUndo} title="Desfazer (Ctrl+Z)"><Undo2 size={16} /></button>
    <button className={button} onClick={onRedo} disabled={!canRedo} title="Refazer (Ctrl+Y)"><Redo2 size={16} /></button>
    <span className="mx-1 h-6 w-px bg-slate-200" />
    <button className={button} onClick={onDuplicate} title="Duplicar (Ctrl+D)"><Copy size={16} /></button>
    <button className={button} onClick={onGroup} title="Agrupar seleção"><Group size={16} /></button>
    <button className={button} onClick={onDelete} title="Excluir (Delete)"><Trash2 size={16} /></button>
    <div className="ml-auto flex items-center gap-2">
      <button className={button} onClick={() => onZoom(Math.max(.1, zoom - .1))} title="Reduzir zoom"><ZoomOut size={16} /></button>
      <span className="w-12 text-center text-xs font-bold text-slate-600">{Math.round(zoom * 100)}%</span>
      <button className={button} onClick={() => onZoom(Math.min(1, zoom + .1))} title="Aumentar zoom"><ZoomIn size={16} /></button>
      <span className={`ml-2 text-xs font-semibold ${status === "error" ? "text-rose-600" : status === "saved" ? "text-blue-700" : "text-amber-700"}`}>{labels[status]}</span>
      <button className="secondary-button ml-2" onClick={onSave}><Save size={15} />Salvar versão</button>
      <button className="primary-button" onClick={onExport}><Download size={15} />Exportar</button>
    </div>
  </div>;
}
