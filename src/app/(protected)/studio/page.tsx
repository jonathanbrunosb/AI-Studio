import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { StudioForm } from "@/components/studio/studio-form";
import { CategoryPicker } from "@/components/studio/category-picker";
import { requireUser } from "@/lib/auth/authorization";
import { getBranding } from "@/lib/content/branding-service";
import { categories } from "@/lib/content/editorial";
import type { ContentCategory } from "@/types/content";
import type { Tables } from "@/types/database";
import { ArchiveButton, NewVersionButton } from "@/components/editorial/workflow-actions";
import { SubmitReviewButton } from "@/components/editorial/submit-review-dialog";
import { collectStoragePaths, signSnapshotAssets } from "@/lib/editor/snapshot-assets";
import { canArchive, canCreateNewVersion, canSubmit, lockMessages, validateSubmission } from "@/lib/editorial/workflow-rules";
import { getLatestChangeRequest } from "@/lib/editorial/workflow-service";
import type { ContentStatus } from "@/types/content";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ id?: string; category?: string; template?: string; saved?: string; copied?: string; submitted?: string; submit?: string }> }) {
  const params = await searchParams;
  const { supabase, roles, user } = await requireUser();
  const canCreate = roles.some((r) => r === "admin" || r === "editor");
  let content: Tables<"contents"> | null = null;
  let template: Tables<"templates"> | null = null;
  if (params.id) {
    const result = await supabase.from("contents").select("*").eq("id", params.id).maybeSingle();
    if (result.error) throw new Error("Não foi possível consultar o conteúdo.");
    if (!result.data) notFound();
    content = result.data;
  }
  const templateId = content?.template_id ?? params.template;
  if (templateId) {
    const result = await supabase.from("templates").select("*").eq("id", templateId).maybeSingle();
    if (result.error) throw new Error("Não foi possível consultar o modelo.");
    if (!result.data && !content) notFound();
    template = result.data;
  }
  const category = content?.category ?? template?.category ?? params.category;
  const validCategory = categories.includes(category as ContentCategory);
  if (!content && !template && validCategory) {
    const result = await supabase.from("templates").select("*").eq("category", category!).eq("is_active", true).order("created_at").limit(1).maybeSingle();
    if (result.error) throw new Error("Não foi possível carregar o modelo corporativo.");
    template = result.data;
  }
  if (!content && !canCreate) return <div className="surface-card p-8">Seu perfil permite consultar materiais. A criação exige acesso editorial.</div>;
  if (!content && !validCategory) return <div><PageHeader eyebrow="Nova criação" title="O que você deseja comunicar?" description="Escolha uma categoria para começar com os campos e a composição adequados." /><CategoryPicker /></div>;
  const readOnly = Boolean(content && (!canCreate || !["draft", "changes_requested"].includes(content.status) || (!roles.includes("admin") && content.created_by !== user.id)));
  const brand = await getBranding(supabase);
  const workflow = content ? await loadWorkflowContext(supabase, content, user.id, roles) : null;
  const status = content?.status as ContentStatus | undefined;
  const lock = status ? lockMessages[status] : undefined;
  return <div><PageHeader eyebrow="Produção editorial" title={readOnly ? "Consultar material" : content ? "Editar material" : "Novo material"} description="Organize o conteúdo e personalize sua composição com a identidade da Contabilidade." actions={<>{content && !readOnly && <Link className="secondary-button" href={`/studio/editor/${content.id}`}>Abrir editor visual</Link>}{workflow?.submitData && <SubmitReviewButton data={workflow.submitData} autoOpen={params.submit === "1"} />}{workflow?.canNewVersion && content && <NewVersionButton contentId={content.id} />}{content && content.status !== "draft" && <Link className="secondary-button" href={`/gestao-editorial/revisao/${content.id}#historico`}>Histórico editorial</Link>}{workflow?.canArchive && content && <ArchiveButton contentId={content.id} published={content.status === "published"} />}<Link className="secondary-button" href="/biblioteca">Voltar à biblioteca</Link></>} />
    {params.submitted && <p role="status" className="mb-5 rounded-xl bg-blue-50 p-4 text-sm font-semibold text-blue-800">Conteúdo encaminhado para aprovação. O aprovador foi notificado.</p>}
    {lock && <div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><p className="font-bold">{lock.title}</p><p className="mt-1">{lock.message}</p></div>}
    {workflow?.changeRequest && content?.status === "changes_requested" && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><p className="font-bold">Ajustes solicitados por {workflow.changeRequest.reviewer}</p><p className="mt-1 whitespace-pre-line">{workflow.changeRequest.comment}</p><p className="mt-2 text-xs text-rose-600">Realize as correções e envie novamente para aprovação. A versão anterior permanece no histórico.</p></div>}
    {content?.approved_version_id && content.status === "draft" && <p className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">Existe uma versão aprovada preservada. Esta nova versão precisará de nova aprovação antes de ser disponibilizada.</p>}
    {(params.saved || params.copied) && <p role="status" className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{params.copied ? "Cópia independente criada como rascunho." : "Material salvo com sucesso."}</p>}
    {readOnly && !lock && <p className="mb-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">Visualização somente para leitura conforme seu perfil e a etapa editorial.</p>}
    <StudioForm key={content?.id ?? template?.id ?? category} content={content} category={category as ContentCategory} template={template} brand={brand} readOnly={readOnly} />
  </div>;
}

async function loadWorkflowContext(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], content: Tables<"contents">, userId: string, roles: Awaited<ReturnType<typeof requireUser>>["roles"]) {
  const status = content.status as ContentStatus;
  const submittable = canSubmit(roles, userId, { created_by: content.created_by, status });
  const changeRequest = status === "changes_requested" ? await getLatestChangeRequest(supabase, content.id) : null;
  let submitData = null;
  if (submittable) {
    const [{ data: working }, { data: owner }] = await Promise.all([
      supabase.from("content_versions").select("snapshot, updated_at, version_number").eq("content_id", content.id).eq("version_kind", "working").maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", content.created_by).maybeSingle(),
    ]);
    const paths = [...collectStoragePaths(working?.snapshot)];
    const { data: available } = paths.length
      ? await supabase.from("media_assets").select("storage_path").in("storage_path", paths).is("deleted_at", null)
      : { data: [] };
    const elements = (working?.snapshot as { elements?: unknown[] } | undefined)?.elements;
    const issues = validateSubmission({
      title: content.title, category: content.category as ContentCategory, source_name: content.source_name, source_url: content.source_url,
      editorial_details: content.editorial_details as Record<string, unknown>, hasComposition: Array.isArray(elements) && elements.length > 0,
      hasPendingChanges: false, missingAssets: paths.length - (available?.length ?? 0), eligibleReviewers: 1,
    });
    submitData = {
      contentId: content.id, title: content.title, category: content.category as ContentCategory, authorName: owner?.full_name ?? "—",
      referenceDate: content.reference_date, nextCycle: content.review_cycle + 1, workingVersionNumber: working?.version_number ?? null,
      workingUpdatedAt: working?.updated_at ?? null,
      snapshot: working?.snapshot ? (await signSnapshotAssets(supabase, working.snapshot)).snapshot : null, issues,
    };
  }
  return {
    submitData, changeRequest,
    canNewVersion: canCreateNewVersion(roles, userId, { created_by: content.created_by, status }),
    canArchive: canArchive(roles, userId, { created_by: content.created_by, status }),
  };
}
