-- Sprint 8: correções identificadas nos testes integrados e nos advisors do Supabase.
begin;

-- 1) BUG CRÍTICO: INSERT ... RETURNING em contents violava o RLS.
-- A política de leitura consultava a própria tabela por id (can_view_content), e a linha recém-inserida
-- não é visível para essa consulta dentro do mesmo comando. Resultado: criar e duplicar conteúdos falhava.
-- A nova política avalia as colunas da própria linha, com a mesma regra de can_view_content (Sprint 6).
drop policy if exists contents_select_authorized on public.contents;
create policy contents_select_authorized
on public.contents for select to authenticated
using (
  app_private.is_active_user()
  and (
    app_private.has_role('admin')
    or created_by = (select auth.uid())
    or status in ('approved', 'published')
    or (status = 'in_review' and app_private.has_role('approver'))
    or assigned_reviewer_id = (select auth.uid())
    or (app_private.has_role('approver') and exists (
      select 1 from public.approval_events e
      where e.content_id = contents.id and e.actor_id = (select auth.uid())
    ))
  )
);

-- 2) Índices para chaves estrangeiras usadas em filtros e junções frequentes.
create index if not exists contents_approved_version_idx on public.contents (approved_version_id) where approved_version_id is not null;
create index if not exists contents_submitted_version_idx on public.contents (submitted_version_id) where submitted_version_id is not null;
create index if not exists publication_events_content_idx on public.publication_events (content_id, created_at desc);
create index if not exists publication_exports_destination_idx on public.publication_exports (destination);
create index if not exists notifications_content_idx on public.notifications (content_id) where content_id is not null;
create index if not exists content_category_destinations_destination_idx on public.content_category_destinations (destination_id);
create index if not exists generation_jobs_parent_idx on public.generation_jobs (parent_job_id) where parent_job_id is not null;

-- 3) Políticas administrativas "for all" duplicavam a política de SELECT (advisor multiple_permissive_policies).
drop policy if exists portal_destinations_admin on public.portal_destinations;
drop policy if exists portal_destinations_admin_insert on public.portal_destinations;
create policy portal_destinations_admin_insert on public.portal_destinations for insert to authenticated with check (app_private.has_role('admin'));
drop policy if exists portal_destinations_admin_update on public.portal_destinations;
create policy portal_destinations_admin_update on public.portal_destinations for update to authenticated using (app_private.has_role('admin')) with check (app_private.has_role('admin'));
drop policy if exists portal_destinations_admin_delete on public.portal_destinations;
create policy portal_destinations_admin_delete on public.portal_destinations for delete to authenticated using (app_private.has_role('admin'));

drop policy if exists category_destinations_admin on public.content_category_destinations;
drop policy if exists category_destinations_admin_insert on public.content_category_destinations;
create policy category_destinations_admin_insert on public.content_category_destinations for insert to authenticated with check (app_private.has_role('admin'));
drop policy if exists category_destinations_admin_update on public.content_category_destinations;
create policy category_destinations_admin_update on public.content_category_destinations for update to authenticated using (app_private.has_role('admin')) with check (app_private.has_role('admin'));
drop policy if exists category_destinations_admin_delete on public.content_category_destinations;
create policy category_destinations_admin_delete on public.content_category_destinations for delete to authenticated using (app_private.has_role('admin'));

drop policy if exists ai_user_limits_write_admin on public.ai_user_limits;
drop policy if exists ai_user_limits_admin_insert on public.ai_user_limits;
create policy ai_user_limits_admin_insert on public.ai_user_limits for insert to authenticated with check (app_private.has_role('admin'));
drop policy if exists ai_user_limits_admin_update on public.ai_user_limits;
create policy ai_user_limits_admin_update on public.ai_user_limits for update to authenticated using (app_private.has_role('admin')) with check (app_private.has_role('admin'));
drop policy if exists ai_user_limits_admin_delete on public.ai_user_limits;
create policy ai_user_limits_admin_delete on public.ai_user_limits for delete to authenticated using (app_private.has_role('admin'));


-- ---------------------------------------------------------------------------
-- 4. list_eligible_reviewers: a coluna de saída "id" conflitava com contents.id
--    ("column reference id is ambiguous"), impedindo o envio para aprovação pela interface.
-- ---------------------------------------------------------------------------
create or replace function public.list_eligible_reviewers(p_content_id uuid)
returns table (id uuid, full_name text, email text)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  if not app_private.is_active_user() then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select c.created_by into owner from public.contents c where c.id = p_content_id;
  if owner is null or not app_private.can_view_content(p_content_id) then
    raise exception 'CONTENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  return query
    select p.id, p.full_name, p.email from public.profiles p
    where app_private.is_eligible_reviewer(p.id, owner, (select auth.uid()))
    order by p.full_name;
end;
$$;
revoke all on function public.list_eligible_reviewers(uuid) from public, anon;
grant execute on function public.list_eligible_reviewers(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Reserva atômica da finalização de um job de IA. O filtro or() em PATCH do PostgREST
--    falhava (42703) e o erro era descartado, deixando jobs concluídos presos em "processing".
-- ---------------------------------------------------------------------------
create or replace function public.claim_generation_finalize(p_job_id uuid, p_stale_seconds integer default 120)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with claimed as (
    update public.generation_jobs j set finalizing_at = now()
    where j.id = p_job_id and j.status = 'processing'
      and (j.finalizing_at is null or j.finalizing_at < now() - make_interval(secs => p_stale_seconds))
    returning 1
  )
  select exists (select 1 from claimed);
$$;
revoke all on function public.claim_generation_finalize(uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_generation_finalize(uuid, integer) to service_role;

commit;
