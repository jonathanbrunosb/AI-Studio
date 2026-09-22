import type { Canvas } from "fabric";
import { editorProjectSchema, type EditorProject } from "./editor-types";
import { EDITOR_CUSTOM_PROPERTIES } from "./editor-utils";

export function serializeCanvas(canvas: Canvas, base: EditorProject): EditorProject {
  const json = canvas.toObject(EDITOR_CUSTOM_PROPERTIES) as { objects?: Record<string, unknown>[] };
  return editorProjectSchema.parse({
    ...base,
    canvas: {
      width: canvas.getWidth(),
      height: canvas.getHeight(),
      backgroundColor: typeof canvas.backgroundColor === "string" ? canvas.backgroundColor : "#ffffff",
    },
    elements: json.objects ?? [],
    updatedAt: new Date().toISOString(),
  });
}
export function parseEditorProject(value: unknown) {
  return editorProjectSchema.safeParse(value);
}

export function projectFingerprint(project: EditorProject) {
  return JSON.stringify({ ...project, updatedAt: null });
}
