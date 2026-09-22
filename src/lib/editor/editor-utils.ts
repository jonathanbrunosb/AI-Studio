import type { EditorFormat, EditorProject, EditorSeed } from "./editor-types";
import { editorFormats } from "./editor-types";

export const EDITOR_CUSTOM_PROPERTIES = ["editorId", "name", "storagePath", "assetId", "locked"];

export function createEmptyProject(
  format: EditorFormat,
  templateId: string | null,
  templateSnapshot: Record<string, unknown> | null,
): EditorProject {
  const dimensions = editorFormats[format];
  return {
    schemaVersion: 1,
    canvas: { width: dimensions.width, height: dimensions.height, backgroundColor: "#ffffff" },
    elements: [],
    templateId,
    templateSnapshot,
    updatedAt: null,
  };
}

export function inferFormat(width: number, height: number): EditorFormat {
  if (width === 1920 && height === 1080) return "horizontal";
  if (width === 1080 && height === 1350) return "vertical";
  if (width / height > 1.2) return "horizontal";
  if (height / width > 1.12) return "vertical";
  return "square";
}

export function createEditorId(prefix = "element") {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function safeFileName(title: string, extension: "png" | "jpg") {
  const base = title.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "material";
  return `${base}-rascunho.${extension}`;
}

export function getInitialSeedElements(seed: EditorSeed, width: number, height: number) {
  const margin = Math.round(width * 0.075);
  return [
    { type: "Rect", editorId: createEditorId("brand"), name: "Faixa institucional", left: 0, top: 0, width, height: Math.max(20, height * 0.025), fill: seed.accentColor, selectable: true },
    { type: "Textbox", editorId: createEditorId("title"), name: "Título", left: margin, top: height * 0.16, width: width - margin * 2, text: seed.title || "Título do material", fontFamily: seed.fontFamily, fontSize: Math.round(width * 0.055), fontWeight: "bold", fill: seed.primaryColor, lineHeight: 1.05 },
    { type: "Textbox", editorId: createEditorId("subtitle"), name: "Subtítulo", left: margin, top: height * 0.34, width: width - margin * 2, text: seed.subtitle || "Mensagem de apoio", fontFamily: seed.fontFamily, fontSize: Math.round(width * 0.026), fontWeight: "600", fill: "#64748b", lineHeight: 1.2 },
    { type: "Textbox", editorId: createEditorId("body"), name: "Texto principal", left: margin, top: height * 0.48, width: width - margin * 2, text: seed.description || "Adicione o conteúdo principal da comunicação.", fontFamily: seed.fontFamily, fontSize: Math.round(width * 0.021), fill: "#334155", lineHeight: 1.35 },
    { type: "Textbox", editorId: createEditorId("footer"), name: "Assinatura", left: margin, top: height * 0.9, width: width - margin * 2, text: seed.footerText || seed.organization, fontFamily: seed.fontFamily, fontSize: Math.round(width * 0.014), fontWeight: "bold", fill: seed.primaryColor },
  ];
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}
