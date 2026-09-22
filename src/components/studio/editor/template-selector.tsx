"use client";

import { editorFormats } from "@/lib/editor/editor-types";
import type { TemplateOption } from "@/lib/editor/editor-types";
import { inferFormat } from "@/lib/editor/editor-utils";

export function TemplateSelector({ templates, onApply }: { templates: TemplateOption[]; onApply: (template: TemplateOption, width: number, height: number) => void }) {
  return <div className="space-y-2">{templates.map((template) => {
    const config = template.configuration && typeof template.configuration === "object" ? template.configuration as Record<string, unknown> : {};
    const format = editorFormats[inferFormat(Number(config.width) || 1080, Number(config.height) || 1080)];
    return <button key={template.id} className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:border-blue-300" onClick={() => {
      if (window.confirm("Aplicar este modelo substituirá a composição visual atual. Deseja continuar?")) onApply(template, format.width, format.height);
    }}><span className="block text-xs font-bold text-slate-700">{template.name}</span><span className="mt-1 block text-[10px] text-slate-400">{format.width} × {format.height}px</span></button>;
  })}</div>;
}
