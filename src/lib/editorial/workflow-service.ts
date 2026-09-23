import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AppRole } from "@/lib/auth/authorization";
import { signSnapshotAssets } from "@/lib/editor/snapshot-assets";
import { categoryAccents } from "@/lib/content/mappers";
import type { Database } from "@/types/database";
import type { ContentCategory, ContentStatus } from "@/types/content";
import type { EditorialAction } from "./workflow-rules";

type Client = SupabaseClient<Database>;

export type EditorialTab = "all" | "awaiting" | "changes" | "approved" | "history";
export const PAGE_SIZE = 10;

export type EditorialFilters = {
  tab: EditorialTab;
  q?: string;
  category?: string;
  status?: string;
  owner?: string;
  from?: string;
  to?: string;
  page: number;
};

export type EditorialRow = {
  id: string;
  title: string;
  category: ContentCategory;
  status: ContentStatus;
  ownerId: string;
  ownerName: string;
  reviewerName: string | null;
  versionNumber: number | null;
  submittedAt: string | null;
  updatedAt: string;
  accent: string;
  thumbnail: unknown | null;
};

export type HistoryEvent = {
  id: string;
  contentId: string;
  contentTitle: string | null;
  actorName: string;
  action: EditorialAction;
  versionNumber: number | null;
  fromStatus: ContentStatus | null;
  toStatus: ContentStatus | null;
  cycle: number | null;
  comment: string | null;
  createdAt: string;
};

const statuses: ContentStatus[] = ["draft", "in_review", "changes_requested", "approved", "published", "archived"];
const sanitize = (value: string) => value.trim().replace(/[%_\\,()]/g, "").slice(0, 120);

export async function getStatusCounts(client: Client) {
  const results = await Promise.all(statuses.map((status) =>
    client.from("contents").select("id", { count: "exact", head: true }).eq("status", status)));
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  return Object.fromEntries(statuses.map((status, index) => [status, results[index].count ?? 0])) as Record<ContentStatus, number>;
}

async function profileNames(client: Client, ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean) as string[])];
  if (!unique.length) return new Map<string, string>();
  const { data } = await client.from("profiles").select("id, full_name").in("id", unique);
  return new Map((data ?? []).map((profile) => [profile.id, profile.full_name]));
}

export async function listEditorialContents(client: Client, filters: EditorialFilters, user: { id: string; roles: AppRole[] }) {
  let query = client.from("contents")
    .select("id, title, category, status, created_by, assigned_reviewer_id, submitted_version_id, approved_version_id, submitted_at, updated_at", { count: "exact" });

  if (filters.tab === "awaiting") {
    query = query.eq("status", "in_review").neq("created_by", user.id);
    if (!user.roles.includes("admin")) query = query.or(`assigned_reviewer_id.is.null,assigned_reviewer_id.eq.${user.id}`);
  } else if (filters.tab === "changes") query = query.eq("status", "changes_requested");
  else if (filters.tab === "approved") query = query.eq("status", "approved");
  else if (filters.status && statuses.includes(filters.status as ContentStatus)) query = query.eq("status", filters.status);
  else query = query.neq("status", "archived");

  if (filters.q?.trim()) query = query.ilike("title", `%${sanitize(filters.q)}%`);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.owner && /^[0-9a-f-]{36}$/i.test(filters.owner)) query = query.eq("created_by", filters.owner);
  const dateColumn = filters.tab === "all" ? "updated_at" : "submitted_at";
  if (filters.from && /^\d{4}-\d{2}-\d{2}$/.test(filters.from)) query = query.gte(dateColumn, `${filters.from}T00:00:00`);
  if (filters.to && /^\d{4}-\d{2}-\d{2}$/.test(filters.to)) query = query.lte(dateColumn, `${filters.to}T23:59:59`);

  const start = (filters.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query
    .order(filters.tab === "awaiting" ? "submitted_at" : "updated_at", { ascending: filters.tab === "awaiting" })
    .range(start, start + PAGE_SIZE - 1);
  if (error) throw error;
  const rows = data ?? [];

  const versionIds = rows.map((row) => row.approved_version_id && row.status !== "in_review" ? row.approved_version_id : row.submitted_version_id).filter(Boolean) as string[];
  const [names, { data: versions }, { data: workings }] = await Promise.all([
    profileNames(client, rows.flatMap((row) => [row.created_by, row.assigned_reviewer_id])),
    versionIds.length ? client.from("content_versions").select("id, version_number, snapshot").in("id", versionIds) : Promise.resolve({ data: [] }),
    rows.length ? client.from("content_versions").select("content_id, version_number, snapshot").eq("version_kind", "working").in("content_id", rows.map((row) => row.id)) : Promise.resolve({ data: [] }),
  ]);
  const versionById = new Map((versions ?? []).map((version) => [version.id, version]));
  const workingByContent = new Map((workings ?? []).map((version) => [version.content_id, version]));

  const items: EditorialRow[] = await Promise.all(rows.map(async (row) => {
    const status = row.status as ContentStatus;
    const reference = (status === "in_review" || status === "changes_requested") ? row.submitted_version_id : row.approved_version_id ?? row.submitted_version_id;
    const version = (reference && versionById.get(reference)) || (isDraftLike(status) ? workingByContent.get(row.id) : undefined) || workingByContent.get(row.id);
    const thumbnail = version?.snapshot ? (await signSnapshotAssets(client, version.snapshot, 900)).snapshot : null;
    return {
      id: row.id, title: row.title, category: row.category as ContentCategory, status,
      ownerId: row.created_by, ownerName: names.get(row.created_by) ?? "Usuário do AI Studio",
      reviewerName: row.assigned_reviewer_id ? names.get(row.assigned_reviewer_id) ?? null : null,
      versionNumber: version?.version_number ?? null, submittedAt: row.submitted_at, updatedAt: row.updated_at,
      accent: categoryAccents[row.category as ContentCategory] ?? "#1769aa", thumbnail,
    };
  }));
  return { items, total: count ?? 0 };
}

function isDraftLike(status: ContentStatus) {
  return status === "draft" || status === "changes_requested";
}

export async function listHistory(client: Client, options: { contentId?: string; page?: number; pageSize?: number } = {}) {
  const pageSize = options.pageSize ?? 20;
  const page = options.page ?? 1;
  let query = client.from("approval_events")
    .select("id, content_id, actor_id, action, comment, version_id, from_status, to_status, cycle, created_at", { count: "exact" });
  if (options.contentId) query = query.eq("content_id", options.contentId).order("created_at", { ascending: true });
  else query = query.order("created_at", { ascending: false });
  const { data, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  if (error) throw error;
  const events = data ?? [];
  const versionIds = [...new Set(events.map((event) => event.version_id).filter(Boolean) as string[])];
  const contentIds = [...new Set(events.map((event) => event.content_id))];
  const [names, { data: versions }, { data: contents }] = await Promise.all([
    profileNames(client, events.map((event) => event.actor_id)),
    versionIds.length ? client.from("content_versions").select("id, version_number").in("id", versionIds) : Promise.resolve({ data: [] }),
    contentIds.length ? client.from("contents").select("id, title").in("id", contentIds) : Promise.resolve({ data: [] }),
  ]);
  const versionNumbers = new Map((versions ?? []).map((version) => [version.id, version.version_number]));
  const titles = new Map((contents ?? []).map((content) => [content.id, content.title]));
  const items: HistoryEvent[] = events.map((event) => ({
    id: event.id, contentId: event.content_id, contentTitle: titles.get(event.content_id) ?? null,
    actorName: names.get(event.actor_id) ?? "Usuário do AI Studio", action: event.action as EditorialAction,
    versionNumber: event.version_id ? versionNumbers.get(event.version_id) ?? null : null,
    fromStatus: event.from_status as ContentStatus | null, toStatus: event.to_status as ContentStatus | null,
    cycle: event.cycle, comment: event.comment, createdAt: event.created_at,
  }));
  return { items, total: count ?? 0 };
}

export async function getLatestChangeRequest(client: Client, contentId: string) {
  const { data } = await client.from("approval_events").select("comment, created_at, actor_id, cycle")
    .eq("content_id", contentId).eq("action", "changes_requested").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  const names = await profileNames(client, [data.actor_id]);
  return { comment: data.comment, createdAt: data.created_at, reviewer: names.get(data.actor_id) ?? "Aprovador", cycle: data.cycle };
}

/** Pendências do usuário: devolvidos (autor), aguardando decisão (aprovador) ou visão consolidada (admin). */
export async function getPendencies(client: Client, user: { id: string; roles: AppRole[] }) {
  const isAdmin = user.roles.includes("admin");
  const isApprover = user.roles.includes("approver");
  const select = "id, title, category, status, created_by, assigned_reviewer_id, submitted_at, updated_at";
  const [{ data: returned }, { data: awaiting }] = await Promise.all([
    isAdmin
      ? client.from("contents").select(select).eq("status", "changes_requested").order("updated_at", { ascending: false }).limit(8)
      : client.from("contents").select(select).eq("status", "changes_requested").eq("created_by", user.id).order("updated_at", { ascending: false }).limit(8),
    isAdmin || isApprover
      ? (() => {
        let query = client.from("contents").select(select).eq("status", "in_review").neq("created_by", user.id);
        if (!isAdmin) query = query.or(`assigned_reviewer_id.is.null,assigned_reviewer_id.eq.${user.id}`);
        return query.order("submitted_at", { ascending: true }).limit(8);
      })()
      : Promise.resolve({ data: [] as never[] }),
  ]);
  const names = await profileNames(client, [...(returned ?? []), ...(awaiting ?? [])].map((row) => row.created_by));
  const map = (row: { id: string; title: string; category: string; status: string; created_by: string; submitted_at: string | null; updated_at: string }, kind: "review" | "adjust") => ({
    id: row.id, title: row.title, category: row.category as ContentCategory, status: row.status as ContentStatus,
    owner: names.get(row.created_by) ?? "Usuário do AI Studio", date: row.submitted_at ?? row.updated_at, kind,
  });
  return [...(awaiting ?? []).map((row) => map(row, "review")), ...(returned ?? []).map((row) => map(row, "adjust"))];
}

export async function getNotifications(client: Client, limit = 12) {
  const [{ data }, { count }] = await Promise.all([
    client.from("notifications").select("id, content_id, type, title, message, created_at, read_at").order("created_at", { ascending: false }).limit(limit),
    client.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  return { items: data ?? [], unread: count ?? 0 };
}
