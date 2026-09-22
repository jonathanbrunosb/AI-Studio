begin;

alter table public.content_versions
  add column version_kind text not null default 'checkpoint'
    check (version_kind in ('working', 'checkpoint', 'frozen')),
  add column label text check (label is null or char_length(label) <= 120),
  add column updated_at timestamptz not null default now();

create unique index content_versions_one_working_idx
  on public.content_versions (content_id)
  where version_kind = 'working';

create index content_versions_content_created_idx
  on public.content_versions (content_id, created_at desc);

create or replace function app_private.prepare_content_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  content_owner uuid;
  content_status text;
begin
  if (select auth.uid()) is null and current_user in ('postgres', 'service_role') then
    if tg_op = 'UPDATE' then new.updated_at := now(); end if;
    return new;
  end if;

  if not app_private.is_active_user()
     or not (app_private.has_role('editor') or app_private.has_role('admin')) then
    raise exception 'Editorial access required.' using errcode = '42501';
  end if;

  select created_by, status into content_owner, content_status
  from public.contents where id = new.content_id;

  if content_owner is null
     or content_status not in ('draft', 'changes_requested')
     or (not app_private.has_role('admin') and content_owner <> (select auth.uid())) then
    raise exception 'This project cannot be edited.' using errcode = '42501';
  end if;

  if jsonb_typeof(new.snapshot) <> 'object'
     or jsonb_typeof(new.snapshot -> 'elements') <> 'array'
     or not (new.snapshot ?& array['schemaVersion', 'canvas', 'elements'])
     or octet_length(new.snapshot::text) > 1048576 then
    raise exception 'Invalid editor project.' using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    new.created_by := (select auth.uid());
    perform pg_advisory_xact_lock(hashtextextended(new.content_id::text, 0));
    select coalesce(max(version_number), 0) + 1 into new.version_number
    from public.content_versions where content_id = new.content_id;
  else
    if old.version_kind <> 'working'
       or new.id is distinct from old.id
       or new.content_id is distinct from old.content_id
       or new.created_by is distinct from old.created_by
       or new.version_number is distinct from old.version_number
       or new.version_kind is distinct from old.version_kind then
      raise exception 'Saved versions are immutable.' using errcode = '42501';
    end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

revoke all on function app_private.prepare_content_version() from public, anon, authenticated;

create trigger content_versions_prepare_write
before insert or update on public.content_versions
for each row execute function app_private.prepare_content_version();

create policy content_versions_insert_editor
on public.content_versions for insert to authenticated
with check (
  app_private.is_active_user()
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.contents c
    where c.id = content_id
      and c.status in ('draft', 'changes_requested')
      and (app_private.has_role('admin') or (app_private.has_role('editor') and c.created_by = (select auth.uid())))
  )
);

create policy content_versions_update_working
on public.content_versions for update to authenticated
using (
  app_private.is_active_user()
  and version_kind = 'working'
  and exists (
    select 1 from public.contents c
    where c.id = content_id
      and c.status in ('draft', 'changes_requested')
      and (app_private.has_role('admin') or (app_private.has_role('editor') and c.created_by = (select auth.uid())))
  )
)
with check (
  app_private.is_active_user()
  and version_kind = 'working'
  and created_by = (select auth.uid())
);

grant insert (content_id, snapshot, version_kind, label, created_by, version_number)
  on public.content_versions to authenticated;
grant update (snapshot, label, updated_at)
  on public.content_versions to authenticated;

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

grant insert (content_id, storage_path, file_name, mime_type, created_by)
  on public.media_assets to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'editor-assets',
  'editor-assets',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy editor_assets_select_owner_or_admin
on storage.objects for select to authenticated
using (
  bucket_id = 'editor-assets'
  and app_private.is_active_user()
  and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or app_private.has_role('admin')
  )
);

create policy editor_assets_insert_owner
on storage.objects for insert to authenticated
with check (
  bucket_id = 'editor-assets'
  and app_private.is_active_user()
  and (app_private.has_role('editor') or app_private.has_role('admin'))
  and split_part(name, '/', 1) = (select auth.uid())::text
);

create policy editor_assets_delete_owner
on storage.objects for delete to authenticated
using (
  bucket_id = 'editor-assets'
  and app_private.is_active_user()
  and split_part(name, '/', 1) = (select auth.uid())::text
);

create or replace function app_private.audit_editor_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    (select auth.uid()),
    case when new.version_kind = 'working' then 'editor.saved' else 'editor.version_created' end,
    'content_versions',
    new.id,
    jsonb_build_object('content_id', new.content_id, 'version_number', new.version_number, 'version_kind', new.version_kind)
  );
  return new;
end;
$$;

revoke all on function app_private.audit_editor_version() from public, anon, authenticated;

create trigger content_versions_audit
after insert on public.content_versions
for each row execute function app_private.audit_editor_version();

commit;
