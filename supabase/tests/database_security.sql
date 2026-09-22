begin;

do $$
declare
  missing_rls text;
begin
  select string_agg(c.relname, ', ') into missing_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname in ('profiles','user_roles','contents','content_versions','media_assets','templates','generation_jobs','approval_events','publication_exports','audit_logs')
    and not c.relrowsecurity;

  if missing_rls is not null then
    raise exception 'RLS ausente em: %', missing_rls;
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'anon'
      and table_name in ('profiles','user_roles','contents','content_versions','media_assets','templates','generation_jobs','approval_events','publication_exports','audit_logs')
  ) then
    raise exception 'A role anon não deve possuir grants nas tabelas da aplicação.';
  end if;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'contents_protect_write' and not tgisinternal) then
    raise exception 'Trigger de proteção de contents ausente.';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'contents_audit' and not tgisinternal) then
    raise exception 'Trigger de auditoria de contents ausente.';
  end if;
end $$;

rollback;
