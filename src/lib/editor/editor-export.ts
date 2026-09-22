import { clampNumber, safeFileName } from "./editor-utils";

export type ExportFormat = "png" | "jpg";

export function getExportOptions(format: ExportFormat, quality = 0.9) {
  return {
    format: format === "jpg" ? "jpeg" as const : "png" as const,
    quality: clampNumber(quality, 0.3, 1),
    multiplier: 1,
    enableRetinaScaling: false,
  };
}
export function downloadDataUrl(dataUrl: string, title: string, format: ExportFormat) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = safeFileName(title, format);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
