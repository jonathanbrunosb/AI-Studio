"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, LoaderCircle, RotateCcw, TriangleAlert, X } from "lucide-react";
import { transitionPublicationAction } from "@/app/(protected)/publicacoes/actions";

export function DownloadPackageLink({ publicationId }: { publicationId: string }) {
  return <a className="secondary-button h-9 px-3 text-xs" href={`/api/publications/${publicationId}/package`}><Download size={14} />Baixar ZIP</a>;
}

export function PublicationAdminActions({ publicationId, status }: { publicationId: string; status: string }) {
  const [dialog, setDialog] = useState<"confirm" | "fail" | null>(null);
  const [channel, setChannel] = useState("Portal da Contabilidade · Central de Conteúdo");
  const [publishedAt, setPublishedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [externalId, setExternalId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function run(action: "confirm_published" | "mark_pending" | "fail" | "retry") {
    startTransition(async () => {
      const response = await transitionPublicationAction({ publicationId, action, channel, publishedAt, externalId, externalUrl, message });
      setResult(response);
      if (response.ok || response.stateChanged) { setDialog(null); router.refresh(); }
    });
  }

  return <div className="flex flex-wrap justify-end gap-2">
    {["prepared", "exported", "received", "pending_publication"].includes(status) && <button className="primary-button h-9 px-3 text-xs" onClick={() => setDialog("confirm")}><CheckCircle2 size={14} />Confirmar publicação</button>}
    {["exported", "received"].includes(status) && <button className="secondary-button h-9 px-3 text-xs" disabled={pending} onClick={() => run("mark_pending")}>Aguardando publicação</button>}
    {["prepared", "exported", "received", "pending_publication"].includes(status) && <button className="secondary-button h-9 px-3 text-xs text-rose-700" onClick={() => setDialog("fail")}><TriangleAlert size={14} />Registrar falha</button>}
    {status === "failed" && <button className="secondary-button h-9 px-3 text-xs" disabled={pending} onClick={() => run("retry")}><RotateCcw size={14} />Tentar novamente</button>}
    {result && !dialog && <p role="status" className={`w-full text-right text-[11px] ${result.ok ? "text-blue-700" : "text-rose-700"}`}>{result.message}</p>}
    {dialog && <div role="dialog" aria-modal="true" className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 text-left shadow-2xl">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-bold text-slate-900">{dialog === "confirm" ? "Confirmar publicação" : "Registrar falha de integração"}</h3><button onClick={() => setDialog(null)} aria-label="Fechar"><X size={18} /></button></div>
        {dialog === "confirm" ? <div className="space-y-3 text-xs">
          <p className="text-slate-500">Registre somente após verificar o material publicado no portal. A confirmação é definitiva e substitui a publicação anterior deste conteúdo, se houver.</p>
          <label className="block font-bold text-slate-600">Canal utilizado<input className="field mt-1" value={channel} onChange={(event) => setChannel(event.target.value)} maxLength={120} /></label>
          <label className="block font-bold text-slate-600">Data da publicação<input type="date" className="field mt-1" value={publishedAt} onChange={(event) => setPublishedAt(event.target.value)} /></label>
          <label className="block font-bold text-slate-600">Identificador no portal (opcional)<input className="field mt-1" value={externalId} onChange={(event) => setExternalId(event.target.value)} maxLength={200} placeholder="ex.: ais-1a2b3c4d-v3" /></label>
          <label className="block font-bold text-slate-600">Link interno (opcional)<input className="field mt-1" value={externalUrl} onChange={(event) => setExternalUrl(event.target.value)} placeholder="https://portal.contabilidade-eqtl.com/#central" /></label>
        </div> : <label className="block text-xs font-bold text-slate-600">Descrição da falha<textarea className="field mt-1 min-h-24" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={1000} placeholder="Ex.: pacote recusado na importação — hash divergente." /></label>}
        {result && !result.ok && <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-2 text-xs text-rose-700">{result.message}</p>}
        <div className="mt-4 flex justify-end gap-2"><button className="secondary-button" onClick={() => setDialog(null)}>Cancelar</button><button className="primary-button" disabled={pending} onClick={() => run(dialog === "confirm" ? "confirm_published" : "fail")}>{pending && <LoaderCircle size={14} className="animate-spin" />}Confirmar</button></div>
      </div>
    </div>}
  </div>;
}
