import { Eye, Filter, LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import { ContentStatusBadge } from "@/components/shared/content-status-badge";
import { requireUser } from "@/lib/auth/authorization";
import { listContents } from "@/lib/content/content-service";
import { contentCategoryLabels } from "@/types/content";

export default async function EditorialPage() {
  const { supabase, roles } = await requireUser();
  if (!roles.some((role) => role === "admin" || role === "approver")) return <div className="surface-card p-10 text-center"><LockKeyhole className="mx-auto text-slate-400" /><h2 className="mt-4 text-xl font-bold">Acesso de aprovador necessário</h2><p className="mt-2 text-sm text-slate-500">A fila editorial é restrita aos perfis de aprovação e administração.</p></div>;
  const items = (await listContents(supabase)).filter((item) => item.status === "in_review");
  return <div><PageHeader eyebrow="Governança de conteúdo" title="Gestão Editorial" description="Consulte os conteúdos enviados para revisão. As decisões editoriais serão ativadas na próxima sprint." actions={<button className="secondary-button"><Filter size={16} />Filtrar fila</button>} /><SectionCard title="Fila de revisão" description={`${items.length} conteúdo(s) aguardando análise`}>{!items.length ? <div className="p-12 text-center text-sm text-slate-500">Nenhum conteúdo está aguardando aprovação.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead><tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500"><th className="px-6 py-3">Conteúdo</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Status</th><th className="px-6 py-3 text-right">Ação</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-6 py-4"><p className="font-bold text-slate-800">{item.title}</p><p className="mt-1 text-xs text-slate-400">{contentCategoryLabels[item.category]}</p></td><td className="px-4 py-4 text-sm text-slate-600">{item.owner}</td><td className="px-4 py-4 text-sm text-slate-500">{item.date}</td><td className="px-4 py-4"><ContentStatusBadge status={item.status} /></td><td className="px-6 py-4 text-right"><a href={`/studio?id=${item.id}`} className="secondary-button px-3"><Eye size={15} />Visualizar</a></td></tr>)}</tbody></table></div>}</SectionCard></div>;
}
