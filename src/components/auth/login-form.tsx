"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LockKeyhole, Mail } from "lucide-react";
import { loginAction, type AuthActionState } from "@/app/auth/actions";
import { SubmitButton } from "./submit-button";

const initialState: AuthActionState = { status: "idle" };

export function LoginForm({ redirectTo = "/dashboard", passwordUpdated = false, sessionInactive = false }: { redirectTo?: string; passwordUpdated?: boolean; sessionInactive?: boolean }) {
  const [state, action] = useActionState(loginAction, initialState);
  return <form action={action} className="space-y-4"><input type="hidden" name="redirect" value={redirectTo} />{passwordUpdated && <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-800">Senha atualizada. Entre novamente com suas credenciais.</div>}{sessionInactive && <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Sua sessão foi encerrada porque o acesso está indisponível. Procure um administrador do AI Studio.</div>}{state.message && <div role="alert" className={`rounded-xl border p-3 text-sm ${state.status === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-blue-100 bg-blue-50 text-blue-800"}`}>{state.message}</div>}<label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">E-mail corporativo</span><span className="relative block"><Mail size={17} className="absolute left-3.5 top-3 text-slate-400" /><input className="field pl-10" type="email" name="email" autoComplete="email" required placeholder="nome@empresa.com.br" /></span>{state.fieldErrors?.email?.[0] && <span className="mt-1 block text-xs text-rose-600">{state.fieldErrors.email[0]}</span>}</label><label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">Senha</span><span className="relative block"><LockKeyhole size={17} className="absolute left-3.5 top-3 text-slate-400" /><input className="field pl-10" type="password" name="password" autoComplete="current-password" required /></span>{state.fieldErrors?.password?.[0] && <span className="mt-1 block text-xs text-rose-600">{state.fieldErrors.password[0]}</span>}</label><div className="flex justify-end"><Link href="/recuperar-senha" className="text-xs font-bold text-blue-700 hover:underline">Recuperar senha</Link></div><SubmitButton>Entrar</SubmitButton></form>;
}
