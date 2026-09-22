"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, MessageSquareWarning } from "lucide-react";
import { decideReviewAction } from "@/app/(protected)/gestao-editorial/actions";

export function DecisionPanel({ contentId, versionId, versionNumber, disabledReason }: { contentId: string; versionId: string; versionNumber: number | null; disabledReason: string | null }) {
  const [mode, setMode] = useState<"approve" | "changes" | null>(null);
  const [comment, setComment] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function decide(decision: "approved" | "changes_requested") {
    startTransition(async () => {
      const response = await decideReviewAction({ contentId, versionId, decision, comment: comment.trim() || null });
      setResult(response);
      if (response.ok || response.stateChanged) { setMode(null); router.refresh(); }
    });
  }

  if (disabledReason) return <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">{disabledReason}</p>;
  return <div className="space-y-3">
    <p className="text-[11px] text-slate-500">A decisão será vinculada exclusivamente à versão <strong>v{versionNumber ?? "?"}</strong> apresentada nesta tela.</p>
    {result && <p role="status" className={`rounded-xl p-3 text-xs font-semibold ${result.ok ? "bg-blue-50 text-blue-800" : "bg-rose-50 text-rose-700"}`}>{result.message}</p>}
    {mode === null && <>
      <button className="primary-button w-full" onClick={() => setMode("approve")}><CheckCircle2 size={16} />Aprovar conteúdo</button>
      <button className="secondary-button w-full text-rose-700" onClick={() => setMode("changes")}><MessageSquareWarning size={16} />Solicitar ajustes</button>
    </>}
    {mode === "approve" && <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
      <p className="text-xs font-bold text-blue-900">Confirmar aprovação?</p>
      <p className="mt-1 text-[11px] leading-4 text-blue-800">A versão ficará bloqueada para edição e disponível para publicação.</p>
      <textarea className="field mt-2 min-h-16 text-xs" maxLength={2000} placeholder="Comentário (opcional)" value={comment} onChange={(event) => setComment(event.target.value)} />
      <div className="mt-2 flex gap-2"><button className="primary-button flex-1" disabled={pending} onClick={() => decide("approved")}>{pending && <LoaderCircle size={14} className="animate-spin" />}Confirmar</button><button className="secondary-button" onClick={() => setMode(null)}>Voltar</button></div>
    </div>}
    {mode === "changes" && <div className="rounded-xl border border-rose-100 bg-rose-50 p-3">
      <label className="text-xs font-bold text-rose-900">Justificativa (obrigatória)<textarea className="field mt-1 min-h-24 text-xs" maxLength={2000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ex.: Revisar a fonte da notícia e substituir a imagem utilizada." /></label>
      <div className="mt-2 flex gap-2"><button className="primary-button flex-1 bg-rose-700 hover:bg-rose-800" disabled={pending || comment.trim().length < 5} onClick={() => decide("changes_requested")}>{pending && <LoaderCircle size={14} className="animate-spin" />}Devolver ao autor</button><button className="secondary-button" onClick={() => setMode(null)}>Voltar</button></div>
    </div>}
  </div>;
}
