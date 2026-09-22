-- Sprint 5: cota atômica, RLS dos jobs, grants e auditoria da configuração de IA. Tudo é revertido.
begin;

do $$
declare editor_id uuid := gen_random_uuid(); other_id uuid := gen_random_uuid(); admin_id uuid := gen_random_uuid(); content_id uuid;
begin
  perform set_config('test.editor', editor_id::text, true);
  perform set_config('test.other', other_id::text, true);
  perform set_config('test.admin', admin_id::text, true);
  insert into auth.users(id, email, raw_user_meta_data) values
    (editor_id, editor_id::text || '@example.invalid', '{"full_name":"Editor IA"}'),
    (other_id, other_id::text || '@example.invalid', '{"full_name":"Outro editor"}'),
    (admin_id, admin_id::text || '@example.invalid', '{"full_name":"Admin IA"}');
  insert into public.user_roles(user_id, role) values (editor_id, 'editor'), (other_id, 'editor'), (admin_id, 'admin');
  insert into public.contents(title, category, created_by) values ('Comunicado IA', 'accounting_newsletter', editor_id) returning id into content_id;
  perform set_config('test.content', content_id::text, true);

  if has_function_privilege('authenticated', 'public.reserve_generation_job(uuid, uuid, text, text, text, jsonb, integer, numeric, uuid)', 'execute')
     or has_function_privilege('anon', 'public.reserve_generation_job(uuid, uuid, text, text, text, jsonb, integer, numeric, uuid)', 'execute') then
    raise exception 'reserve_generation_job não pode ser executada por usuários finais.';
  end if;
  if has_table_privilege('authenticated', 'public.generation_jobs', 'insert')
     or has_table_privilege('authenticated', 'public.generation_jobs', 'update') then
    raise exception 'Usuários não podem gravar diretamente em generation_jobs.';
  end if;
  if has_column_privilege('authenticated', 'public.media_assets', 'bucket', 'insert')
     or has_column_privilege('authenticated', 'public.media_assets', 'source', 'insert') then
    raise exception 'Usuários não podem registrar mídias nos buckets de IA.';
  end if;
  if exists (select 1 from storage.buckets where id in ('ai-generated', 'ai-references') and public) then
    raise exception 'Buckets de IA devem ser privados.';
  end if;
end $$;

-- Cota: limite individual 2, contando jobs em andamento.
insert into public.ai_user_limits(user_id, max_requests) values (current_setting('test.editor')::uuid, 2);
do $$
declare first_job uuid;
begin
  select job_id into first_job from public.reserve_generation_job(current_setting('test.editor')::uuid, current_setting('test.content')::uuid, 'fal', 'fal-ai/flux/schnell', 'p', '{}', 1, 0.003);
  perform public.reserve_generation_job(current_setting('test.editor')::uuid, current_setting('test.content')::uuid, 'fal', 'fal-ai/flux/schnell', 'p', '{}', 1, 0.003);
  begin
    perform public.reserve_generation_job(current_setting('test.editor')::uuid, current_setting('test.content')::uuid, 'fal', 'fal-ai/flux/schnell', 'p', '{}', 1, 0.003);
    raise exception 'Cota ultrapassada foi aceita';
  exception when others then
    if sqlerrm not like '%QUOTA_EXCEEDED%' then raise; end if;
  end;
  update public.generation_jobs set status = 'failed' where id = first_job;
  perform public.reserve_generation_job(current_setting('test.editor')::uuid, current_setting('test.content')::uuid, 'fal', 'fal-ai/flux/schnell', 'p', '{}', 1, 0.003);

  update public.ai_models set is_enabled = false where id = 'fal-ai/flux/dev';
  begin
    perform public.reserve_generation_job(current_setting('test.other')::uuid, current_setting('test.content')::uuid, 'fal', 'fal-ai/flux/dev', 'p', '{}', 1, null);
    raise exception 'Modelo desabilitado foi aceito';
  exception when others then
    if sqlerrm not like '%MODEL_DISABLED%' then raise; end if;
  end;
  if (select count(*) from public.audit_logs where action = 'ai_generation.requested') < 3 then
    raise exception 'Solicitações não foram auditadas.';
  end if;
end $$;

-- RLS: outro editor não enxerga jobs de conteúdo alheio em rascunho.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.other'), true);
do $$
begin
  if exists (select 1 from public.generation_jobs) then raise exception 'Vazamento de jobs para outro usuário.'; end if;
  update public.ai_models set is_enabled = true where id = 'fal-ai/flux/dev';
  if exists (select 1 from public.ai_models where id = 'fal-ai/flux/dev' and is_enabled) then raise exception 'Editor alterou modelo.'; end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.editor'), true);
do $$
begin
  if (select count(*) from public.generation_jobs) <> 3 then raise exception 'Solicitante deve ver os próprios jobs.'; end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('test.admin'), true);
do $$
begin
  update public.ai_models set is_enabled = true where id = 'fal-ai/flux/dev';
  if not exists (select 1 from public.ai_models where id = 'fal-ai/flux/dev' and is_enabled) then raise exception 'Admin não conseguiu habilitar o modelo.'; end if;
end $$;
reset role;
do $$
begin
  if not exists (select 1 from public.audit_logs where action = 'ai_model.enabled' and actor_id = current_setting('test.admin')::uuid) then
    raise exception 'Habilitação de modelo não foi auditada.';
  end if;
end $$;

rollback;
