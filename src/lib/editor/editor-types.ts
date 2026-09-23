import { z } from "zod";

export const editorFormats = {
  horizontal: { label: "Horizontal Full HD", width: 1920, height: 1080 },
  square: { label: "Quadrado", width: 1080, height: 1080 },
  vertical: { label: "Vertical", width: 1080, height: 1350 },
} as const;

export type EditorFormat = keyof typeof editorFormats;
export type SaveStatus = "saved" | "dirty" | "saving" | "error";
export type EditorElement = Record<string, unknown> & {
  type?: string;
  editorId?: string;
  name?: string;
  storagePath?: string;
  assetId?: string;
};

const elementSchema = z.record(z.string(), z.unknown());

export const editorProjectSchema = z.object({
  schemaVersion: z.literal(1),
  canvas: z.object({
    width: z.number().int().min(320).max(4096),
    height: z.number().int().min(320).max(4096),
    backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
  elements: z.array(elementSchema).max(250),
  templateId: z.string().uuid().nullable(),
  templateSnapshot: z.record(z.string(), z.unknown()).nullable(),
  updatedAt: z.string().datetime().nullable(),
});

export type EditorProject = z.infer<typeof editorProjectSchema>;

export type EditorSeed = {
  title: string;
  subtitle: string | null;
  description: string | null;
  organization: string;
  primaryColor: string;
  accentColor: string;
  fontFamily: string;
  footerText: string;
};

export type MediaAsset = {
  id: string;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  signedUrl: string;
  bucket?: string;
  width?: number | null;
  height?: number | null;
};

export type VersionSummary = {
  id: string;
  versionNumber: number;
  kind: "working" | "checkpoint" | "frozen";
  label: string | null;
  updatedAt: string;
  project?: EditorProject;
};

export type TemplateOption = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  configuration: unknown;
};
