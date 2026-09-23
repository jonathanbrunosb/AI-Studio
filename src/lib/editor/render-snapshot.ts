"use client";

type Snapshot = { canvas?: { width?: number; height?: number; backgroundColor?: string }; elements?: unknown[] };

/** Renderiza a composição salva em PNG na resolução lógica da peça (multiplicador 1). */
export async function renderSnapshotPng(snapshot: unknown): Promise<{ blob: Blob; width: number; height: number }> {
  const project = snapshot as Snapshot;
  const width = Number(project.canvas?.width) || 1080;
  const height = Number(project.canvas?.height) || 1080;
  const [{ StaticCanvas }] = await Promise.all([import("fabric"), import("@/lib/editor/fabric-setup")]);
  const canvas = new StaticCanvas(document.createElement("canvas"), { width, height, backgroundColor: project.canvas?.backgroundColor ?? "#ffffff", enableRetinaScaling: false });
  try {
    await canvas.loadFromJSON({ objects: project.elements ?? [] });
    canvas.renderAll();
    // Decodificação local do data URL: fetch("data:…") é bloqueado pela CSP (connect-src sem data:).
    const blob = dataUrlToBlob(canvas.toDataURL({ format: "png", multiplier: 1, enableRetinaScaling: false }));
    return { blob, width, height };
  } finally {
    void canvas.dispose();
  }
}

function dataUrlToBlob(dataUrl: string) {
  const [header, base64] = dataUrl.split(",", 2);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: header.match(/^data:([^;]+)/)?.[1] ?? "image/png" });
}
