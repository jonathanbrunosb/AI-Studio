import { describe, expect, it } from "vitest";
import {
  canArchive, canCreateNewVersion, canDecide, canReviewQueue, canSubmit, isEditableStatus, lockMessages,
  validateSubmission, workflowErrorMessage, type SubmissionInput,
} from "@/lib/editorial/workflow-rules";

const AUTHOR = "author";
const APPROVER = "approver";
const base: SubmissionInput = {
  title: "Newsletter de março", category: "internal_communication", source_name: null, source_url: null, editorial_details: {},
  hasComposition: true, hasPendingChanges: false, missingAssets: 0, eligibleReviewers: 1,
};

describe("matriz de permissões editoriais", () => {
  it("editor envia apenas o próprio rascunho ou conteúdo devolvido", () => {
    expect(canSubmit(["editor"], AUTHOR, { created_by: AUTHOR, status: "draft" })).toBe(true);
    expect(canSubmit(["editor"], AUTHOR, { created_by: AUTHOR, status: "changes_requested" })).toBe(true);
    expect(canSubmit(["editor"], AUTHOR, { created_by: AUTHOR, status: "in_review" })).toBe(false);
    expect(canSubmit(["editor"], AUTHOR, { created_by: "outro", status: "draft" })).toBe(false);
    expect(canSubmit(["approver"], AUTHOR, { created_by: AUTHOR, status: "draft" })).toBe(false);
  });

  it("fila de aprovação restrita a aprovador e administrador", () => {
    expect(canReviewQueue(["editor"])).toBe(false);
    expect(canReviewQueue(["approver"])).toBe(true);
    expect(canReviewQueue(["admin"])).toBe(true);
  });

  it("proíbe autoaprovação, inclusive para administrador e para quem acumula perfis", () => {
    const content = { created_by: AUTHOR, status: "in_review" as const, assigned_reviewer_id: null };
    expect(canDecide(["admin"], AUTHOR, content, AUTHOR)).toBe(false);
    expect(canDecide(["editor", "approver"], AUTHOR, content, AUTHOR)).toBe(false);
    expect(canDecide(["admin"], "admin-submitter", { ...content }, "admin-submitter")).toBe(false);
    expect(canDecide(["approver"], APPROVER, content, AUTHOR)).toBe(true);
  });

  it("respeita o aprovador designado e o status em revisão", () => {
    const assigned = { created_by: AUTHOR, status: "in_review" as const, assigned_reviewer_id: "outro-aprovador" };
    expect(canDecide(["approver"], APPROVER, assigned, AUTHOR)).toBe(false);
    expect(canDecide(["admin"], "admin", assigned, AUTHOR)).toBe(true);
    expect(canDecide(["approver"], APPROVER, { ...assigned, assigned_reviewer_id: null, status: "approved" }, AUTHOR)).toBe(false);
  });

  it("usuário sem perfil de aprovação não decide", () => {
    expect(canDecide(["editor"], "x", { created_by: AUTHOR, status: "in_review", assigned_reviewer_id: null }, AUTHOR)).toBe(false);
  });

  it("nova versão a partir de conteúdo aprovado ou publicado; arquivamento pelo autor ou admin", () => {
    expect(canCreateNewVersion(["editor"], AUTHOR, { created_by: AUTHOR, status: "approved" })).toBe(true);
    expect(canCreateNewVersion(["editor"], AUTHOR, { created_by: AUTHOR, status: "published" })).toBe(true);
    expect(canCreateNewVersion(["editor"], "outro", { created_by: AUTHOR, status: "published" })).toBe(false);
    expect(canCreateNewVersion(["approver"], AUTHOR, { created_by: AUTHOR, status: "published" })).toBe(false);
    expect(canCreateNewVersion(["editor"], AUTHOR, { created_by: AUTHOR, status: "in_review" })).toBe(false);
    expect(canArchive(["editor"], AUTHOR, { created_by: AUTHOR, status: "approved" })).toBe(true);
    expect(canArchive(["approver"], APPROVER, { created_by: AUTHOR, status: "approved" })).toBe(false);
    expect(canArchive(["admin"], "admin", { created_by: AUTHOR, status: "archived" })).toBe(false);
  });
});

describe("bloqueio de edição por status", () => {
  it("permite edição apenas em rascunho e ajustes solicitados", () => {
    expect(isEditableStatus("draft")).toBe(true);
    expect(isEditableStatus("changes_requested")).toBe(true);
    for (const status of ["in_review", "approved", "published", "archived"] as const) {
      expect(isEditableStatus(status)).toBe(false);
      expect(lockMessages[status]).toBeTruthy();
    }
    expect(lockMessages.in_review?.message).toContain("A edição ficará disponível caso sejam solicitados ajustes");
  });
});

describe("validação do envio", () => {
  it("aceita conteúdo completo", () => {
    expect(validateSubmission(base)).toEqual([]);
  });

  it("exige fonte e referência em newsletters", () => {
    expect(validateSubmission({ ...base, category: "accounting_newsletter" }).join()).toContain("fonte");
    expect(validateSubmission({ ...base, category: "accounting_newsletter", source_name: "CFC", source_url: "https://cfc.org.br" })).toEqual([]);
  });

  it("exige solução e funcionalidade em divulgação de sistemas", () => {
    expect(validateSubmission({ ...base, category: "system_announcement" })).toHaveLength(1);
    expect(validateSubmission({ ...base, category: "system_announcement", editorial_details: { solution_name: "SAP", functionality: "Conciliação" } })).toEqual([]);
  });

  it("bloqueia conteúdo incompleto, alterações pendentes, arquivos ausentes e falta de aprovador", () => {
    const issues = validateSubmission({ ...base, title: " ", hasComposition: false, hasPendingChanges: true, missingAssets: 2, eligibleReviewers: 0 });
    expect(issues).toHaveLength(5);
  });
});

describe("mensagens de erro do fluxo", () => {
  it("traduz códigos do banco sem expor detalhes internos", () => {
    expect(workflowErrorMessage("SELF_APPROVAL")).toContain("Segregação de funções");
    expect(workflowErrorMessage("STATE_CHANGED")).toContain("atualizado por outro usuário");
    expect(workflowErrorMessage('duplicate key value violates unique constraint "x"')).toBe("Não foi possível concluir a operação editorial.");
  });
});
