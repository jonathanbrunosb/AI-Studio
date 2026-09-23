import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export function collectStoragePaths(value: unknown, into = new Set<string>()) {
  if (Array.isArray(value)) { value.forEach((item) => collectStoragePaths(item, into)); return into; }
  if (!value || typeof value !== "object") return into;
  const object = value as Record<string, unknown>;
  if (typeof object.storagePath === "string") into.add(object.storagePath);
  Object.values(object).forEach((child) => collectStoragePaths(child, into));
  return into;
}

/**
 * Renova as URLs assinadas das imagens de um ou mais snapshots, respeitando o RLS do usuário.
 * Retorna o snapshot com `src` atualizado e a lista de caminhos que o usuário não conseguiu acessar.
 */
export async function signSnapshotAssets<T>(client: Client, snapshot: T, seconds = 3600) {
  const paths = [...collectStoragePaths(snapshot)];
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data } = await client.from("media_assets").select("storage_path, bucket").in("storage_path", paths);
    for (const asset of data ?? []) {
      const result = await client.storage.from(asset.bucket).createSignedUrl(asset.storage_path, seconds);
      if (result.data?.signedUrl) signed.set(asset.storage_path, result.data.signedUrl);
    }
  }
  const refresh = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(refresh);
    if (!value || typeof value !== "object") return value;
    const object = value as Record<string, unknown>;
    const path = typeof object.storagePath === "string" ? object.storagePath : null;
    return Object.fromEntries(Object.entries({ ...object, ...(path && signed.has(path) ? { src: signed.get(path) } : {}) })
      .map(([key, child]) => [key, refresh(child)]));
  };
  return { snapshot: refresh(snapshot) as T, unavailable: paths.filter((path) => !signed.has(path)) };
}
