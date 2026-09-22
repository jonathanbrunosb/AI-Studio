import Link from "next/link";
import { Copy, Search } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ContentStatusBadge } from "@/components/shared/content-status-badge";
import { requireUser } from "@/lib/auth/authorization";
import { contentCategoryLabels, contentStatusLabels, type ContentCategory, type ContentStatus } from "@/types/content";
import { duplicateContentAction } from "../studio/actions";

export default async function LibraryPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { supabase, roles, user } = await requireUser();
  const page = Math.max(1, Math.min(10000, Number(params.page) || 1));
  const pageSize = 12;
  let query = supabase.from("contents").select("id,title,category,status,created_by,created_at,collection_name,template_id,templates(name)", { count: "exact" });
  if (params.q?.trim()) query = query.ilike("title", `%${params.q.trim().replace(/[%_\\]/g, "")}%`);
  if (params.category && params.category in contentCategoryLabels) query = query.eq("category", params.category);
  if (params.status && params.status in contentStatusLabels) query = query.eq("status", params.status);
  if (params.collection?.trim()) query = query.eq("collection_name", params.collection.trim());
  if (params.mine === "1") query = query.eq("created_by", user.id);
  query = query.order(params.sort === "title" ? "title" : "created_at", { ascending: params.sort === "title" }).order("id");
  const { data: items, count, error } = await query.range((page - 1) * pageSize, page * pageSize - 1);
  const canCreate = roles.some((r) => r === "admin" || r === "editor");
  const pageUrl = (next: number) => { const values = new URLSearchParams(); Object.entries(params).forEach(([k,v]) => { if (v && k !== "error") values.set(k,v); }); values.set("page",String(next)); return `/biblioteca?${values}`; };
  return <div><PageHeader eyebrow="Acervo editorial" title="Biblioteca de projetos" description="Encontre seus materiais, organize coleções e continue de onde parou." actions={canCreate ? <Link href="/studio" className="primary-button">+ Criar conteúdo</Link> : undefined} />
    {params.error && <p role="alert" className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Não foi possível duplicar este conteúdo. Verifique seu acesso e tente novamente.</p>}
    <form className="surface-card mb-6 space-y-3 p-4"><div className="grid gap-3 lg:grid-cols-[2fr_1fr_1fr]"><label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3"><Search size={17} /><input name="q" aria-label="Buscar por título" defaultValue={params.q} placeholder="Buscar por título..." className="h-11 w-full bg-transparent outline-none" /></label><select name="category" aria-label="Categoria" className="field" defaultValue={params.category ?? ""}><option value="">Todas as categorias</option>{Object.entries(contentCategoryLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select><select name="status" aria-label="Status" className="field" defaultValue={params.status ?? ""}><option value="">Todos os status</option>{Object.entries(contentStatusLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></div><div className="flex flex-wrap items-center gap-3"><input name="collection" aria-label="Coleção" className="field sm:max-w-56" defaultValue={params.collection} placeholder="Coleção / projeto" /><select name="sort" aria-label="Ordenação" className="field sm:max-w-48" defaultValue={params.sort ?? "recent"}><option value="recent">Mais recentes</option><option value="title">Título A–Z</option></select><label className="flex items-center gap-2 text-sm text-slate-600"><input name="mine" value="1" type="checkbox" defaultChecked={params.mine === "1"} />Meus materiais</label><button className="primary-button">Filtrar</button><Link href="/biblioteca" className="text-sm font-semibold text-blue-700">Limpar</Link></div></form>
    {error ? <p role="alert" className="surface-card p-8">Não foi possível consultar a biblioteca. Tente novamente.</p> : <>
      <p className="mb-4 text-sm text-slate-500">{count ?? 0} material(is) encontrado(s)</p>
      {!items?.length ? <div className="surface-card p-12 text-center"><h3 className="font-bold">Nenhum material encontrado</h3><p className="mt-2 text-sm text-slate-500">Ajuste os filtros ou crie um novo conteúdo para começar.</p></div> : <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{items.map((item) => <article key={item.id} className="surface-card overflow-hidden"><div className="relative min-h-40 overflow-hidden bg-gradient-to-br from-[#0b2b50] to-[#1769aa] p-6 text-white"><div className="absolute -right-8 -top-8 size-36 rounded-full border-[20px] border-white/10" /><p className="relative text-[10px] font-bold uppercase tracking-wider text-blue-100">{contentCategoryLabels[item.category as ContentCategory]}</p><h3 className="relative mt-4 break-words text-xl font-bold">{item.title}</h3></div><div className="space-y-3 p-5"><div className="flex items-center justify-between"><ContentStatusBadge status={item.status as ContentStatus} /><span className="text-xs text-slate-400">{new Date(item.created_at).toLocaleDateString("pt-BR")}</span></div><p className="text-xs text-slate-500">Modelo: {item.templates?.name ?? "Personalizado"}</p><p className="text-xs text-slate-500">Coleção: {item.collection_name || "Sem coleção"} · {item.created_by === user.id ? "Meu material" : "Compartilhado"}</p><div className="flex items-center justify-between border-t border-slate-100 pt-3"><Link href={`/studio?id=${item.id}`} className="text-sm font-bold text-blue-700">Abrir material</Link>{canCreate && <form action={duplicateContentAction}><input name="id" type="hidden" value={item.id} /><button className="secondary-button"><Copy size={14} />Duplicar</button></form>}</div></div></article>)}</div>}
      <nav aria-label="Paginação" className="mt-6 flex items-center justify-between">{page > 1 ? <Link href={pageUrl(page-1)} className="secondary-button">Anterior</Link> : <span />}<span className="text-sm text-slate-500">Página {page}</span>{page * pageSize < (count ?? 0) ? <Link href={pageUrl(page+1)} className="secondary-button">Próxima</Link> : <span />}</nav>
    </>}
  </div>;
}
