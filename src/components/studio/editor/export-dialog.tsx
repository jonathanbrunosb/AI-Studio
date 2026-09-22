"use client";

import { useState } from "react";
import type { Canvas } from "fabric";
import { downloadDataUrl, getExportOptions, type ExportFormat } from "@/lib/editor/editor-export";

export function ExportDialog({ open, title, canvas, onClose }: { open: boolean; title: string; canvas: Canvas | null; onClose: () => void }) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [quality, setQuality] = useState(.9);
  if (!open) return null;
  function exportImage() {
    if (!canvas) return;
    canvas.discardActiveObject(); canvas.requestRenderAll();
    const dataUrl = canvas.toDataURL(getExportOptions(format, quality));
    downloadDataUrl(dataUrl, title, format); onClose();
  }
  return <div className="fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label="Exportar prévia">
    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><p className="eyebrow">Exportação de trabalho</p><h3 className="mt-1 text-xl font-bold">Baixar prévia do rascunho</h3><p className="mt-2 text-sm leading-6 text-slate-500">O arquivo será gerado na resolução lógica da peça. Esta prévia não representa aprovação editorial.</p>
      <div className="mt-5 grid grid-cols-2 gap-3"><button className={`secondary-button ${format === "png" ? "border-blue-400 bg-blue-50 text-blue-700" : ""}`} onClick={() => setFormat("png")}>PNG</button><button className={`secondary-button ${format === "jpg" ? "border-blue-400 bg-blue-50 text-blue-700" : ""}`} onClick={() => setFormat("jpg")}>JPG</button></div>
      {format === "jpg" && <label className="mt-5 block text-xs font-bold text-slate-600">Qualidade: {Math.round(quality * 100)}%<input className="mt-2 w-full accent-blue-700" type="range" min="0.4" max="1" step="0.05" value={quality} onChange={(e) => setQuality(Number(e.target.value))} /></label>}
      <div className="mt-6 flex justify-end gap-2"><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={exportImage}>Exportar {format.toUpperCase()}</button></div>
    </div>
  </div>;
}
