"use client";

import { useState } from "react";
import { Circle, Image, Layers3, LayoutTemplate, Minus, RectangleHorizontal, Settings2, Type } from "lucide-react";
import type { LayerItem } from "@/hooks/use-editor";
import type { MediaAsset, TemplateOption } from "@/lib/editor/editor-types";
import { ImageUploader } from "./image-uploader";
import { LayersPanel } from "./layers-panel";
import { TemplateSelector } from "./template-selector";

type Tool = "templates" | "text" | "images" | "elements" | "layers" | "settings";

export function EditorSidebar({ contentId, userId, media, templates, layers, onMedia, onImage, onText, onShape, onLayerSelect, onLayerAction, onTemplate }: {
  contentId: string; userId: string; media: MediaAsset[]; templates: TemplateOption[]; layers: LayerItem[];
  onMedia: (asset: MediaAsset) => void; onImage: (asset: MediaAsset) => void;
  onText: (kind: "title" | "subtitle" | "body") => void; onShape: (kind: "rect" | "circle" | "line") => void;
  onLayerSelect: (id: string) => void; onLayerAction: (id: string, action: "visibility" | "lock" | "front" | "back" | "delete") => void;
  onTemplate: (template: TemplateOption, width: number, height: number) => void;
}) {
  const [tool, setTool] = useState<Tool>("text");
  const items = [
    ["templates", LayoutTemplate, "Templates"], ["text", Type, "Texto"], ["images", Image, "Imagens"],
    ["elements", RectangleHorizontal, "Elementos"], ["layers", Layers3, "Camadas"], ["settings", Settings2, "Ajuda"],
  ] as const;
  return <aside className="flex w-[330px] shrink-0 border-r border-slate-200 bg-white">
    <nav className="w-[82px] shrink-0 border-r border-slate-100 p-2">{items.map(([id, Icon, label]) => <button key={id} onClick={() => setTool(id)} className={`mb-1 flex w-full flex-col items-center gap-1 rounded-lg px-1 py-3 text-[10px] font-bold ${tool === id ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:bg-slate-50"}`}><Icon size={18} />{label}</button>)}</nav>
    <div className="max-h-[calc(100vh-210px)] flex-1 overflow-y-auto p-4">
      <h3 className="mb-4 text-sm font-bold text-slate-800">{items.find(([id]) => id === tool)?.[2]}</h3>
      {tool === "templates" && <TemplateSelector templates={templates} onApply={onTemplate} />}
      {tool === "text" && <div className="space-y-2"><ToolButton onClick={() => onText("title")} label="Adicionar título" /><ToolButton onClick={() => onText("subtitle")} label="Adicionar subtítulo" /><ToolButton onClick={() => onText("body")} label="Adicionar texto" /></div>}
      {tool === "images" && <ImageUploader contentId={contentId} userId={userId} assets={media} onUploaded={onMedia} onInsert={onImage} />}
      {tool === "elements" && <div className="grid grid-cols-2 gap-2"><ToolButton icon={<RectangleHorizontal size={18} />} onClick={() => onShape("rect")} label="Retângulo" /><ToolButton icon={<Circle size={18} />} onClick={() => onShape("circle")} label="Círculo" /><ToolButton icon={<Minus size={18} />} onClick={() => onShape("line")} label="Linha" /></div>}
      {tool === "layers" && <LayersPanel layers={layers} onSelect={onLayerSelect} onAction={onLayerAction} />}
      {tool === "settings" && <div className="space-y-3 text-xs leading-5 text-slate-500"><p><strong className="text-slate-700">Atalhos</strong></p><p>Ctrl+Z: desfazer<br />Ctrl+Y: refazer<br />Ctrl+D: duplicar<br />Delete: excluir</p><p>Use o painel de propriedades para ajustar dimensões, cores e tipografia.</p></div>}
    </div>
  </aside>;
}

function ToolButton({ label, onClick, icon }: { label: string; onClick: () => void; icon?: React.ReactNode }) {
  return <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:border-blue-300 hover:bg-blue-50" onClick={onClick}>{icon}{label}</button>;
}
