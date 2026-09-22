"use client";

import type { EditorProject } from "@/lib/editor/editor-types";
import type { SelectedProperties } from "@/hooks/use-editor";

export function PropertiesPanel({ selected, project, onUpdate, onBackground, onResize }: {
  selected: SelectedProperties | null; project: EditorProject;
  onUpdate: (changes: Record<string, unknown>) => void;
  onBackground: (color: string) => void; onResize: (width: number, height: number) => void;
}) {
  if (!selected) return <aside className="w-[286px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
    <p className="eyebrow">Peça visual</p><h3 className="mt-1 font-bold">Configurações gerais</h3>
    <label className="mt-5 block text-xs font-bold text-slate-600">Cor de fundo<input type="color" value={project.canvas.backgroundColor} onChange={(e) => onBackground(e.target.value)} className="mt-2 h-10 w-full" /></label>
    <div className="mt-4 grid grid-cols-2 gap-2"><NumberField label="Largura" value={project.canvas.width} onChange={(width) => onResize(width, project.canvas.height)} /><NumberField label="Altura" value={project.canvas.height} onChange={(height) => onResize(project.canvas.width, height)} /></div>
    <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">Alterar as dimensões mantém os elementos em suas coordenadas atuais. Revise a composição após a mudança.</p>
  </aside>;

  const isText = ["Textbox", "IText", "Text", "textbox", "i-text", "text"].includes(selected.type);
  return <aside className="w-[286px] shrink-0 overflow-y-auto border-l border-slate-200 bg-white p-4">
    <p className="eyebrow">Elemento selecionado</p><h3 className="mt-1 truncate font-bold">{selected.name}</h3>
    {isText && <div className="mt-5 space-y-3">
      <label className="block text-xs font-bold text-slate-600">Conteúdo<textarea rows={4} className="field mt-1" value={selected.text ?? ""} onChange={(e) => onUpdate({ text: e.target.value })} /></label>
      <label className="block text-xs font-bold text-slate-600">Fonte<select className="field mt-1" value={selected.fontFamily ?? "Calibri"} onChange={(e) => onUpdate({ fontFamily: e.target.value })}><option>Calibri</option><option>Segoe UI</option><option>Arial</option></select></label>
      <div className="grid grid-cols-2 gap-2"><NumberField label="Tamanho" value={selected.fontSize ?? 24} onChange={(fontSize) => onUpdate({ fontSize })} /><NumberField label="Espaçamento" value={selected.charSpacing ?? 0} onChange={(charSpacing) => onUpdate({ charSpacing })} /></div>
      <div className="grid grid-cols-2 gap-2"><button className={`secondary-button ${selected.fontWeight === "bold" ? "bg-blue-50 text-blue-700" : ""}`} onClick={() => onUpdate({ fontWeight: selected.fontWeight === "bold" ? "normal" : "bold" })}>Negrito</button><button className={`secondary-button ${selected.fontStyle === "italic" ? "bg-blue-50 text-blue-700" : ""}`} onClick={() => onUpdate({ fontStyle: selected.fontStyle === "italic" ? "normal" : "italic" })}>Itálico</button></div>
      <label className="block text-xs font-bold text-slate-600">Alinhamento<select className="field mt-1" value={selected.textAlign ?? "left"} onChange={(e) => onUpdate({ textAlign: e.target.value })}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option></select></label>
    </div>}
    <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
      <div className="grid grid-cols-2 gap-2"><NumberField label="X" value={selected.left} onChange={(left) => onUpdate({ left })} /><NumberField label="Y" value={selected.top} onChange={(top) => onUpdate({ top })} /></div>
      <div className="grid grid-cols-2 gap-2"><NumberField label="Largura" value={selected.width} onChange={(width) => onUpdate({ width })} /><NumberField label="Altura" value={selected.height} onChange={(height) => onUpdate({ height })} /></div>
      <div className="grid grid-cols-2 gap-2"><NumberField label="Rotação" value={selected.angle} onChange={(angle) => onUpdate({ angle })} /><NumberField label="Opacidade %" value={Math.round(selected.opacity * 100)} onChange={(opacity) => onUpdate({ opacity: Math.max(0, Math.min(100, opacity)) / 100 })} /></div>
      <label className="block text-xs font-bold text-slate-600">Cor / preenchimento<input type="color" className="mt-2 h-10 w-full" value={selected.fill.startsWith("#") ? selected.fill : "#1769aa"} onChange={(e) => onUpdate({ fill: e.target.value })} /></label>
      {!isText && <><label className="block text-xs font-bold text-slate-600">Cor da borda<input type="color" className="mt-2 h-10 w-full" value={selected.stroke.startsWith("#") ? selected.stroke : "#0b2b50"} onChange={(e) => onUpdate({ stroke: e.target.value })} /></label><NumberField label="Espessura da borda" value={selected.strokeWidth} onChange={(strokeWidth) => onUpdate({ strokeWidth })} /></>}
    </div>
  </aside>;
}

function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  const rounded = Math.round(value);
  return <label className="block text-xs font-bold text-slate-600">{label}<input key={rounded} type="number" className="field mt-1 px-2" defaultValue={rounded} onBlur={(event) => {
    const raw = event.currentTarget.value.trim();
    const parsed = Number(raw);
    if (raw && Number.isFinite(parsed)) onChange(parsed);
    else event.currentTarget.value = String(rounded);
  }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} /></label>;
}
