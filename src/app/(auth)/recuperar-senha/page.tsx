import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { RecoveryForm } from "@/components/auth/recovery-form";

export default function RecoveryPage() {
  return <AuthShell title="Recuperar acesso" description="Enviaremos um link seguro para redefinição da senha, caso o e-mail esteja cadastrado."><RecoveryForm /><Link href="/login" className="mt-5 flex items-center justify-center gap-2 text-xs font-bold text-slate-500 hover:text-blue-700"><ArrowLeft size={14} />Voltar ao login</Link></AuthShell>;
}
