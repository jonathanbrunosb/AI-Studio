import type { ContentCategory, ContentStatus } from "@/types/content";

export const statusColors: Record<ContentStatus, string> = {
  draft: "#94a3b8",
  in_review: "#e6a23c",
  changes_requested: "#d97179",
  approved: "#1769aa",
  published: "#278563",
  archived: "#64748b",
};

export const categoryAccents: Record<ContentCategory, string> = {
  internal_communication: "#1769aa",
  accounting_newsletter: "#6d5bd0",
  system_announcement: "#278563",
  internal_campaign: "#d18b42",
};

export function formatContentDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
