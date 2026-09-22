begin;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'content_versions_one_working_idx'
      and indexdef ilike '%where (version_kind = ''working''%'
  ) then
    raise exception 'Índice único da versão de trabalho não encontrado.';
  end if;

  if has_table_privilege('anon', 'public.content_versions', 'select')
     or has_table_privilege('anon', 'public.media_assets', 'select') then
    raise exception 'A role anon recebeu acesso ao editor.';
  end if;

  if not has_column_privilege('authenticated', 'public.content_versions', 'snapshot', 'update')
     or has_column_privilege('authenticated', 'public.content_versions', 'created_by', 'update')
     or has_column_privilege('authenticated', 'public.content_versions', 'version_kind', 'update') then
    raise exception 'Grants por coluna de content_versions estão incorretos.';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'editor_assets_insert_owner'
  ) then
    raise exception 'Política de upload privado não encontrada.';
  end if;

  if not exists (
    select 1 from storage.buckets
    where id = 'editor-assets'
      and public = false
      and file_size_limit = 10485760
      and allowed_mime_types @> array['image/png', 'image/jpeg', 'image/webp']::text[]
  ) then
    raise exception 'Bucket privado do editor está configurado incorretamente.';
  end if;
end
$$;

rollback;
