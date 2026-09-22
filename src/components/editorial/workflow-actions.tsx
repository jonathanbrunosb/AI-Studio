"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, GitBranchPlus, LoaderCircle } from "lucide-react";
import { archiveContentAction, createNewVersionAction } from "@/app/(protected)/gestao-editorial/actions";

export function NewVersionButton({ contentId }: { contentId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return <span className="inline-flex flex-col">
    <button className="primary-button" disabled={pending} onClick={() => {
      if (!window.confirm("Criar uma nova versão de trabalho? A versão aprovada será preservada e a nova versão precisará de nova aprovação.")) return;
      startTransition(async () => { const result = await createNewVersionAction(contentId); if (!result.ok) setError(result.message); router.refresh(); });
    }}>{pending ? <LoaderCircle size={16} className="animate-spin" /> : <GitBranchPlus size={16} />}Criar nova versão</button>
    {error && <span role="alert" className="mt-1 text-xs text-rose-600">{error}</span>}
  </span>;
}

export function ArchiveButton({ contentId, published }: { contentId: string; published: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return <span className="inline-flex flex-col">
    <button className="secondary-button" disabled={pending} onClick={() => {
      const reason = window.prompt(`Arquivar este conteúdo? Versões e histórico serão preservados.${published ? "\nAtenção: o arquivamento não retira o material do Portal da Contabilidade." : ""}\n\nMotivo (opcional):`);
      if (reason === null) return;
      startTransition(async () => { const result = await archiveContentAction(contentId, reason); if (!result.ok) setError(result.message); router.refresh(); });
    }}>{pending ? <LoaderCircle size={16} className="animate-spin" /> : <Archive size={16} />}Arquivar</button>
    {error && <span role="alert" className="mt-1 text-xs text-rose-600">{error}</span>}
  </span>;
}
