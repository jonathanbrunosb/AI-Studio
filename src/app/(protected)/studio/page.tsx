import { ChevronLeft, Save } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { StudioForm } from "@/components/studio/studio-form";
import { CreativeCanvas } from "@/components/studio/creative-canvas";
import { ImageGeneratorMock } from "@/components/studio/image-generator-mock";
import { requireUser } from "@/lib/auth/authorization";

export default async function StudioPage({ searchParams }: { searchParams: Promise<{ id?: string; saved?: string; error?: string }> }) {
  const params = await searchParams;
  const { supabase, roles } = await requireUser();
  if (!roles.some((role) => role === "admin" || role === "editor")) return <AccessMessage />;

  let content = null;
  if (params.id) {
    const { data, error } = await supabase.from("contents").select("*").eq("id", params.id).maybeSingle();
    if (error || !data) notFound();
    content = data;
  }

  return <div><PageHeader eyebrow="Workspace criativo" title={content ? "Editar conteúdo" : "Estúdio de Criação"} description="Estruture o conteúdo, acompanhe a peça visual e salve um rascunho persistido." actions={<><a href="/dashboard" className="secondary-button"><ChevronLeft size={16} />Voltar</a><button form="studio-content-form" type="submit" className="primary-button"><Save size={16} />Salvar rascunho</button></>} />{params.saved && <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-800">Rascunho salvo com sucesso.</div>}{params.error && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{params.error}</div>}<div className="grid min-w-0 items-start gap-5 2xl:grid-cols-[minmax(275px,.8fr)_minmax(440px,1.5fr)_minmax(270px,.8fr)]"><SectionCard title="Conteúdo" description="Informações editoriais persistidas"><StudioForm content={content} /></SectionCard><SectionCard title="Peça em construção" description="Visualização aproximada do resultado"><CreativeCanvas title={content?.title} subtitle={content?.subtitle} description={content?.description} /></SectionCard><SectionCard title="Imagem de apoio" description="Configuração reservada para sprint futura"><ImageGeneratorMock /></SectionCard></div></div>;
}

function AccessMessage() { return <div className="surface-card p-10 text-center"><h2 className="text-xl font-bold text-slate-900">Acesso editorial necessário</h2><p className="mt-2 text-sm text-slate-500">Seu perfil pode consultar conteúdos, mas não criar ou editar rascunhos.</p></div>; }
