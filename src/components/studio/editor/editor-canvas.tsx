"use client";

import type { RefObject } from "react";

export function EditorCanvas({ canvasRef, width, height, zoom }: {
  canvasRef: RefObject<HTMLCanvasElement | null>; width: number; height: number; zoom: number;
}) {
  return <div className="flex min-h-[520px] flex-1 justify-center-safe overflow-auto bg-[#e8edf3] p-10 shadow-inner">
    <div className="relative shrink-0" style={{ width: width * zoom, height: height * zoom }}>
      <div className="absolute left-0 top-0 origin-top-left shadow-2xl shadow-slate-950/20" style={{ transform: `scale(${zoom})`, width, height }}>
        <canvas ref={canvasRef} aria-label="Área de composição visual" />
      </div>
    </div>
  </div>;
}
