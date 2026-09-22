import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ redirect?: string; password?: string }> }) {
  const params = await searchParams;
  return <AuthShell title="Entrar no AI Studio" description="Utilize suas credenciais corporativas para acessar o ambiente."><LoginForm redirectTo={params.redirect} passwordUpdated={params.password === "updated"} /></AuthShell>;
}
