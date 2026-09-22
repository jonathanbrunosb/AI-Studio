import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/authorization";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { profile, roles } = await requireUser();
  return <AppShell user={{ fullName: profile.full_name, email: profile.email, roles }}>{children}</AppShell>;
}
