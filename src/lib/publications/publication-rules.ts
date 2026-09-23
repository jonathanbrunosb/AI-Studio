import type { AppRole } from "@/lib/auth/authorization";
import type { ContentCategory, ContentStatus } from "@/types/content";

export type PublicationStatus = "prepared" | "exported" | "received" | "pending_publication" | "published" | "failed" | "superseded";

export const publicationStatusLabels: Record<PublicationStatus | "not_prepared", string> = {
  not_prepared: "Não preparado",
  prepared: "Preparado",
  exported: "Exportado",
  received: "Recebido pelo portal",
  pending_publication: "Aguardando publicação",
  published: "Publicado",
  failed: "Falha de integração",
  superseded: "Substituído",
};

export const publicationStatusStyles: Record<PublicationStatus | "not_prepared", string> = {
  not_prepared: "bg-slate-100 text-slate-600 ring-slate-200",
  prepared: "bg-blue-50 text-blue-700 ring-blue-200",
  exported: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  received: "bg-amber-50 text-amber-700 ring-amber-200",
  pending_publication: "bg-amber-50 text-amber-700 ring-amber-200",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-rose-50 text-rose-700 ring-rose-200",
  superseded: "bg-slate-100 text-slate-500 ring-slate-200",
};

export function canPrepare(roles: AppRole[], userId: string, content: { created_by: string; status: ContentStatus; approved_version_id: string | null }) {
  if (!content.approved_version_id || content.status === "archived") return false;
  return roles.includes("admin") || (roles.includes("editor") && content.created_by === userId);
}

export function canConfirm(roles: AppRole[]) {
  return roles.includes("admin");
}

export type EditorialSnapshot = {
  title?: string; subtitle?: string | null; description?: string | null; category?: string; reference_date?: string | null;
  source_name?: string | null; source_url?: string | null; editorial_details?: Record<string, unknown> | null;
};

/** Validação dos campos obrigatórios da categoria, sobre os dados congelados da versão aprovada. */
export function validatePublicationData(category: ContentCategory, editorial: EditorialSnapshot, options: { accessUrlConfirmed: boolean }) {
  const issues: string[] = [];
  if (!editorial.title?.trim()) issues.push("A versão aprovada não possui título.");
  if (category === "accounting_newsletter" && (!editorial.source_name?.trim() || !editorial.source_url?.trim())) {
    issues.push("Newsletters exigem fonte e link de referência na versão aprovada.");
  }
  const details = editorial.editorial_details ?? {};
  if (category === "system_announcement") {
    if (!String(details.solution_name ?? "").trim() || !String(details.functionality ?? "").trim()) issues.push("Divulgações de sistemas exigem nome da solução e funcionalidade.");
    if (String(details.access_url ?? "").trim() && !options.accessUrlConfirmed) issues.push("Confirme que o link de acesso ao sistema foi validado.");
  }
  return issues;
}

const publicationErrors: Record<string, string> = {
  FORBIDDEN_ROLE: "Seu perfil não permite esta operação de publicação.",
  NOT_OWNER: "Somente o autor ou um administrador pode preparar esta publicação.",
  CONTENT_NOT_FOUND: "Conteúdo não encontrado ou sem permissão.",
  CONTENT_ARCHIVED: "Conteúdos arquivados não podem ser publicados.",
  NOT_APPROVED: "O conteúdo não possui versão aprovada.",
  VERSION_NOT_CURRENT: "A versão informada não é a versão aprovada vigente.",
  VERSION_INVALID: "A versão aprovada não pôde ser validada.",
  INVALID_DESTINATION: "Destino não permitido para esta categoria.",
  ALREADY_IN_PORTAL: "Esta versão já foi recebida ou publicada no portal. Não é possível gerar outro pacote.",
  CONFLICT_RETRY: "Outra preparação foi registrada ao mesmo tempo. Recarregue a página.",
  STATE_CHANGED: "O status da publicação foi atualizado por outra operação. A tela foi recarregada.",
  CONFIRMATION_DATA_REQUIRED: "Informe o canal e a data da publicação.",
  INVALID_DATE: "A data de publicação não pode estar no futuro.",
  MESSAGE_REQUIRED: "Descreva a falha (mínimo de 5 caracteres).",
  ALREADY_ACTIVE: "Já existe uma publicação ativa para esta versão e destino.",
  PUBLICATION_NOT_FOUND: "Publicação não encontrada.",
  NOT_AUTHENTICATED: "Sessão expirada.",
};

export function publicationErrorMessage(raw: string | null | undefined) {
  const code = raw ? Object.keys(publicationErrors).find((key) => raw.includes(key)) : undefined;
  return code ? publicationErrors[code] : "Não foi possível concluir a operação de publicação.";
}
