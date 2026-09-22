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

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ id?: string; category?: string; template?: string; saved?: string; copied?: string }> }) {
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
  return <div><PageHeader eyebrow="Produção editorial" title={readOnly ? "Consultar material" : content ? "Editar material" : "Novo material"} description="Organize o conteúdo e personalize sua composição com a identidade da Contabilidade." actions={<Link className="secondary-button" href="/biblioteca">Voltar à biblioteca</Link>} />
    {(params.saved || params.copied) && <p role="status" className="mb-5 rounded-xl bg-blue-50 p-4 text-sm text-blue-800">{params.copied ? "Cópia independente criada como rascunho." : "Material salvo com sucesso."}</p>}
    {readOnly && <p className="mb-5 rounded-xl bg-slate-100 p-4 text-sm text-slate-600">Visualização somente para leitura conforme seu perfil e a etapa editorial.</p>}
    <StudioForm key={content?.id ?? template?.id ?? category} content={content} category={category as ContentCategory} template={template} brand={brand} readOnly={readOnly} />
  </div>;
}
