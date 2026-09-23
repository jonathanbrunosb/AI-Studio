import type { AspectRatio, ResolutionId } from "../models/model-types";
import { e2eFalBaseUrl } from "../providers/test-mode";

export const acceptedImageTypes = ["image/png", "image/jpeg", "image/webp"] as const;
export type AcceptedImageType = (typeof acceptedImageTypes)[number];
export const referenceMaxBytes = 10 * 1024 * 1024;
export const generatedMaxBytes = 20 * 1024 * 1024;

const targetPixels: Record<ResolutionId, number> = { standard: 1024 * 1024, high: 1536 * 1536 * 0.9 };

/** Calcula largura/altura múltiplas de 16 para a proporção e resolução solicitadas. */
export function dimensionsFor(ratio: AspectRatio, resolution: ResolutionId) {
  const [w, h] = ratio.split(":").map(Number);
  const height = Math.sqrt(targetPixels[resolution] * h / w);
  const width = height * w / h;
  const round = (value: number) => Math.max(256, Math.round(value / 16) * 16);
  return { width: round(width), height: round(height) };
}

export type ImageInfo = { mimeType: AcceptedImageType; width: number; height: number; extension: "png" | "jpg" | "webp" };

/** Identifica o formato pelo conteúdo (não pela extensão) e extrai as dimensões. */
export function inspectImage(bytes: Uint8Array): ImageInfo | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mimeType: "image/png", width: view.getUint32(16), height: view.getUint32(20), extension: "png" };
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset += 1; continue; }
      const marker = bytes[offset + 1];
      const length = view.getUint16(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return { mimeType: "image/jpeg", height: view.getUint16(offset + 5), width: view.getUint16(offset + 7), extension: "jpg" };
      }
      offset += 2 + length;
    }
    return null;
  }
  if (bytes.length >= 30 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") {
    const chunk = String.fromCharCode(...bytes.slice(12, 16));
    if (chunk === "VP8X") return { mimeType: "image/webp", width: 1 + (bytes[24] | bytes[25] << 8 | bytes[26] << 16), height: 1 + (bytes[27] | bytes[28] << 8 | bytes[29] << 16), extension: "webp" };
    if (chunk === "VP8 ") return { mimeType: "image/webp", width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff, extension: "webp" };
    if (chunk === "VP8L") {
      const b = bytes.slice(21, 25);
      return { mimeType: "image/webp", width: 1 + (((b[1] & 0x3f) << 8) | b[0]), height: 1 + (((b[3] & 0xf) << 10) | (b[2] << 2) | ((b[1] & 0xc0) >> 6)), extension: "webp" };
    }
  }
  return null;
}

export function validateImageFile(file: { type: string; size: number }, maxBytes = referenceMaxBytes) {
  if (!(acceptedImageTypes as readonly string[]).includes(file.type)) return "Formato não aceito. Use PNG, JPG ou WebP.";
  if (file.size <= 0 || file.size > maxBytes) return `A imagem deve ter até ${Math.round(maxBytes / 1024 / 1024)} MB.`;
  return null;
}

const resultHosts = ["fal.media", "fal.run", "fal.ai"];

/** Resultados só são baixados de hosts HTTPS do provedor, evitando SSRF. */
export function isAllowedResultUrl(rawUrl: string, extraHosts: string[] = []) {
  try {
    const url = new URL(rawUrl);
    const testBase = e2eFalBaseUrl();
    if (testBase && url.origin === testBase) return true;
    const hosts = [...resultHosts, ...extraHosts];
    return url.protocol === "https:" && hosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}
