"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Send, X } from "lucide-react";
import { listEligibleReviewersAction, submitForReviewAction } from "@/app/(protected)/gestao-editorial/actions";
import { contentCategoryLabels, type ContentCategory } from "@/types/content";
import { ProjectPreview } from "./project-preview";

export type SubmitDialogData = {
  contentId: string; title: string; category: ContentCategory; authorName: string; referenceDate: string | null;
  nextCycle: number; workingVersionNumber: number | null; workingUpdatedAt: string | null; snapshot: unknown; issues: string[];
};

export function SubmitReviewButton({ data, autoOpen = false }: { data: SubmitDialogData; autoOpen?: boolean }) {
  const [open, setOpen] = useState(autoOpen);
  const [reviewers, setReviewers] = useState<{ id: string; full_name: string }[] | null>(null);
  const [reviewerId, setReviewerId] = useState("");
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function openDialog() {
    setOpen(true); setError(null);
    if (!reviewers) setReviewers(await listEligibleReviewersAction(data.contentId));
  }
  useEffect(() => {
    if (!autoOpen) return;
    let cancelled = false;
    void listEligibleReviewersAction(data.contentId).then((list) => { if (!cancelled) setReviewers(list); });
    return () => { cancelled = true; };
  }, [autoOpen, data.contentId]);

  function submit() {
    startTransition(async () => {
      const result = await submitForReviewAction({
        contentId: data.contentId, reviewerId: reviewerId || null, comment: comment.trim() || null,
        expectedWorkingUpdatedAt: data.workingUpdatedAt,
      });
      if (!result.ok) { setError(result.message); if (result.stateChanged) router.refresh(); return; }
      setOpen(false);
      router.push(`/studio?id=${data.contentId}&submitted=1`);
      router.refresh();
    });
  }

  const noReviewer = reviewers !== null && reviewers.length === 0;
  const issues = [...data.issues, ...(noReviewer ? ["Não há aprovador ativo elegível (diferente do autor). Solicite ao administrador a designação de um aprovador."] : [])];

  return <>
    <button className="primary-button" onClick={() => void openDialog()}><Send size={16} />Enviar para aprovação</button>
    {open && <div role="dialog" aria-modal="true" aria-label="Enviar para aprovação" className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-slate-950/55 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 p-5"><div><p className="eyebrow">Fluxo editorial</p><h3 className="mt-1 text-xl font-bold text-slate-900">Enviar para aprovação</h3><p className="mt-1 text-xs text-slate-500">Uma versão imutável será criada para revisão. A edição ficará bloqueada até a decisão.</p></div><button onClick={() => setOpen(false)} aria-label="Fechar" className="text-slate-400 hover:text-slate-700"><X size={18} /></button></div>
        <div className="grid gap-5 p-5 md:grid-cols-[minmax(0,1fr)_260px]">
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <Info label="Título" value={data.title} wide />
              <Info label="Categoria" value={contentCategoryLabels[data.category]} />
              <Info label="Versão" value={`Ciclo de revisão ${data.nextCycle}${data.workingVersionNumber ? ` · base v${data.workingVersionNumber}` : ""}`} />
              <Info label="Responsável" value={data.authorName} />
              <Info label="Data de referência" value={data.referenceDate ? new Date(`${data.referenceDate}T12:00:00`).toLocaleDateString("pt-BR") : "Não informada"} />
            </dl>
            <label className="block text-xs font-bold text-slate-600">Aprovador<select className="field mt-1" value={reviewerId} onChange={(event) => setReviewerId(event.target.value)} disabled={!reviewers?.length}>
              <option value="">{reviewers === null ? "Carregando aprovadores…" : "Qualquer aprovador elegível"}</option>
              {reviewers?.map((reviewer) => <option key={reviewer.id} value={reviewer.id}>{reviewer.full_name}</option>)}
            </select></label>
            <label className="block text-xs font-bold text-slate-600">Observações para o aprovador (opcional)<textarea className="field mt-1 min-h-20" maxLength={1000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Contexto, pontos de atenção ou prazos." /></label>
            {issues.length > 0 && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><p className="flex items-center gap-1 font-bold"><AlertTriangle size={14} />Pendências para o envio</p><ul className="mt-1 list-disc space-y-0.5 pl-5">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
            {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">{error}</p>}
          </div>
          <div><p className="mb-2 text-xs font-bold text-slate-600">Pré-visualização</p>{data.snapshot ? <ProjectPreview snapshot={data.snapshot} zoomable /> : <p className="rounded-xl bg-slate-50 p-6 text-center text-xs text-slate-400">Nenhuma composição salva.</p>}</div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-5"><button className="secondary-button" onClick={() => setOpen(false)}>Cancelar</button><button className="primary-button disabled:cursor-not-allowed disabled:bg-slate-300" disabled={pending || issues.length > 0 || reviewers === null} onClick={submit}>{pending ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />}Confirmar envio</button></div>
      </div>
    </div>}
  </>;
}

function Info({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return <div className={wide ? "col-span-2" : ""}><dt className="font-bold text-slate-500">{label}</dt><dd className="mt-0.5 text-sm text-slate-800">{value}</dd></div>;
}
