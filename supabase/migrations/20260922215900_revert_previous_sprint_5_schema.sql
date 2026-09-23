-- Remove a implementação anterior da Sprint 5 aplicada diretamente no projeto
-- (migrações sprint_5_ai_generation, sprint_5_ai_security_hardening e sprint_5_ai_table_grants,
-- que não fazem parte do repositório) e restaura generation_jobs/media_assets ao estado da Sprint 4.
-- Autorizado pelo responsável em 23/09/2026; o banco não possuía dados nessas estruturas.
-- Idempotente: em bancos sem a implementação anterior, não altera nada.
begin;

drop function if exists public.request_ai_generation(uuid, text, text, jsonb);
drop trigger if exists generation_jobs_audit_ai on public.generation_jobs;
drop trigger if exists generation_jobs_prepare_insert on public.generation_jobs;
drop table if exists public.ai_model_settings cascade;
drop table if exists public.ai_usage_limits cascade;
drop function if exists app_private.audit_ai_changes() cascade;
drop function if exists app_private.prepare_generation_job() cascade;

drop policy if exists generation_jobs_insert_validated on public.generation_jobs;
drop policy if exists ai_generated_read_authorized on storage.objects;

alter table public.generation_jobs
  drop constraint if exists generation_jobs_actual_cost_check,
  drop constraint if exists generation_jobs_error_message_check,
  drop constraint if exists generation_jobs_estimated_cost_check,
  drop constraint if exists generation_jobs_image_count_check,
  drop constraint if exists generation_jobs_model_check,
  drop constraint if exists generation_jobs_prompt_check,
  drop constraint if exists generation_jobs_provider_check,
  drop constraint if exists generation_jobs_settings_check,
  drop column if exists provider,
  drop column if exists model,
  drop column if exists prompt,
  drop column if exists settings,
  drop column if exists external_request_id,
  drop column if exists error_message,
  drop column if exists estimated_cost,
  drop column if exists actual_cost,
  drop column if exists image_count,
  drop column if exists completed_at;

alter table public.generation_jobs drop constraint if exists generation_jobs_status_check;
update public.generation_jobs set status = 'queued' where status = 'pending';
update public.generation_jobs set status = 'cancelled' where status = 'canceled';
alter table public.generation_jobs alter column status set default 'queued';
alter table public.generation_jobs add constraint generation_jobs_status_check
  check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled'));

drop index if exists public.media_assets_generation_job_idx;
alter table public.media_assets
  drop constraint if exists media_assets_byte_size_check,
  drop constraint if exists media_assets_height_check,
  drop constraint if exists media_assets_origin_check,
  drop constraint if exists media_assets_width_check,
  drop constraint if exists media_assets_generation_job_id_fkey,
  drop column if exists generation_job_id,
  drop column if exists origin,
  drop column if exists width,
  drop column if exists height,
  drop column if exists byte_size,
  drop column if exists is_library;

-- Estado de acesso da Sprint 2/4 (a migração de grants anterior pode tê-lo alterado).
drop policy if exists generation_jobs_select_authorized on public.generation_jobs;
create policy generation_jobs_select_authorized
on public.generation_jobs for select to authenticated
using (app_private.can_view_content(content_id));

drop policy if exists media_assets_insert_owner on public.media_assets;
create policy media_assets_insert_owner
on public.media_assets for insert to authenticated
with check (
  app_private.is_active_user()
  and (app_private.has_role('editor') or app_private.has_role('admin'))
  and created_by = (select auth.uid())
  and (
    content_id is null
    or exists (
      select 1 from public.contents c
      where c.id = content_id
        and c.status in ('draft', 'changes_requested')
        and (app_private.has_role('admin') or c.created_by = (select auth.uid()))
    )
  )
);

revoke all on public.generation_jobs, public.media_assets from anon, authenticated;
grant select on public.generation_jobs to authenticated;
grant select on public.media_assets to authenticated;
grant insert (content_id, storage_path, file_name, mime_type, created_by) on public.media_assets to authenticated;
grant all on public.generation_jobs, public.media_assets to service_role;

-- O bucket privado ai-generated é mantido; a Sprint 5 do repositório reaplica sua configuração.

commit;
