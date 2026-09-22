import type { ContentItem, WorkflowStage } from "@/types/content";

export const dashboardStats = [
  { title: "Total de conteúdos", value: 128, change: "+12 este mês", tone: "blue" },
  { title: "Em elaboração", value: 18, change: "4 atualizados hoje", tone: "slate" },
  { title: "Aguardando aprovação", value: 7, change: "2 com prioridade", tone: "amber" },
  { title: "Aprovados", value: 31, change: "+8% no período", tone: "indigo" },
  { title: "Publicados", value: 72, change: "+9 este mês", tone: "emerald" },
] as const;

export const recentContents: ContentItem[] = [
  { id: "CNT-142", title: "Fechamento contábil — Setembro", category: "Comunicado Interno", owner: "Marina Souza", date: "22 set. 2026", status: "Em revisão", accent: "#1769aa" },
  { id: "CNT-141", title: "Conexão Contábil · Edição 18", category: "Newsletter Contábil", owner: "Jonathan Lima", date: "20 set. 2026", status: "Aprovado", accent: "#6d5bd0" },
  { id: "CNT-140", title: "Nova rotina de conciliação no SAP", category: "Divulgação de Sistemas", owner: "Camila Freitas", date: "18 set. 2026", status: "Publicado", accent: "#278563" },
  { id: "CNT-139", title: "Semana da Integridade Financeira", category: "Campanha Interna", owner: "Rafael Nunes", date: "16 set. 2026", status: "Rascunho", accent: "#64748b" },
  { id: "CNT-138", title: "Atualização do calendário de entregas", category: "Comunicado Interno", owner: "Larissa Prado", date: "15 set. 2026", status: "Ajustes solicitados", accent: "#c75b64" },
];

export const workflowStages: WorkflowStage[] = [
  { label: "Rascunho", value: 18, color: "#94a3b8" },
  { label: "Em revisão", value: 11, color: "#e6a23c" },
  { label: "Ajustes solicitados", value: 5, color: "#d97179" },
  { label: "Aprovado", value: 31, color: "#1769aa" },
  { label: "Publicado", value: 72, color: "#278563" },
];

export const libraryItems: ContentItem[] = recentContents.concat([
  { id: "CNT-137", title: "Guia rápido de rateios", category: "Divulgação de Sistemas", owner: "André Costa", date: "12 set. 2026", status: "Publicado", accent: "#1769aa" },
  { id: "CNT-136", title: "Resultados do segundo trimestre", category: "Newsletter Contábil", owner: "Marina Souza", date: "08 set. 2026", status: "Publicado", accent: "#6d5bd0" },
  { id: "CNT-135", title: "Nossa Contabilidade em números", category: "Campanha Interna", owner: "Jonathan Lima", date: "03 set. 2026", status: "Aprovado", accent: "#d18b42" },
]);
