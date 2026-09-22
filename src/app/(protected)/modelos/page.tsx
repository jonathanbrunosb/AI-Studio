import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { CreativeCanvas } from "@/components/studio/creative-canvas";
import { requireUser } from "@/lib/auth/authorization";
import { getBranding } from "@/lib/content/branding-service";
import { readLayout } from "@/lib/content/editorial";
import { contentCategoryLabels, type ContentCategory } from "@/types/content";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ preview?: string }> }) {
  const params = await searchParams;
  const { supabase, roles } = await requireUser();
  const [{ data: templates, error }, brand] = await Promise.all([
    supabase.from("templates").select("*").eq("is_active", true).order("created_at").order("name"),
    getBranding(supabase),
  ]);
  if (error) throw new Error("Não foi possível carregar os modelos.");
  const selected = templates?.find((t) => t.id === params.preview);
  const canCreate = roles.some((r) => r === "admin" || r === "editor");
  return <div><PageHeader eyebrow="Biblioteca corporativa" title="Modelos" description="Quatro composições para transformar informação em comunicação clara e consistente." actions={roles.includes("admin") ? <Link href="/administracao/identidade" className="secondary-button">Identidade visual</Link> : undefined} />
    {selected && <section className="surface-card mb-6 grid gap-5 p-5 lg:grid-cols-2"><CreativeCanvas title={selected.name} subtitle="Sua mensagem ganha forma aqui." description={selected.description} layout={readLayout(selected.configuration, selected.category as ContentCategory)} brand={brand} /><div className="self-center p-4"><p className="eyebrow">Composição do modelo</p><h3 className="mt-2 text-2xl font-bold">{selected.name}</h3><p className="mt-3 text-sm text-slate-500">{selected.description}</p><p className="mt-4 text-sm text-slate-500">Cabeçalho institucional, área editorial, imagem de apoio e assinatura. O layout será copiado para seu novo material.</p><div className="mt-5 flex gap-3">{canCreate && <Link href={`/studio?template=${selected.id}`} className="primary-button">Usar modelo</Link>}<Link href="/modelos" className="secondary-button">Fechar prévia</Link></div></div></section>}
    <div className="grid gap-5 md:grid-cols-2">{templates?.map((template) => {
      const layout = readLayout(template.configuration, template.category as ContentCategory);
      return <article key={template.id} className="surface-card overflow-hidden"><CreativeCanvas compact title={template.name} description={template.description} layout={layout} brand={brand} /><div className="p-5"><p className="eyebrow">{contentCategoryLabels[template.category as ContentCategory]}</p><h3 className="mt-2 text-lg font-bold">{template.name}</h3><p className="mt-2 text-sm text-slate-500">{layout.width} × {layout.height} px · Identidade institucional</p><div className="mt-5 flex gap-2"><Link className="secondary-button" href={`/modelos?preview=${template.id}`}>Visualizar composição</Link>{canCreate && <Link className="primary-button" href={`/studio?template=${template.id}`}>Usar modelo</Link>}</div></div></article>;
    })}</div>{!templates?.length && <p className="surface-card p-8 text-slate-500">Nenhum modelo disponível.</p>}
  </div>;
}
