import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createEmptyProject, inferFormat } from "./editor-utils";
import { editorProjectSchema, type MediaAsset, type VersionSummary } from "./editor-types";

type Client = SupabaseClient<Database>;

export async function loadEditorProject(client: Client, content: Database["public"]["Tables"]["contents"]["Row"]) {
  const [{ data: working }, { data: versions }, { data: assets }, { data: templates }] = await Promise.all([
    client.from("content_versions").select("*").eq("content_id", content.id).eq("version_kind", "working").maybeSingle(),
    client.from("content_versions").select("id, version_number, version_kind, label, updated_at, snapshot")
      .eq("content_id", content.id).order("version_number", { ascending: false }).limit(20),
    client.from("media_assets").select("id, file_name, storage_path, mime_type")
      .order("created_at", { ascending: false }).limit(40),
    client.from("templates").select("id, name, description, category, configuration")
      .eq("is_active", true).order("name"),
  ]);

  const layout = content.layout_snapshot as Record<string, unknown>;
  const format = inferFormat(Number(layout.width) || 1080, Number(layout.height) || 1080);
  const fallback = createEmptyProject(format, content.template_id, layout);
  const parsed = editorProjectSchema.safeParse(working?.snapshot);
  const project = parsed.success ? structuredClone(parsed.data) : fallback;

  const media: MediaAsset[] = [];
  for (const asset of assets ?? []) {
    const signed = await client.storage.from("editor-assets").createSignedUrl(asset.storage_path, 3600);
    if (signed.data?.signedUrl) media.push({
      id: asset.id,
      fileName: asset.file_name,
      storagePath: asset.storage_path,
      mimeType: asset.mime_type,
      signedUrl: signed.data.signedUrl,
    });
  }

  const signedByPath = new Map(media.map((asset) => [asset.storagePath, asset.signedUrl]));
  const refreshSignedUrls = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(refreshSignedUrls);
    if (!value || typeof value !== "object") return value;
    const object = value as Record<string, unknown>;
    const path = typeof object.storagePath === "string" ? object.storagePath : null;
    return Object.fromEntries(Object.entries({
      ...object,
      ...(path && signedByPath.has(path) ? { src: signedByPath.get(path) } : {}),
    }).map(([key, child]) => [key, refreshSignedUrls(child)]));
  };
  project.elements = refreshSignedUrls(project.elements) as typeof project.elements;

  const history: VersionSummary[] = (versions ?? []).map((version) => {
    const versionProject = editorProjectSchema.safeParse(version.snapshot);
    return {
      id: version.id,
      versionNumber: version.version_number,
      kind: version.version_kind as VersionSummary["kind"],
      label: version.label,
      updatedAt: version.updated_at,
      project: versionProject.success
        ? refreshSignedUrls(structuredClone(versionProject.data)) as typeof versionProject.data
        : undefined,
    };
  });

  return { project, media, history, templates: templates ?? [] };
}
