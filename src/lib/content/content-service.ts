import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ContentCategory, ContentItem, ContentStatus, WorkflowStage } from "@/types/content";
import { categoryAccents, formatContentDate, statusColors } from "./mappers";

type Client = SupabaseClient<Database>;

export async function listContents(client: Client, limit?: number) {
  let query = client.from("contents").select("id, title, category, status, created_by, created_at").order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);
  const { data, error } = await query;
  if (error) throw error;

  const ownerIds = [...new Set((data ?? []).map((item) => item.created_by))];
  const { data: profiles } = ownerIds.length ? await client.from("profiles").select("id, full_name").in("id", ownerIds) : { data: [] };
  const owners = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  return (data ?? []).map((item): ContentItem => ({
    id: item.id,
    title: item.title,
    category: item.category as ContentCategory,
    status: item.status as ContentStatus,
    owner: owners.get(item.created_by) ?? "Usuário do AI Studio",
    date: formatContentDate(item.created_at),
    accent: categoryAccents[item.category as ContentCategory] ?? "#1769aa",
  }));
}

export async function getDashboardData(client: Client) {
  const statuses: ContentStatus[] = ["draft", "in_review", "changes_requested", "approved", "published"];
  const [totalResult, recent, ...statusResults] = await Promise.all([
    client.from("contents").select("id", { count: "exact", head: true }),
    listContents(client, 5),
    ...statuses.map((status) => client.from("contents").select("id", { count: "exact", head: true }).eq("status", status)),
  ]);

  const errors = [totalResult, ...statusResults].map((result) => result.error).filter(Boolean);
  if (errors.length) throw errors[0];

  const counts = Object.fromEntries(statuses.map((status, index) => [status, statusResults[index].count ?? 0])) as Record<ContentStatus, number>;
  const stages: WorkflowStage[] = statuses.map((status) => ({ label: status, value: counts[status], color: statusColors[status] }));
  return { total: totalResult.count ?? 0, counts, stages, recent };
}
