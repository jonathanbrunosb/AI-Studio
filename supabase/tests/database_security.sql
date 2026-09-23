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

do $$
declare
  rpc_names constant text[] := array[
    'archive_content',
    'create_new_content_version',
    'decide_content_review',
    'list_eligible_reviewers',
    'submit_content_for_review',
    'transition_publication'
  ];
  invalid_public_rpc text;
  missing_private_rpc text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
    into invalid_public_rpc
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = any(rpc_names)
    and (
      p.prosecdef
      or has_function_privilege('anon', p.oid, 'EXECUTE')
      or not has_function_privilege('authenticated', p.oid, 'EXECUTE')
    );

  if invalid_public_rpc is not null then
    raise exception 'RPCs públicos fora do padrão SECURITY INVOKER: %', invalid_public_rpc;
  end if;

  select string_agg(expected_name, ', ' order by expected_name)
    into missing_private_rpc
  from unnest(rpc_names) expected_name
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'app_private'
      and p.proname = expected_name
      and p.prosecdef
      and not has_function_privilege('anon', p.oid, 'EXECUTE')
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and coalesce(p.proconfig, array[]::text[]) @> array['search_path=""']
  );

  if missing_private_rpc is not null then
    raise exception 'Implementações privadas ausentes ou inseguras: %', missing_private_rpc;
  end if;
end $$;

rollback;
