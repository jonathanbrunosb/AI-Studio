export type ContentStatus = "Rascunho" | "Em revisão" | "Ajustes solicitados" | "Aprovado" | "Publicado";
export type ContentCategory = "Comunicado Interno" | "Newsletter Contábil" | "Divulgação de Sistemas" | "Campanha Interna";

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
