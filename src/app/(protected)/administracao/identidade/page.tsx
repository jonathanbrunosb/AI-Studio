import Link from "next/link";
import { requireAdmin } from "@/lib/auth/authorization";
import { getBranding } from "@/lib/content/branding-service";
import { PageHeader } from "@/components/shared/page-header";
import { BrandingForm } from "@/components/studio/branding-form";

export default async function IdentityPage() {
  const { supabase } = await requireAdmin();
  const brand = await getBranding(supabase);
  return <div><PageHeader eyebrow="Governança visual" title="Identidade institucional" description="Gerencie os elementos compartilhados por todas as composições do AI Studio." actions={<Link href="/modelos" className="secondary-button">Ver modelos</Link>} /><BrandingForm brand={brand} /></div>;
}
