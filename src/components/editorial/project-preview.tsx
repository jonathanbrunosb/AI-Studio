"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { LoaderCircle, Maximize2, X } from "lucide-react";

type Snapshot = { canvas?: { width?: number; height?: number; backgroundColor?: string }; elements?: unknown[] } | null;

/** Renderiza a composição salva (somente leitura), preservando dimensões e proporção. */
export function ProjectPreview({ snapshot, className = "", zoomable = false, label = "Pré-visualização da peça" }: {
  snapshot: unknown; className?: string; zoomable?: boolean; label?: string;
}) {
  const project = snapshot as Snapshot;
  const width = Number(project?.canvas?.width) || 1080;
  const height = Number(project?.canvas?.height) || 1080;
  const [image, setImage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!project?.elements) { setFailed(true); return; }
      const [{ StaticCanvas }] = await Promise.all([import("fabric"), import("@/lib/editor/fabric-setup")]);
      const element = document.createElement("canvas");
      const canvas = new StaticCanvas(element, { width, height, backgroundColor: project.canvas?.backgroundColor ?? "#ffffff", enableRetinaScaling: false });
      try {
        await canvas.loadFromJSON({ objects: project.elements });
        canvas.renderAll();
        const url = canvas.toDataURL({ format: "png", multiplier: 1, enableRetinaScaling: false });
        if (!cancelled) setImage(url);
      } catch {
        if (!cancelled) setFailed(true);
      } finally {
        void canvas.dispose();
      }
    }
    void render();
    return () => { cancelled = true; };
  }, [project, width, height]);

  return <>
    <div className={`relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
      {image ? <img src={image} alt={label} className="size-full object-contain" />
        : failed ? <span className="absolute inset-0 grid place-items-center p-2 text-center text-[10px] text-slate-400">Pré-visualização indisponível</span>
          : <span className="absolute inset-0 grid place-items-center"><LoaderCircle size={16} className="animate-spin text-slate-400" /></span>}
      {zoomable && image && <button onClick={() => setZoom(true)} className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-1 text-[11px] font-bold text-slate-700 shadow"><Maximize2 size={13} />Ampliar</button>}
    </div>
    {zoom && image && <div role="dialog" aria-modal="true" aria-label="Visualização ampliada" className="fixed inset-0 z-[90] overflow-auto bg-slate-950/80 p-4" onClick={() => setZoom(false)}>
      <button className="fixed right-4 top-4 grid size-10 place-items-center rounded-full bg-white text-slate-700" onClick={() => setZoom(false)} aria-label="Fechar"><X size={18} /></button>
      <p className="mb-3 text-center text-xs text-white/80">Resolução original: {width} × {height} px · role para conferir os detalhes</p>
      <img src={image} alt={label} className="mx-auto max-w-none rounded-lg bg-white" style={{ width }} onClick={(event) => event.stopPropagation()} />
    </div>}
  </>;
}
