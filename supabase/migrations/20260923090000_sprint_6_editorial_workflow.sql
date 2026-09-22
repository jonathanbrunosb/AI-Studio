-- Sprint 6: fluxo editorial, versões imutáveis de revisão, segregação de funções,
-- notificações internas e arquivamento. Todas as transições de status ocorrem
-- exclusivamente pelas funções transacionais abaixo.
begin;

-- ---------------------------------------------------------------------------
-- contents: vínculos com versões e metadados do fluxo
-- ---------------------------------------------------------------------------
alter table public.contents
  add column submitted_version_id uuid references public.content_versions(id) on delete restrict,
  add column approved_version_id uuid references public.content_versions(id) on delete restrict,
  add column assigned_reviewer_id uuid references public.profiles(id) on delete set null,
  add column submitted_at timestamptz,
  add column approved_at timestamptz,
  add column approved_by uuid references public.profiles(id) on delete set null,
  add column review_cycle integer not null default 0 check (review_cycle >= 0),
  add column archived_at timestamptz,
  add column archived_by uuid references public.profiles(id) on delete set null,
  add column archived_from_status text;

create index contents_assigned_reviewer_idx on public.contents (assigned_reviewer_id) where assigned_reviewer_id is not null;
create index contents_status_submitted_idx on public.contents (status, submitted_at desc);

comment on column public.contents.submitted_version_id is 'Versão congelada (frozen) atualmente em revisão ou revisada por último.';
comment on column public.contents.approved_version_id is 'Última versão congelada aprovada. Preservada ao criar nova versão.';

-- ---------------------------------------------------------------------------
-- approval_events: vínculo com a versão, transição de status e ciclo
-- actor_id corresponde ao reviewer_id da especificação (responsável pela ação).
-- ---------------------------------------------------------------------------
alter table public.approval_events drop constraint if exists approval_events_action_check;
alter table public.approval_events
  add constraint approval_events_action_check
    check (action in ('submitted', 'approved', 'changes_requested', 'new_version', 'archived')),
  add column version_id uuid references public.content_versions(id) on delete restrict,
  add column from_status text,
  add column to_status text,
  add column cycle integer;

-- Uma única decisão por versão submetida: barreira final contra decisões concorrentes.
create unique index approval_events_one_decision_per_version
  on public.approval_events (version_id)
  where action in ('approved', 'changes_requested');

create index approval_events_content_created_idx on public.approval_events (content_id, created_at);

-- ---------------------------------------------------------------------------
-- Notificações internas
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  content_id uuid references public.contents(id) on delete cascade,
  type text not null check (type in ('review_requested', 'resubmitted', 'changes_requested', 'approved')),
  title text not null check (char_length(title) <= 200),
  message text not null check (char_length(message) <= 1000),
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index notifications_recipient_unread_idx on public.notifications (recipient_id, created_at desc) where read_at is null;
create index notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);

alter table public.notifications enable row level security;

create policy notifications_select_own on public.notifications for select to authenticated
using (recipient_id = (select auth.uid()) and app_private.is_active_user());
create policy notifications_mark_read_own on public.notifications for update to authenticated
using (recipient_id = (select auth.uid()) and app_private.is_active_user())
with check (recipient_id = (select auth.uid()));

grant select, update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

-- ---------------------------------------------------------------------------
-- Proteção das colunas de workflow: só as funções do fluxo podem alterá-las.
-- ---------------------------------------------------------------------------
create or replace function app_private.in_editorial_transition()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(current_setting('app.editorial_transition', true), '') = 'on';
$$;
revoke all on function app_private.in_editorial_transition() from public, anon;
grant execute on function app_private.in_editorial_transition() to authenticated;

create or replace function app_private.protect_content_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null and current_user in ('postgres', 'service_role') then
    if tg_op = 'UPDATE' then
      new.updated_at := now();
    end if;
    return new;
  end if;

  -- Transições executadas pelas funções do fluxo editorial (validadas nelas).
  if tg_op = 'UPDATE' and app_private.in_editorial_transition() then
    new.updated_at := now();
    return new;
  end if;

  if not app_private.is_active_user() then
    raise exception 'Inactive users cannot modify contents.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if not (app_private.has_role('editor') or app_private.has_role('admin')) then
      raise exception 'An editor or administrator role is required.' using errcode = '42501';
    end if;
    new.created_by := (select auth.uid());
    new.status := 'draft';
    new.submitted_version_id := null;
    new.approved_version_id := null;
    new.assigned_reviewer_id := null;
    new.submitted_at := null;
    new.approved_at := null;
    new.approved_by := null;
    new.review_cycle := 0;
    new.archived_at := null;
    new.archived_by := null;
    new.archived_from_status := null;
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'Content ownership cannot be changed.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Content status must be changed by the editorial workflow.' using errcode = '42501';
  end if;

  if new.submitted_version_id is distinct from old.submitted_version_id
     or new.approved_version_id is distinct from old.approved_version_id
     or new.assigned_reviewer_id is distinct from old.assigned_reviewer_id
     or new.submitted_at is distinct from old.submitted_at
     or new.approved_at is distinct from old.approved_at
     or new.approved_by is distinct from old.approved_by
     or new.review_cycle is distinct from old.review_cycle
     or new.archived_at is distinct from old.archived_at
     or new.archived_by is distinct from old.archived_by
     or new.archived_from_status is distinct from old.archived_from_status then
    raise exception 'Editorial workflow fields are managed by the workflow.' using errcode = '42501';
  end if;

  if old.status not in ('draft', 'changes_requested') then
    raise exception 'Approved, published or archived contents cannot be edited.' using errcode = '42501';
  end if;

  if not app_private.has_role('admin')
     and not (app_private.has_role('editor') and old.created_by = (select auth.uid())) then
    raise exception 'Users can only edit contents they own.' using errcode = '42501';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
revoke all on function app_private.protect_content_write() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Elegibilidade e auxiliares
-- ---------------------------------------------------------------------------
create or replace function app_private.is_eligible_reviewer(p_user uuid, p_author uuid, p_submitter uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null
    and p_user is distinct from p_author
    and p_user is distinct from p_submitter
    and exists (select 1 from public.profiles p where p.id = p_user and p.is_active)
    and exists (select 1 from public.user_roles r where r.user_id = p_user and r.role in ('approver', 'admin'));
$$;
revoke all on function app_private.is_eligible_reviewer(uuid, uuid, uuid) from public, anon, authenticated;

create or replace function app_private.missing_assets(p_snapshot jsonb)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(distinct path), '{}')
  from (
    select value #>> '{}' as path
    from jsonb_path_query(p_snapshot, 'lax $.**.storagePath') as value
  ) refs
  where not exists (
    select 1 from public.media_assets m
    where m.storage_path = refs.path and m.deleted_at is null
  );
$$;
revoke all on function app_private.missing_assets(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Envio para revisão (transacional)
-- ---------------------------------------------------------------------------
create or replace function public.submit_content_for_review(
  p_content_id uuid,
  p_reviewer_id uuid default null,
  p_comment text default null,
  p_expected_working_updated_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  c public.contents;
  working public.content_versions;
  frozen_id uuid;
  eligible_count integer;
  missing text[];
  details jsonb;
  author_name text;
begin
  if actor is null or not app_private.is_active_user() then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if not (app_private.has_role('editor') or app_private.has_role('admin')) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;

  select * into c from public.contents where id = p_content_id for update;
  if not found then raise exception 'CONTENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if c.created_by <> actor and not app_private.has_role('admin') then
    raise exception 'NOT_OWNER' using errcode = '42501';
  end if;
  if c.status not in ('draft', 'changes_requested') then
    raise exception 'STATE_CHANGED' using errcode = 'P0001';
  end if;

  -- Campos obrigatórios por categoria
  details := coalesce(c.editorial_details, '{}'::jsonb);
  if char_length(trim(coalesce(c.title, ''))) < 3 then raise exception 'MISSING_TITLE' using errcode = 'P0001'; end if;
  if c.category = 'accounting_newsletter'
     and (coalesce(trim(c.source_name), '') = '' or coalesce(trim(c.source_url), '') = '') then
    raise exception 'MISSING_NEWSLETTER_SOURCE' using errcode = 'P0001';
  end if;
  if c.category = 'system_announcement'
     and (coalesce(trim(details ->> 'solution_name'), '') = '' or coalesce(trim(details ->> 'functionality'), '') = '') then
    raise exception 'MISSING_SYSTEM_FIELDS' using errcode = 'P0001';
  end if;

  -- Composição visual salva e válida
  select * into working from public.content_versions
  where content_id = c.id and version_kind = 'working';
  if not found
     or jsonb_typeof(working.snapshot -> 'elements') <> 'array'
     or jsonb_array_length(working.snapshot -> 'elements') = 0 then
    raise exception 'MISSING_COMPOSITION' using errcode = 'P0001';
  end if;
  if p_expected_working_updated_at is not null
     and date_trunc('milliseconds', working.updated_at) <> date_trunc('milliseconds', p_expected_working_updated_at) then
    raise exception 'STALE_COMPOSITION' using errcode = 'P0001';
  end if;

  missing := app_private.missing_assets(working.snapshot);
  if array_length(missing, 1) > 0 then
    raise exception 'MISSING_ASSETS' using errcode = 'P0001';
  end if;

  -- Aprovador
  if p_reviewer_id is not null then
    if not app_private.is_eligible_reviewer(p_reviewer_id, c.created_by, actor) then
      raise exception 'INVALID_REVIEWER' using errcode = 'P0001';
    end if;
  else
    select count(*) into eligible_count
    from public.profiles p
    where app_private.is_eligible_reviewer(p.id, c.created_by, actor);
    if eligible_count = 0 then raise exception 'NO_ELIGIBLE_REVIEWER' using errcode = 'P0001'; end if;
  end if;

  perform set_config('app.editorial_transition', 'on', true);

  select full_name into author_name from public.profiles where id = c.created_by;
  insert into public.content_versions (content_id, snapshot, version_kind, label, created_by, version_number)
  values (
    c.id,
    working.snapshot || jsonb_build_object(
      'editorial', jsonb_build_object(
        'title', c.title, 'subtitle', c.subtitle, 'description', c.description, 'category', c.category,
        'reference_date', c.reference_date, 'source_name', c.source_name, 'source_url', c.source_url,
        'editorial_details', c.editorial_details, 'layout_snapshot', c.layout_snapshot,
        'author_id', c.created_by, 'author_name', author_name
      ),
      'submission', jsonb_build_object(
        'submitted_by', actor, 'submitted_at', now(), 'cycle', c.review_cycle + 1,
        'working_version_id', working.id, 'assets', (
          select coalesce(jsonb_agg(distinct value #>> '{}'), '[]'::jsonb)
          from jsonb_path_query(working.snapshot, 'lax $.**.storagePath') as value
        )
      )
    ),
    'frozen',
    'Enviada para revisão · ciclo ' || (c.review_cycle + 1),
    actor,
    0
  )
  returning id into frozen_id;

  update public.contents set
    status = 'in_review',
    submitted_version_id = frozen_id,
    assigned_reviewer_id = p_reviewer_id,
    submitted_at = now(),
    review_cycle = c.review_cycle + 1
  where id = c.id;

  insert into public.approval_events (content_id, actor_id, action, comment, version_id, from_status, to_status, cycle)
  values (c.id, actor, 'submitted', nullif(trim(p_comment), ''), frozen_id, c.status, 'in_review', c.review_cycle + 1);

  insert into public.notifications (recipient_id, content_id, type, title, message)
  select p.id, c.id,
    case when c.review_cycle > 0 then 'resubmitted' else 'review_requested' end,
    case when c.review_cycle > 0 then 'Nova versão para revisão' else 'Conteúdo aguardando sua aprovação' end,
    left('"' || c.title || '" foi encaminhado para revisão por ' || coalesce(author_name, 'um editor') || '.', 1000)
  from public.profiles p
  where (p_reviewer_id is not null and p.id = p_reviewer_id)
     or (p_reviewer_id is null and app_private.is_eligible_reviewer(p.id, c.created_by, actor));

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'editorial.submitted', 'contents', c.id,
    jsonb_build_object('version_id', frozen_id, 'cycle', c.review_cycle + 1, 'reviewer_id', p_reviewer_id));

  return frozen_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Decisão editorial (aprovar / solicitar ajustes) — transacional, com trava
-- ---------------------------------------------------------------------------
create or replace function public.decide_content_review(
  p_content_id uuid,
  p_version_id uuid,
  p_decision text,
  p_comment text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  c public.contents;
  submitter uuid;
  new_status text;
begin
  if actor is null or not app_private.is_active_user() then
    raise exception 'NOT_AUTHENTICATED' using errcode = '42501';
  end if;
  if not (app_private.has_role('approver') or app_private.has_role('admin')) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'changes_requested') then
    raise exception 'INVALID_DECISION' using errcode = 'P0001';
  end if;
  if p_decision = 'changes_requested' and char_length(trim(coalesce(p_comment, ''))) < 5 then
    raise exception 'COMMENT_REQUIRED' using errcode = 'P0001';
  end if;

  select * into c from public.contents where id = p_content_id for update;
  if not found then raise exception 'CONTENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if c.status <> 'in_review' then raise exception 'STATE_CHANGED' using errcode = 'P0001'; end if;
  if c.submitted_version_id is distinct from p_version_id then raise exception 'VERSION_MISMATCH' using errcode = 'P0001'; end if;

  select created_by into submitter from public.content_versions
  where id = p_version_id and content_id = c.id and version_kind = 'frozen';
  if not found then raise exception 'VERSION_MISMATCH' using errcode = 'P0001'; end if;

  if actor = c.created_by or actor = submitter then
    raise exception 'SELF_APPROVAL' using errcode = '42501';
  end if;
  if not app_private.is_eligible_reviewer(actor, c.created_by, submitter) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;
  if c.assigned_reviewer_id is not null and c.assigned_reviewer_id <> actor and not app_private.has_role('admin') then
    raise exception 'NOT_ASSIGNED' using errcode = '42501';
  end if;

  new_status := p_decision;
  perform set_config('app.editorial_transition', 'on', true);

  insert into public.approval_events (content_id, actor_id, action, comment, version_id, from_status, to_status, cycle)
  values (c.id, actor, p_decision, nullif(trim(p_comment), ''), p_version_id, 'in_review', new_status, c.review_cycle);

  if p_decision = 'approved' then
    update public.contents set status = 'approved', approved_version_id = p_version_id, approved_at = now(), approved_by = actor
    where id = c.id;
  else
    update public.contents set status = 'changes_requested' where id = c.id;
  end if;

  insert into public.notifications (recipient_id, content_id, type, title, message)
  values (
    c.created_by, c.id, p_decision,
    case when p_decision = 'approved' then 'Conteúdo aprovado' else 'Ajustes solicitados' end,
    left(case when p_decision = 'approved'
      then '"' || c.title || '" foi aprovado e está disponível para publicação.'
      else '"' || c.title || '" precisa de ajustes: ' || trim(p_comment) end, 1000)
  );

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'editorial.' || p_decision, 'contents', c.id,
    jsonb_build_object('version_id', p_version_id, 'cycle', c.review_cycle));
exception
  when unique_violation then
    raise exception 'STATE_CHANGED' using errcode = 'P0001';
end;
$$;

-- ---------------------------------------------------------------------------
-- Nova versão a partir de conteúdo aprovado (preserva a versão aprovada)
-- ---------------------------------------------------------------------------
create or replace function public.create_new_content_version(p_content_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  c public.contents;
begin
  if actor is null or not app_private.is_active_user()
     or not (app_private.has_role('editor') or app_private.has_role('admin')) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;
  select * into c from public.contents where id = p_content_id for update;
  if not found then raise exception 'CONTENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if c.created_by <> actor and not app_private.has_role('admin') then raise exception 'NOT_OWNER' using errcode = '42501'; end if;
  if c.status <> 'approved' then raise exception 'STATE_CHANGED' using errcode = 'P0001'; end if;

  perform set_config('app.editorial_transition', 'on', true);
  update public.contents set status = 'draft', assigned_reviewer_id = null where id = c.id;

  insert into public.approval_events (content_id, actor_id, action, comment, version_id, from_status, to_status, cycle)
  values (c.id, actor, 'new_version', 'Nova versão de trabalho criada a partir da versão aprovada.', c.approved_version_id, 'approved', 'draft', c.review_cycle);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'editorial.new_version', 'contents', c.id, jsonb_build_object('approved_version_id', c.approved_version_id));
end;
$$;

-- ---------------------------------------------------------------------------
-- Arquivamento (sem exclusão física)
-- ---------------------------------------------------------------------------
create or replace function public.archive_content(p_content_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  c public.contents;
begin
  if actor is null or not app_private.is_active_user() then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into c from public.contents where id = p_content_id for update;
  if not found then raise exception 'CONTENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not (app_private.has_role('admin') or (app_private.has_role('editor') and c.created_by = actor)) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;
  if c.status = 'archived' then raise exception 'STATE_CHANGED' using errcode = 'P0001'; end if;

  perform set_config('app.editorial_transition', 'on', true);
  update public.contents set status = 'archived', archived_at = now(), archived_by = actor, archived_from_status = c.status
  where id = c.id;

  insert into public.approval_events (content_id, actor_id, action, comment, version_id, from_status, to_status, cycle)
  values (c.id, actor, 'archived', nullif(trim(p_reason), ''), coalesce(c.approved_version_id, c.submitted_version_id), c.status, 'archived', c.review_cycle);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'editorial.archived', 'contents', c.id, jsonb_build_object('from_status', c.status));
end;
$$;

-- ---------------------------------------------------------------------------
-- Aprovadores elegíveis (para o seletor do envio)
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
  select created_by into owner from public.contents where id = p_content_id;
  if owner is null or not app_private.can_view_content(p_content_id) then
    raise exception 'CONTENT_NOT_FOUND' using errcode = 'P0002';
  end if;
  return query
    select p.id, p.full_name, p.email from public.profiles p
    where app_private.is_eligible_reviewer(p.id, owner, (select auth.uid()))
    order by p.full_name;
end;
$$;

revoke all on function public.submit_content_for_review(uuid, uuid, text, timestamptz) from public, anon;
revoke all on function public.decide_content_review(uuid, uuid, text, text) from public, anon;
revoke all on function public.create_new_content_version(uuid) from public, anon;
revoke all on function public.archive_content(uuid, text) from public, anon;
revoke all on function public.list_eligible_reviewers(uuid) from public, anon;
grant execute on function public.submit_content_for_review(uuid, uuid, text, timestamptz) to authenticated;
grant execute on function public.decide_content_review(uuid, uuid, text, text) to authenticated;
grant execute on function public.create_new_content_version(uuid) to authenticated;
grant execute on function public.archive_content(uuid, text) to authenticated;
grant execute on function public.list_eligible_reviewers(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Visibilidade: aprovador designado/elegível e histórico conforme acesso
-- ---------------------------------------------------------------------------
create or replace function app_private.can_view_content(target_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.is_active_user()
    and exists (
      select 1
      from public.contents c
      where c.id = target_content_id
        and (
          app_private.has_role('admin')
          or c.created_by = (select auth.uid())
          or c.status in ('approved', 'published')
          or (c.status = 'in_review' and app_private.has_role('approver'))
          or c.assigned_reviewer_id = (select auth.uid())
          or (app_private.has_role('approver') and exists (
            select 1 from public.approval_events e
            where e.content_id = c.id and e.actor_id = (select auth.uid())
          ))
        )
    );
$$;

-- Imagens do editor visíveis a quem pode ver o conteúdo vinculado (necessário para a revisão).
create policy editor_assets_select_by_content
on storage.objects for select to authenticated
using (
  bucket_id = 'editor-assets'
  and app_private.is_active_user()
  and exists (
    select 1 from public.media_assets m
    where m.bucket = 'editor-assets' and m.storage_path = storage.objects.name
  )
);

-- Arquivos usados em versões submetidas/aprovadas não podem ser removidos pelo autor.
drop policy if exists editor_assets_delete_owner on storage.objects;
create policy editor_assets_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'editor-assets'
  and app_private.is_active_user()
  and split_part(name, '/', 1) = (select auth.uid())::text
  and not exists (
    select 1 from public.content_versions v
    where v.version_kind = 'frozen'
      and v.snapshot -> 'submission' -> 'assets' ? storage.objects.name
  )
);

comment on table public.notifications is 'Notificações internas; inseridas apenas pelas funções do fluxo editorial.';

commit;
