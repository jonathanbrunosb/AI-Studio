begin;

drop policy content_versions_update_working on public.content_versions;

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
  and (app_private.has_role('admin') or created_by = (select auth.uid()))
);

commit;
