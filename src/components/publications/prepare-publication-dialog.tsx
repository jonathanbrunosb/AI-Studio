"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink, LoaderCircle, PackageCheck, X } from "lucide-react";
import { preparePublicationAction } from "@/app/(protected)/publicacoes/actions";
import { ProjectPreview } from "@/components/editorial/project-preview";
import { renderSnapshotPng } from "@/lib/editor/render-snapshot";
import { contentCategoryLabels, type ContentCategory } from "@/types/content";

export type PrepareData = {
  contentId: string; versionId: string; versionNumber: number; category: ContentCategory; approvedAt: string | null; contentStatus: string;
  editorial: { title?: string; subtitle?: string | null; description?: string | null; reference_date?: string | null; source_name?: string | null; source_url?: string | null; editorial_details?: Record<string, unknown> | null };
  snapshot: unknown; destinations: { id: string; label: string; portal_category: string; isDefault: boolean }[]; unavailableAssets: number; supersedes: string | null;
};

export function PreparePublicationButton({ data, label = "Preparar publicação" }: { data: PrepareData; label?: string }) {
  const [open, setOpen] = useState(false);
  const [destination, setDestination] = useState(data.destinations[0]?.id ?? "");
  const [reviewed, setReviewed] = useState(false);
  const [accessConfirmed, setAccessConfirmed] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; publicationId?: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const accessUrl = typeof data.editorial.editorial_details?.access_url === "string" ? data.editorial.editorial_details.access_url : "";
  const blockers = [
    ...(data.unavailableAssets > 0 ? [`${data.unavailableAssets} arquivo(s) da peça aprovada indisponível(is): o pacote não pode ser gerado.`] : []),
    ...(!data.destinations.length ? ["Nenhum destino habilitado para esta categoria. Solicite a configuração ao administrador."] : []),
  ];

  function prepare() {
    startTransition(async () => {
      setResult(null);
      try {
        const { blob } = await renderSnapshotPng(data.snapshot);
        const form = new FormData();
        form.set("contentId", data.contentId); form.set("versionId", data.versionId); form.set("destination", destination);
        form.set("reviewConfirmed", String(reviewed)); form.set("accessUrlConfirmed", String(accessConfirmed));
        form.set("image", new File([blob], "peca.png", { type: "image/png" }));
        const response = await preparePublicationAction(form);
        setResult(response);
        router.refresh();
      } catch {
        setResult({ ok: false, message: "Não foi possível gerar a imagem da peça neste navegador. Tente novamente." });
      }
    });
  }

  const info: [string, string | null | undefined][] = [
    ["Categoria", contentCategoryLabels[data.category]], ["Versão aprovada", `v${data.versionNumber}`],
    ["Aprovada em", data.approvedAt ? new Date(data.approvedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : null],
    ["Data de referência", data.editorial.reference_date ? new Date(`${data.editorial.reference_date}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada"],
    ["Fonte", data.editorial.source_name ?? "Não informada"],
  ];

  return <>
    <button className="primary-button h-9 px-3 text-xs" onClick={() => setOpen(true)}><PackageCheck size={14} />{label}</button>
    {open && <div role="dialog" aria-modal="true" aria-label="Preparar publicação" className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/55 p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white text-left shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="eyebrow">Central de Publicações</p><h3 className="mt-1 text-xl font-bold text-slate-900">Preparar publicação</h3><p className="mt-1 text-xs text-slate-500">O pacote usa exclusivamente a versão aprovada. Nenhum dado pode ser alterado aqui.</p></div><button onClick={() => setOpen(false)} aria-label="Fechar" className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-3 text-sm">
            <h4 className="text-lg font-bold text-slate-900">{data.editorial.title}</h4>
            {data.editorial.subtitle && <p className="text-slate-600">{data.editorial.subtitle}</p>}
            <dl className="grid grid-cols-2 gap-2 text-xs">{info.map(([label, value]) => <div key={label}><dt className="font-bold text-slate-500">{label}</dt><dd className="text-slate-800">{value ?? "—"}</dd></div>)}</dl>
            {data.editorial.description && <div><p className="text-xs font-bold text-slate-500">Resumo da comunicação</p><p className="mt-1 line-clamp-5 whitespace-pre-line text-xs leading-5 text-slate-700">{data.editorial.description}</p></div>}
            {data.editorial.source_url && <a href={data.editorial.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><ExternalLink size={12} />Link de referência</a>}
            <label className="block text-xs font-bold text-slate-600">Canal de destino<select className="field mt-1" value={destination} onChange={(event) => setDestination(event.target.value)}>{data.destinations.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            {accessUrl && <label className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-700"><input type="checkbox" checked={accessConfirmed} onChange={(event) => setAccessConfirmed(event.target.checked)} className="mt-0.5" /><span>Validei o link de acesso ao sistema: <a className="font-bold text-blue-700 underline" href={accessUrl} target="_blank" rel="noopener noreferrer">{accessUrl}</a></span></label>}
            {data.contentStatus !== "approved" && data.contentStatus !== "published" && <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">Há uma nova versão em elaboração. Este pacote usará a última versão <strong>aprovada</strong> (v{data.versionNumber}).</p>}
            {data.supersedes && <p className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800">Esta versão substituirá a publicação anterior somente após a confirmação da nova publicação no portal.</p>}
            <label className="flex items-start gap-2 text-xs text-slate-700"><input type="checkbox" checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} className="mt-0.5" />Conferi título, categoria, versão, destino e pré-visualização.</label>
            {blockers.length > 0 && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700"><p className="flex items-center gap-1 font-bold"><AlertTriangle size={13} />Preparação bloqueada</p><ul className="mt-1 list-disc pl-5">{blockers.map((item) => <li key={item}>{item}</li>)}</ul></div>}
            {result && <div role="status" className={`rounded-xl p-3 text-xs font-semibold ${result.ok ? "bg-blue-50 text-blue-800" : "bg-rose-50 text-rose-700"}`}>{result.message}{result.ok && result.publicationId && <a className="ml-2 underline" href={`/api/publications/${result.publicationId}/package`}>Baixar pacote ZIP</a>}</div>}
          </div>
          <div><p className="mb-2 text-xs font-bold text-slate-600">Peça aprovada (v{data.versionNumber})</p><ProjectPreview snapshot={data.snapshot} zoomable /></div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-5"><button className="secondary-button" onClick={() => setOpen(false)}>Fechar</button><button className="primary-button disabled:cursor-not-allowed disabled:bg-slate-300" disabled={pending || !reviewed || blockers.length > 0 || (Boolean(accessUrl) && !accessConfirmed)} onClick={prepare}>{pending ? <LoaderCircle size={16} className="animate-spin" /> : <PackageCheck size={16} />}Gerar pacote</button></div>
      </div>
    </div>}
  </>;
}
