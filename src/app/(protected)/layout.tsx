import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth/authorization";
import { getNotifications } from "@/lib/editorial/workflow-service";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { profile, roles, supabase } = await requireUser();
  const notifications = await getNotifications(supabase).catch(() => ({ items: [], unread: 0 }));
  return <AppShell user={{ fullName: profile.full_name, email: profile.email, roles }} notifications={notifications}>{children}</AppShell>;
}
