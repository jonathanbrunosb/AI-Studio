import type { AppRole } from "@/lib/auth/authorization";
import type { ContentCategory, ContentStatus } from "@/types/content";

export type EditorialAction = "submitted" | "approved" | "changes_requested" | "new_version" | "archived";

export const editorialActionLabels: Record<EditorialAction, string> = {
  submitted: "Envio para revisão",
  approved: "Aprovação",
  changes_requested: "Solicitação de ajustes",
  new_version: "Nova versão criada",
  archived: "Arquivamento",
};

export const editableStatuses: ContentStatus[] = ["draft", "changes_requested"];

export const lockMessages: Partial<Record<ContentStatus, { title: string; message: string }>> = {
  in_review: { title: "Conteúdo em revisão", message: "Este material foi encaminhado para aprovação. A edição ficará disponível caso sejam solicitados ajustes." },
  approved: { title: "Conteúdo aprovado", message: "A versão aprovada está protegida. Para alterar o material, crie uma nova versão, que passará por nova revisão." },
  published: { title: "Conteúdo publicado", message: "A versão publicada não pode ser editada." },
  archived: { title: "Conteúdo arquivado", message: "Material retirado do fluxo editorial ativo. Disponível somente para consulta." },
};

export function isEditableStatus(status: ContentStatus) {
  return editableStatuses.includes(status);
}

export function canCreateContent(roles: AppRole[]) {
  return roles.includes("admin") || roles.includes("editor");
}

export function canSubmit(roles: AppRole[], userId: string, content: { created_by: string; status: ContentStatus }) {
  return canCreateContent(roles) && isEditableStatus(content.status) && (roles.includes("admin") || content.created_by === userId);
}

export function canReviewQueue(roles: AppRole[]) {
  return roles.includes("admin") || roles.includes("approver");
}

/** Segregação de funções: nunca decide quem é autor ou quem submeteu a versão, mesmo sendo administrador. */
export function canDecide(roles: AppRole[], userId: string, content: { created_by: string; status: ContentStatus; assigned_reviewer_id: string | null }, submitterId: string | null) {
  if (!canReviewQueue(roles) || content.status !== "in_review") return false;
  if (content.created_by === userId || submitterId === userId) return false;
  if (content.assigned_reviewer_id && content.assigned_reviewer_id !== userId && !roles.includes("admin")) return false;
  return true;
}

export function canCreateNewVersion(roles: AppRole[], userId: string, content: { created_by: string; status: ContentStatus }) {
  return content.status === "approved" && canCreateContent(roles) && (roles.includes("admin") || content.created_by === userId);
}

export function canArchive(roles: AppRole[], userId: string, content: { created_by: string; status: ContentStatus }) {
  if (content.status === "archived") return false;
  return roles.includes("admin") || (roles.includes("editor") && content.created_by === userId);
}

export type SubmissionInput = {
  title: string | null;
  category: ContentCategory;
  source_name: string | null;
  source_url: string | null;
  editorial_details: Record<string, unknown> | null;
  hasComposition: boolean;
  hasPendingChanges: boolean;
  missingAssets: number;
  eligibleReviewers: number;
};

/** Pré-validação exibida ao usuário. A validação autoritativa ocorre em submit_content_for_review. */
export function validateSubmission(input: SubmissionInput): string[] {
  const issues: string[] = [];
  if (!input.title || input.title.trim().length < 3) issues.push("Informe um título com pelo menos 3 caracteres.");
  if (input.category === "accounting_newsletter" && (!input.source_name?.trim() || !input.source_url?.trim())) {
    issues.push("Newsletters exigem a fonte e o link de referência da notícia.");
  }
  if (input.category === "system_announcement") {
    const details = input.editorial_details ?? {};
    if (!String(details.solution_name ?? "").trim() || !String(details.functionality ?? "").trim()) {
      issues.push("Divulgações de sistemas exigem o nome da solução e a funcionalidade.");
    }
  }
  if (!input.hasComposition) issues.push("Salve uma composição visual com pelo menos um elemento no editor.");
  if (input.hasPendingChanges) issues.push("Há alterações não salvas no editor. Salve antes de enviar.");
  if (input.missingAssets > 0) issues.push(`${input.missingAssets} arquivo(s) usado(s) na peça não estão mais disponíveis.`);
  if (input.eligibleReviewers === 0) issues.push("Não há aprovador ativo elegível (diferente do autor). Solicite ao administrador a designação de um aprovador.");
  return issues;
}

const workflowErrors: Record<string, string> = {
  NOT_AUTHENTICATED: "Sua sessão expirou ou seu acesso está inativo.",
  FORBIDDEN_ROLE: "Seu perfil não permite esta operação editorial.",
  NOT_OWNER: "Somente o autor ou um administrador pode realizar esta operação.",
  CONTENT_NOT_FOUND: "Conteúdo não encontrado ou sem permissão de acesso.",
  STATE_CHANGED: "O estado deste conteúdo foi atualizado por outro usuário. A tela foi recarregada com a situação atual.",
  VERSION_MISMATCH: "A versão analisada não é mais a versão em revisão. Recarregue a tela antes de decidir.",
  SELF_APPROVAL: "Segregação de funções: você não pode decidir sobre um conteúdo de sua autoria ou enviado por você.",
  NOT_ASSIGNED: "Este conteúdo foi designado a outro aprovador.",
  COMMENT_REQUIRED: "Informe a justificativa da solicitação de ajustes.",
  INVALID_DECISION: "Decisão editorial inválida.",
  MISSING_TITLE: "Informe um título com pelo menos 3 caracteres.",
  MISSING_NEWSLETTER_SOURCE: "Newsletters exigem a fonte e o link de referência da notícia.",
  MISSING_SYSTEM_FIELDS: "Divulgações de sistemas exigem o nome da solução e a funcionalidade.",
  MISSING_COMPOSITION: "Salve uma composição visual com pelo menos um elemento no editor antes de enviar.",
  STALE_COMPOSITION: "A composição foi alterada após a abertura desta tela. Revise a pré-visualização e envie novamente.",
  MISSING_ASSETS: "Há arquivos da peça que não estão mais disponíveis. Substitua-os no editor.",
  INVALID_REVIEWER: "O aprovador selecionado não é elegível (inativo, sem perfil de aprovação ou autor do conteúdo).",
  NO_ELIGIBLE_REVIEWER: "Não há aprovador ativo elegível. Solicite ao administrador a designação de um aprovador.",
};

export function workflowErrorMessage(raw: string | undefined | null) {
  if (!raw) return "Não foi possível concluir a operação editorial.";
  const code = Object.keys(workflowErrors).find((key) => raw.includes(key));
  return code ? workflowErrors[code] : "Não foi possível concluir a operação editorial.";
}
