import { AuthShell } from "@/components/auth/auth-shell";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";

export default function UpdatePasswordPage() {
  return <AuthShell title="Definir nova senha" description="Cadastre uma nova senha para concluir a recuperação do acesso."><UpdatePasswordForm /></AuthShell>;
}
