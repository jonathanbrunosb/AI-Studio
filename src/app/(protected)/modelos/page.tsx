import { LayoutTemplate, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/authorization";

export default async function TemplatesPage() {
  const { supabase, roles } = await requireUser();
  const { data: templates } = await supabase.from("templates").select("id, name, description, configuration").eq("is_active", true).order("name");
  return <div><PageHeader eyebrow="Padronização visual" title="Modelos" description="Estruturas aprovadas e persistidas para preservar a consistência da comunicação contábil." actions={roles.includes("admin") ? <button className="secondary-button"><Plus size={16} />Novo modelo</button> : undefined} />{!templates?.length ? <div className="surface-card p-12 text-center"><LayoutTemplate className="mx-auto text-slate-400" size={32} /><h3 className="mt-4 font-bold text-slate-800">Nenhum modelo configurado</h3><p className="mt-2 text-sm text-slate-500">Os modelos corporativos serão cadastrados em uma próxima etapa.</p></div> : <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">{templates.map((template) => <article key={template.id} className="surface-card overflow-hidden"><div className="h-44 bg-gradient-to-br from-blue-950 to-blue-500 p-5 text-white"><LayoutTemplate size={24} /><p className="mt-16 text-xl font-bold">{template.name}</p></div><div className="p-5"><p className="text-sm text-slate-500">{template.description}</p><a href={`/studio?template=${template.id}`} className="primary-button mt-5 w-full">Usar modelo</a></div></article>)}</div>}</div>;
}
