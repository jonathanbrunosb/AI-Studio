begin;

-- Cover foreign-key columns used by referential checks and administrative
-- lookups. These indexes are intentionally single-column and named by table.
create index if not exists ai_models_updated_by_idx
  on public.ai_models (updated_by);
create index if not exists ai_settings_updated_by_idx
  on public.ai_settings (updated_by);
create index if not exists ai_user_limits_updated_by_idx
  on public.ai_user_limits (updated_by);

create index if not exists contents_approved_by_idx
  on public.contents (approved_by);
create index if not exists contents_archived_by_idx
  on public.contents (archived_by);

create index if not exists integration_clients_created_by_idx
  on public.integration_clients (created_by);
create index if not exists portal_destinations_updated_by_idx
  on public.portal_destinations (updated_by);
create index if not exists portal_integration_settings_updated_by_idx
  on public.portal_integration_settings (updated_by);

create index if not exists publication_events_actor_id_idx
  on public.publication_events (actor_id);
create index if not exists publication_events_client_id_idx
  on public.publication_events (client_id);

create index if not exists publication_exports_confirmed_by_idx
  on public.publication_exports (confirmed_by);
create index if not exists publication_exports_exported_by_idx
  on public.publication_exports (exported_by);
create index if not exists publication_exports_superseded_by_id_idx
  on public.publication_exports (superseded_by_id);
create index if not exists publication_exports_supersedes_id_idx
  on public.publication_exports (supersedes_id);

commit;
