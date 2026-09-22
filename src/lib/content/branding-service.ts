import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { brandingSchema } from "./editorial";

export async function getBranding(client: SupabaseClient<Database>) {
  const { data, error } = await client.from("brand_settings").select("*").eq("id", true).single();
  if (error) throw new Error("Não foi possível carregar a identidade visual.");
  return brandingSchema.parse(data);
}
