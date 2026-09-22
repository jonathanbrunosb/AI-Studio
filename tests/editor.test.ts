import { describe, expect, it } from "vitest";
import { getExportOptions } from "@/lib/editor/editor-export";
import { editorFormats, editorProjectSchema } from "@/lib/editor/editor-types";
import { clampNumber, createEmptyProject, getInitialSeedElements, inferFormat, safeFileName } from "@/lib/editor/editor-utils";

const seed = {
  title: "Fechamento Contábil",
  subtitle: "Orientações do período",
  description: "Confira os principais prazos.",
  organization: "Gerência de Contabilidade",
  primaryColor: "#123c69",
  accentColor: "#2563eb",
  fontFamily: "Calibri",
  footerText: "Comunicação Contábil",
};

describe("núcleo do editor visual", () => {
  it("cria projetos nas dimensões lógicas corporativas", () => {
    for (const [format, dimensions] of Object.entries(editorFormats)) {
      const project = createEmptyProject(format as keyof typeof editorFormats, null, null);
      expect(project.canvas).toMatchObject({ width: dimensions.width, height: dimensions.height });
      expect(editorProjectSchema.safeParse(project).success).toBe(true);
    }
  });

  it("aplica a composição inicial como elementos editáveis independentes", () => {
    const elements = getInitialSeedElements(seed, 1920, 1080);
    expect(elements).toHaveLength(5);
    expect(new Set(elements.map((element) => element.editorId)).size).toBe(elements.length);
    expect(elements.find((element) => element.name === "Título")).toMatchObject({ text: seed.title, fontFamily: "Calibri" });
  });

  it("valida limites de projeto e recusa payloads excessivos", () => {
    const project = createEmptyProject("square", null, null);
    expect(editorProjectSchema.safeParse({ ...project, canvas: { ...project.canvas, width: 4097 } }).success).toBe(false);
    expect(editorProjectSchema.safeParse({ ...project, elements: Array.from({ length: 251 }, () => ({})) }).success).toBe(false);
  });

  it("preserva resolução de exportação e limita qualidade JPG", () => {
    expect(getExportOptions("png")).toEqual({ format: "png", quality: 0.9, multiplier: 1, enableRetinaScaling: false });
    expect(getExportOptions("jpg", 4)).toMatchObject({ format: "jpeg", quality: 1, multiplier: 1 });
    expect(getExportOptions("jpg", 0)).toMatchObject({ quality: 0.3 });
  });

  it("normaliza formato, nomes de arquivo e valores numéricos", () => {
    expect(inferFormat(1920, 1080)).toBe("horizontal");
    expect(inferFormat(1080, 1350)).toBe("vertical");
    expect(safeFileName("Comunicação: Balanço 2026", "png")).toBe("comunicacao-balanco-2026-rascunho.png");
    expect(clampNumber(Number.NaN, 10, 20)).toBe(10);
  });
});
