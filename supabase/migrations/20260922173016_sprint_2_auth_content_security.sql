begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 160),
  email text not null check (email = lower(email)),
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index profiles_email_lower_key on public.profiles (lower(email));

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'approver')),
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint user_roles_user_id_role_key unique (user_id, role)
);

create index user_roles_user_id_idx on public.user_roles (user_id);
create index user_roles_assigned_by_idx on public.user_roles (assigned_by) where assigned_by is not null;
create index user_roles_role_user_id_idx on public.user_roles (role, user_id);

create table public.templates (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  description text,
  configuration jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index templates_created_by_idx on public.templates (created_by) where created_by is not null;

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 3 and 200),
  subtitle text,
  description text,
  category text not null check (category in (
    'internal_communication',
    'accounting_newsletter',
    'system_announcement',
    'internal_campaign'
  )),
  status text not null default 'draft' check (status in (
    'draft',
    'in_review',
    'changes_requested',
    'approved',
    'published',
    'archived'
  )),
  created_by uuid not null references public.profiles(id) on delete restrict,
  template_id uuid references public.templates(id) on delete set null,
  reference_date date,
  source_name text,
  source_url text check (source_url is null or source_url ~* '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index contents_created_by_idx on public.contents (created_by);
create index contents_template_id_idx on public.contents (template_id) where template_id is not null;
create index contents_status_created_at_idx on public.contents (status, created_at desc);
create index contents_created_at_idx on public.contents (created_at desc);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  version_number integer not null check (version_number > 0),
  snapshot jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint content_versions_content_version_key unique (content_id, version_number)
);

create index content_versions_content_id_idx on public.content_versions (content_id);
create index content_versions_created_by_idx on public.content_versions (created_by);

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  content_id uuid references public.contents(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index media_assets_storage_path_key on public.media_assets (storage_path);
create index media_assets_content_id_idx on public.media_assets (content_id) where content_id is not null;
create index media_assets_created_by_idx on public.media_assets (created_by);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index generation_jobs_content_id_idx on public.generation_jobs (content_id);
create index generation_jobs_created_by_idx on public.generation_jobs (created_by);
create index generation_jobs_status_created_at_idx on public.generation_jobs (status, created_at desc);

create table public.approval_events (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (action in ('submitted', 'approved', 'changes_requested')),
  comment text,
  created_at timestamptz not null default now()
);

create index approval_events_content_id_idx on public.approval_events (content_id);
create index approval_events_actor_id_idx on public.approval_events (actor_id);

create table public.publication_exports (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents(id) on delete cascade,
  format text not null,
  storage_path text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index publication_exports_content_id_idx on public.publication_exports (content_id);
create index publication_exports_created_by_idx on public.publication_exports (created_by);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_actor_id_created_at_idx on public.audit_logs (actor_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);

create or replace function app_private.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.profiles p
      where p.id = (select auth.uid())
        and p.is_active
    );
$$;

create or replace function app_private.has_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app_private.is_active_user()
    and required_role in ('admin', 'editor', 'approver')
    and exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role = required_role
    );
$$;

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
        )
    );
$$;

revoke all on function app_private.is_active_user() from public, anon;
revoke all on function app_private.has_role(text) from public, anon;
revoke all on function app_private.can_view_content(uuid) from public, anon;
grant execute on function app_private.is_active_user() to authenticated;
grant execute on function app_private.has_role(text) to authenticated;
grant execute on function app_private.can_view_content(uuid) to authenticated;

create or replace function app_private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function app_private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, department)
  values (
    new.id,
    case
      when char_length(coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(lower(new.email), '@', 1))) >= 2
        then coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(lower(new.email), '@', 1))
      else 'Usuário convidado'
    end,
    lower(new.email),
    nullif(trim(new.raw_user_meta_data ->> 'department'), '')
  );
  return new;
end;
$$;

create or replace function app_private.protect_profile_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_admin_count integer;
begin
  if (select auth.uid()) is null and current_user in ('postgres', 'service_role') then
    new.updated_at := now();
    return new;
  end if;

  if new.id is distinct from old.id or new.email is distinct from old.email then
    raise exception 'Profile identity fields cannot be changed through this operation.' using errcode = '42501';
  end if;

  if new.is_active is distinct from old.is_active and not app_private.has_role('admin') then
    raise exception 'Only administrators can change access status.' using errcode = '42501';
  end if;

  if new.id = (select auth.uid()) and old.is_active and not new.is_active then
    select count(*) into active_admin_count
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.role = 'admin' and p.is_active;

    if active_admin_count <= 1 and exists (
      select 1 from public.user_roles ur where ur.user_id = new.id and ur.role = 'admin'
    ) then
      raise exception 'The only active administrator cannot deactivate their own access.' using errcode = '42501';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function app_private.protect_role_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  active_admin_count integer;
begin
  if (select auth.uid()) is null and current_user in ('postgres', 'service_role') then
    if tg_op = 'INSERT' then
      return new;
    end if;
    return old;
  end if;

  if not app_private.has_role('admin') then
    raise exception 'Only administrators can manage roles.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.user_id = (select auth.uid()) then
      raise exception 'Administrators cannot assign roles to themselves.' using errcode = '42501';
    end if;
    new.assigned_by := (select auth.uid());
    return new;
  end if;

  if old.user_id = (select auth.uid()) and old.role = 'admin' then
    select count(*) into active_admin_count
    from public.user_roles ur
    join public.profiles p on p.id = ur.user_id
    where ur.role = 'admin' and p.is_active;

    if active_admin_count <= 1 then
      raise exception 'The only active administrator cannot revoke their own admin role.' using errcode = '42501';
    end if;
  end if;

  return old;
end;
$$;

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

  if not app_private.is_active_user() then
    raise exception 'Inactive users cannot modify contents.' using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if not (app_private.has_role('editor') or app_private.has_role('admin')) then
      raise exception 'An editor or administrator role is required.' using errcode = '42501';
    end if;
    new.created_by := (select auth.uid());
    new.status := 'draft';
    return new;
  end if;

  if new.created_by is distinct from old.created_by then
    raise exception 'Content ownership cannot be changed.' using errcode = '42501';
  end if;

  if new.status is distinct from old.status then
    raise exception 'Content status must be changed by the editorial workflow.' using errcode = '42501';
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

create or replace function app_private.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  audit_entity_type text := tg_table_name;
  audit_entity_id uuid;
  audit_metadata jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'contents' then
    audit_action := case when tg_op = 'INSERT' then 'content.created' else 'content.updated' end;
    audit_entity_id := new.id;
    audit_metadata := jsonb_build_object('status', new.status, 'category', new.category);
  elsif tg_table_name = 'user_roles' then
    audit_action := case when tg_op = 'INSERT' then 'role.assigned' else 'role.revoked' end;
    audit_entity_id := case when tg_op = 'INSERT' then new.id else old.id end;
    audit_metadata := jsonb_build_object(
      'user_id', case when tg_op = 'INSERT' then new.user_id else old.user_id end,
      'role', case when tg_op = 'INSERT' then new.role else old.role end
    );
  elsif tg_table_name = 'profiles' then
    if new.is_active is not distinct from old.is_active then
      return new;
    end if;
    audit_action := case when new.is_active then 'user.activated' else 'user.deactivated' end;
    audit_entity_id := new.id;
    audit_metadata := jsonb_build_object('is_active', new.is_active);
  else
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), audit_action, audit_entity_type, audit_entity_id, audit_metadata);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function app_private.set_updated_at() from public, anon, authenticated;
revoke all on function app_private.handle_new_auth_user() from public, anon, authenticated;
revoke all on function app_private.protect_profile_update() from public, anon, authenticated;
revoke all on function app_private.protect_role_write() from public, anon, authenticated;
revoke all on function app_private.protect_content_write() from public, anon, authenticated;
revoke all on function app_private.write_audit_log() from public, anon, authenticated;

create trigger profiles_protect_update
before update on public.profiles
for each row execute function app_private.protect_profile_update();

create trigger templates_set_updated_at
before update on public.templates
for each row execute function app_private.set_updated_at();

create trigger generation_jobs_set_updated_at
before update on public.generation_jobs
for each row execute function app_private.set_updated_at();

create trigger contents_protect_write
before insert or update on public.contents
for each row execute function app_private.protect_content_write();

create trigger user_roles_protect_insert
before insert on public.user_roles
for each row execute function app_private.protect_role_write();

create trigger user_roles_protect_delete
before delete on public.user_roles
for each row execute function app_private.protect_role_write();

create trigger contents_audit
after insert or update on public.contents
for each row execute function app_private.write_audit_log();

create trigger user_roles_audit
after insert or delete on public.user_roles
for each row execute function app_private.write_audit_log();

create trigger profiles_access_audit
after update on public.profiles
for each row execute function app_private.write_audit_log();

create trigger on_auth_user_created
after insert on auth.users
for each row execute function app_private.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.contents enable row level security;
alter table public.content_versions enable row level security;
alter table public.media_assets enable row level security;
alter table public.templates enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.approval_events enable row level security;
alter table public.publication_exports enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_select_active_users
on public.profiles for select to authenticated
using (app_private.is_active_user() and (is_active or app_private.has_role('admin')));

create policy profiles_update_self_or_admin
on public.profiles for update to authenticated
using (app_private.is_active_user() and (id = (select auth.uid()) or app_private.has_role('admin')))
with check (app_private.is_active_user() and (id = (select auth.uid()) or app_private.has_role('admin')));

create policy user_roles_select_self_or_admin
on public.user_roles for select to authenticated
using (app_private.is_active_user() and (user_id = (select auth.uid()) or app_private.has_role('admin')));

create policy user_roles_insert_admin
on public.user_roles for insert to authenticated
with check (app_private.has_role('admin') and user_id <> (select auth.uid()));

create policy user_roles_delete_admin
on public.user_roles for delete to authenticated
using (app_private.has_role('admin'));

create policy contents_select_authorized
on public.contents for select to authenticated
using (app_private.can_view_content(id));

create policy contents_insert_editor
on public.contents for insert to authenticated
with check (
  app_private.is_active_user()
  and (app_private.has_role('editor') or app_private.has_role('admin'))
  and created_by = (select auth.uid())
  and status = 'draft'
);

create policy contents_update_owner_or_admin
on public.contents for update to authenticated
using (
  app_private.is_active_user()
  and status in ('draft', 'changes_requested')
  and (app_private.has_role('admin') or (app_private.has_role('editor') and created_by = (select auth.uid())))
)
with check (
  app_private.is_active_user()
  and status in ('draft', 'changes_requested')
  and (app_private.has_role('admin') or (app_private.has_role('editor') and created_by = (select auth.uid())))
);

create policy templates_select_active_users
on public.templates for select to authenticated
using (app_private.is_active_user() and is_active);

create policy content_versions_select_authorized
on public.content_versions for select to authenticated
using (app_private.can_view_content(content_id));

create policy media_assets_select_authorized
on public.media_assets for select to authenticated
using (
  app_private.is_active_user()
  and (created_by = (select auth.uid()) or (content_id is not null and app_private.can_view_content(content_id)) or app_private.has_role('admin'))
);

create policy generation_jobs_select_authorized
on public.generation_jobs for select to authenticated
using (app_private.can_view_content(content_id));

create policy approval_events_select_authorized
on public.approval_events for select to authenticated
using (app_private.can_view_content(content_id));

create policy publication_exports_select_authorized
on public.publication_exports for select to authenticated
using (app_private.can_view_content(content_id));

create policy audit_logs_select_admin
on public.audit_logs for select to authenticated
using (app_private.has_role('admin'));

revoke all on all tables in schema public from anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, delete on public.user_roles to authenticated;
grant select, insert, update on public.contents to authenticated;
grant select on public.templates to authenticated;
grant select on public.content_versions to authenticated;
grant select on public.media_assets to authenticated;
grant select on public.generation_jobs to authenticated;
grant select on public.approval_events to authenticated;
grant select on public.publication_exports to authenticated;
grant select on public.audit_logs to authenticated;

grant all on all tables in schema public to service_role;

comment on schema app_private is 'Internal authorization and audit helpers; not exposed through the Data API.';
comment on table public.contents is 'Editorial contents. Direct status and ownership changes are blocked by trigger.';
comment on table public.audit_logs is 'Append-only audit events written by trusted database triggers.';

commit;
