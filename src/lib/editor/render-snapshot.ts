"use client";

type Snapshot = { canvas?: { width?: number; height?: number; backgroundColor?: string }; elements?: unknown[] };

/** Renderiza a composição salva em PNG na resolução lógica da peça (multiplicador 1). */
export async function renderSnapshotPng(snapshot: unknown): Promise<{ blob: Blob; width: number; height: number }> {
  const project = snapshot as Snapshot;
  const width = Number(project.canvas?.width) || 1080;
  const height = Number(project.canvas?.height) || 1080;
  const { StaticCanvas } = await import("fabric");
  const canvas = new StaticCanvas(document.createElement("canvas"), { width, height, backgroundColor: project.canvas?.backgroundColor ?? "#ffffff", enableRetinaScaling: false });
  try {
    await canvas.loadFromJSON({ objects: project.elements ?? [] });
    canvas.renderAll();
    const blob = await (await fetch(canvas.toDataURL({ format: "png", multiplier: 1, enableRetinaScaling: false }))).blob();
    return { blob, width, height };
  } finally {
    void canvas.dispose();
  }
}
