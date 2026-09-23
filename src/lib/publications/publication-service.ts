import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { signSnapshotAssets } from "@/lib/editor/snapshot-assets";
import type { Database } from "@/types/database";
import type { ContentCategory, ContentStatus } from "@/types/content";
import type { EditorialSnapshot, PublicationStatus } from "./publication-rules";

type Client = SupabaseClient<Database>;
export const PUBLICATIONS_PAGE_SIZE = 10;

export type PublicationFilters = { category?: string; status?: string; owner?: string; from?: string; to?: string; page: number };

export type PublicationRow = {
  contentId: string; title: string; category: ContentCategory; contentStatus: ContentStatus; ownerId: string; ownerName: string;
  approvedVersionId: string; approvedVersionNumber: number | null; approvedAt: string | null; thumbnail: unknown; editorial: EditorialSnapshot; unavailableAssets: number; supersedesPublished: boolean;
  publication: null | { id: string; status: PublicationStatus; destination: string | null; destinationLabel: string | null; versionId: string | null; isCurrentVersion: boolean; publishedAt: string | null; externalUrl: string | null; errorMessage: string | null; signed: boolean };
};

export async function getPublicationKpis(client: Client) {
  const [{ count: approved }, { data: latest }] = await Promise.all([
    client.from("contents").select("id", { count: "exact", head: true }).not("approved_version_id", "is", null).neq("status", "archived"),
    client.from("publication_latest").select("content_id, status").limit(5000),
  ]);
  const byStatus = (statuses: string[]) => (latest ?? []).filter((row) => statuses.includes(row.status)).length;
  return {
    approved: approved ?? 0,
    prepared: byStatus(["prepared", "exported"]),
    awaiting: byStatus(["received", "pending_publication"]),
    published: byStatus(["published"]),
    failed: byStatus(["failed"]),
  };
}

export async function listPublicationRows(client: Client, filters: PublicationFilters) {
  let query = client.from("contents")
    .select("id, title, category, status, created_by, approved_version_id, approved_at", { count: "exact" })
    .not("approved_version_id", "is", null).neq("status", "archived");
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.owner && /^[0-9a-f-]{36}$/i.test(filters.owner)) query = query.eq("created_by", filters.owner);
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) query = query.gte("approved_at", `${filters.from}T00:00:00`);
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) query = query.lte("approved_at", `${filters.to}T23:59:59`);

  if (filters.status) {
    const { data: latest } = await client.from("publication_latest").select("content_id, status").limit(5000);
    const ids = (latest ?? []).filter((row) => row.status === filters.status).map((row) => row.content_id);
    if (filters.status === "not_prepared") {
      const prepared = (latest ?? []).map((row) => row.content_id);
      if (prepared.length) query = query.not("id", "in", `(${prepared.join(",")})`);
    } else {
      query = query.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
    }
  }

  const start = (filters.page - 1) * PUBLICATIONS_PAGE_SIZE;
  const { data, count, error } = await query.order("approved_at", { ascending: false, nullsFirst: false }).range(start, start + PUBLICATIONS_PAGE_SIZE - 1);
  if (error) throw error;
  const rows = data ?? [];
  const ids = rows.map((row) => row.id);
  const versionIds = rows.map((row) => row.approved_version_id).filter(Boolean) as string[];
  const [{ data: latest }, { data: versions }, { data: owners }, { data: destinations }] = await Promise.all([
    ids.length ? client.from("publication_latest").select("id, content_id, status, destination, version_id, published_at, external_url, error_message, signed").in("content_id", ids) : Promise.resolve({ data: [] }),
    versionIds.length ? client.from("content_versions").select("id, version_number, snapshot").in("id", versionIds) : Promise.resolve({ data: [] }),
    client.from("profiles").select("id, full_name").in("id", [...new Set(rows.map((row) => row.created_by))]),
    client.from("portal_destinations").select("id, label"),
  ]);
  const latestBy = new Map((latest ?? []).map((row) => [row.content_id, row]));
  const versionBy = new Map((versions ?? []).map((row) => [row.id, row]));
  const ownerBy = new Map((owners ?? []).map((row) => [row.id, row.full_name]));
  const destinationBy = new Map((destinations ?? []).map((row) => [row.id, row.label]));

  const items: PublicationRow[] = await Promise.all(rows.map(async (row) => {
    const version = row.approved_version_id ? versionBy.get(row.approved_version_id) : undefined;
    const pub = latestBy.get(row.id);
    const signed = version?.snapshot ? await signSnapshotAssets(client, version.snapshot, 1800) : null;
    const snapshot = signed?.snapshot as { editorial?: EditorialSnapshot } | undefined;
    return {
      contentId: row.id, title: row.title, category: row.category as ContentCategory, contentStatus: row.status as ContentStatus,
      ownerId: row.created_by, ownerName: ownerBy.get(row.created_by) ?? "Usuário do AI Studio",
      approvedVersionId: row.approved_version_id!, approvedVersionNumber: version?.version_number ?? null, approvedAt: row.approved_at,
      thumbnail: signed?.snapshot ?? null, editorial: snapshot?.editorial ?? { title: row.title }, unavailableAssets: signed?.unavailable.length ?? 0,
      supersedesPublished: Boolean(pub && pub.status === "published" && pub.version_id !== row.approved_version_id),
      publication: pub ? {
        id: pub.id, status: pub.status as PublicationStatus, destination: pub.destination, destinationLabel: pub.destination ? destinationBy.get(pub.destination) ?? pub.destination : null,
        versionId: pub.version_id, isCurrentVersion: pub.version_id === row.approved_version_id, publishedAt: pub.published_at, externalUrl: pub.external_url,
        errorMessage: pub.error_message, signed: pub.signed,
      } : null,
    };
  }));
  return { items, total: count ?? 0 };
}

export async function loadPreparationContext(client: Client, contentId: string) {
  const { data: content } = await client.from("contents").select("id, title, category, status, created_by, approved_version_id, approved_at").eq("id", contentId).maybeSingle();
  if (!content?.approved_version_id) return null;
  const [{ data: version }, { data: mappings }] = await Promise.all([
    client.from("content_versions").select("id, version_number, snapshot, version_kind").eq("id", content.approved_version_id).maybeSingle(),
    client.from("content_category_destinations").select("destination_id, is_default, portal_destinations(id, label, portal_collection, portal_category, enabled)").eq("category", content.category),
  ]);
  if (!version || version.version_kind !== "frozen") return null;
  const signed = await signSnapshotAssets(client, version.snapshot);
  const snapshot = signed.snapshot as Record<string, unknown> & { editorial?: EditorialSnapshot; canvas?: { width?: number; height?: number } };
  const destinations = (mappings ?? [])
    .map((mapping) => ({ ...(mapping.portal_destinations as unknown as { id: string; label: string; portal_collection: string; portal_category: string; enabled: boolean }), isDefault: mapping.is_default }))
    .filter((destination) => destination?.enabled)
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault));
  return { content, version: { id: version.id, number: version.version_number }, snapshot, editorial: snapshot.editorial ?? {}, destinations, unavailableAssets: signed.unavailable };
}

export async function listPublicationEvents(client: Client, contentId: string) {
  const { data } = await client.from("publication_events").select("id, publication_id, event, from_status, to_status, actor_id, source, details, created_at")
    .eq("content_id", contentId).order("created_at", { ascending: false }).limit(50);
  const actors = [...new Set((data ?? []).map((row) => row.actor_id).filter(Boolean) as string[])];
  const { data: names } = actors.length ? await client.from("profiles").select("id, full_name").in("id", actors) : { data: [] };
  const nameBy = new Map((names ?? []).map((row) => [row.id, row.full_name]));
  return (data ?? []).map((row) => ({ ...row, actorName: row.actor_id ? nameBy.get(row.actor_id) ?? "Usuário" : row.source === "portal_api" ? "Portal (API)" : "Sistema" }));
}

/** Indicadores do dashboard, por conteúdo (publicação mais recente), evitando contar tentativas repetidas. */
export async function getPublicationDashboard(client: Client, periodDays: number | null) {
  const since = periodDays ? new Date(Date.now() - periodDays * 86_400_000).toISOString() : null;
  let approvedQuery = client.from("contents").select("id", { count: "exact", head: true }).eq("status", "approved");
  if (since) approvedQuery = approvedQuery.gte("approved_at", since);
  let latestQuery = client.from("publication_latest").select("content_id, status, updated_at, published_at").limit(5000);
  if (since) latestQuery = latestQuery.gte("updated_at", since);
  const [{ count: approvedWaiting }, { data: latest }] = await Promise.all([approvedQuery, latestQuery]);
  const count = (statuses: string[]) => (latest ?? []).filter((row) => statuses.includes(row.status)).length;
  return { approvedWaiting: approvedWaiting ?? 0, prepared: count(["prepared", "exported"]), awaiting: count(["received", "pending_publication"]), published: count(["published"]), failed: count(["failed"]) };
}
