import { createHash } from "node:crypto";
import type { ContentCategory } from "@/types/content";
import { contentCategoryLabels } from "@/types/content";

export const MANIFEST_SCHEMA_VERSION = "1.0";

export function sha256Hex(data: Uint8Array | string) {
  return createHash("sha256").update(data).digest("hex");
}

export function slugify(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "conteudo";
}

export type Destination = { id: string; label: string; portal_collection: string; portal_category: string };

export type ManifestInput = {
  publicationId: string;
  content: { id: string; title: string; subtitle: string | null; description: string | null; category: ContentCategory; reference_date: string | null; source_name: string | null; source_url: string | null; editorial_details: Record<string, unknown> };
  version: { id: string; number: number; approvedAt: string; snapshotSha256: string };
  destination: Destination;
  image: { filename: string; width: number; height: number; bytes: number; sha256: string };
  organization: string;
  supersedes: { publicationId: string; versionId: string | null; externalPublicationId: string | null } | null;
  preparedAt: string;
};

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const httpUrl = (value: unknown) => {
  const raw = text(value);
  if (!raw) return null;
  try { const url = new URL(raw); return url.protocol === "https:" || url.protocol === "http:" ? url.href : null; } catch { return null; }
};

/**
 * Dados provenientes exclusivamente da versão aprovada (congelada).
 * Sem credenciais, URLs assinadas, e-mails ou nomes de usuários.
 */
export function buildManifest(input: ManifestInput) {
  const details = input.content.editorial_details ?? {};
  const summary = text(input.content.subtitle) ?? text(input.content.description)?.slice(0, 300) ?? input.content.title;
  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    generator: "ai-studio-comunicacao-contabil",
    publication_id: input.publicationId,
    content_id: input.content.id,
    version_id: input.version.id,
    title: input.content.title,
    subtitle: text(input.content.subtitle),
    summary,
    description: text(input.content.description),
    category: input.content.category,
    category_label: contentCategoryLabels[input.content.category],
    destination: { id: input.destination.id, label: input.destination.label, portal_collection: input.destination.portal_collection, portal_category: input.destination.portal_category },
    reference_date: input.content.reference_date,
    source_name: text(input.content.source_name),
    source_url: httpUrl(input.content.source_url),
    access_url: httpUrl(details.access_url),
    system_name: text(details.solution_name),
    functionality: text(details.functionality),
    institutional_owner: input.organization,
    image: { filename: input.image.filename, width: input.image.width, height: input.image.height, format: "png", bytes: input.image.bytes, sha256: input.image.sha256 },
    approval: { version_id: input.version.id, version_number: input.version.number, approved_at: input.version.approvedAt, snapshot_sha256: input.version.snapshotSha256 },
    supersedes: input.supersedes ? { publication_id: input.supersedes.publicationId, version_id: input.supersedes.versionId, external_publication_id: input.supersedes.externalPublicationId } : null,
    prepared_at: input.preparedAt,
  };
}

export type Manifest = ReturnType<typeof buildManifest>;

export function buildReadme(manifest: Manifest, signed: boolean) {
  return [
    "AI STUDIO — COMUNICAÇÃO CONTÁBIL · PACOTE DE PUBLICAÇÃO",
    "",
    `Título: ${manifest.title}`,
    `Categoria: ${manifest.category_label}`,
    `Destino previsto: ${manifest.destination.label}`,
    `Categoria no portal: ${manifest.destination.portal_category}`,
    `Versão aprovada: v${manifest.approval.version_number} (${manifest.approval.version_id})`,
    `Aprovada em: ${manifest.approval.approved_at}`,
    manifest.supersedes ? `Substitui a publicação: ${manifest.supersedes.external_publication_id ?? manifest.supersedes.publication_id}` : "Substitui: nenhuma publicação anterior",
    "",
    "COMO IMPORTAR",
    "1. Portal da Gerência de Contabilidade → Administração → aba \"Importar do AI Studio\".",
    "2. Selecione este arquivo .zip (não extraia).",
    "3. Confira a validação de integridade (SHA-256) e de origem (assinatura).",
    "4. Revise a pré-visualização e confirme a importação.",
    "5. O conteúdo entra como \"Em revisão\" no Painel Editorial; a publicação exige a aprovação final no portal.",
    "6. Após publicar, registre a confirmação na Central de Publicações do AI Studio.",
    "",
    "ARQUIVOS",
    "- manifest.json: dados estruturados da versão aprovada.",
    `- ${manifest.image.filename}: peça visual (${manifest.image.width}×${manifest.image.height}).`,
    "- checksums.sha256: hashes SHA-256 do manifesto e da imagem.",
    signed ? "- manifest.sig: assinatura ECDSA P-256 (SHA-256) do manifest.json." : "- Pacote NÃO assinado: a origem deve ser confirmada pelo administrador.",
    "",
    "O hash comprova integridade; a assinatura comprova a origem. Nenhum dos dois substitui a revisão final no portal.",
    "",
  ].join("\r\n");
}
