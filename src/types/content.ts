export type ContentStatus = "draft" | "in_review" | "changes_requested" | "approved" | "published" | "archived";
export type ContentCategory = "internal_communication" | "accounting_newsletter" | "system_announcement" | "internal_campaign";

export interface ContentItem {
  id: string;
  title: string;
  category: ContentCategory;
  owner: string;
  date: string;
  status: ContentStatus;
  accent: string;
}

export interface WorkflowStage { label: ContentStatus; value: number; color: string }

export const contentStatusLabels: Record<ContentStatus, string> = {
  draft: "Rascunho",
  in_review: "Em revisão",
  changes_requested: "Ajustes solicitados",
  approved: "Aprovado",
  published: "Publicado",
  archived: "Arquivado",
};

export const contentCategoryLabels: Record<ContentCategory, string> = {
  internal_communication: "Comunicado Interno",
  accounting_newsletter: "Newsletter Contábil",
  system_announcement: "Divulgação de Sistemas",
  internal_campaign: "Campanha Interna",
};
