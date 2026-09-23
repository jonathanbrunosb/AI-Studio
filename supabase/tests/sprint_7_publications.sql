-- Sprint 7: preparação, exportação, confirmação, idempotência e substituição. Tudo é revertido.
begin;

do $$
declare editor_id uuid := gen_random_uuid(); approver_id uuid := gen_random_uuid(); admin_id uuid := gen_random_uuid(); cid uuid; client uuid;
begin
  perform set_config('t.editor', editor_id::text, true);
  perform set_config('t.approver', approver_id::text, true);
  perform set_config('t.admin', admin_id::text, true);
  insert into auth.users(id, email, raw_user_meta_data) values
    (editor_id, editor_id || '@example.invalid', '{"full_name":"Editora"}'),
    (approver_id, approver_id || '@example.invalid', '{"full_name":"Aprovador"}'),
    (admin_id, admin_id || '@example.invalid', '{"full_name":"Admin"}');
  insert into public.user_roles(user_id, role) values (editor_id, 'editor'), (approver_id, 'approver'), (admin_id, 'admin');
  insert into public.contents(title, category, created_by) values ('Comunicado IFRS 16', 'internal_communication', editor_id) returning id into cid;
  perform set_config('t.content', cid::text, true);
  insert into public.content_versions(content_id, snapshot, version_kind, created_by, version_number)
  values (cid, '{"schemaVersion":1,"canvas":{"width":1080,"height":1080},"elements":[{"type":"textbox"}]}', 'working', editor_id, 1);
  insert into public.integration_clients(name, token_hash, token_prefix) values ('Portal', repeat('a', 64), 'ais_test') returning id into client;
  perform set_config('t.client', client::text, true);
end $$;

-- Rascunho não pode ser preparado.
set local role service_role;
do $$
begin
  perform public.register_publication_package(gen_random_uuid(), current_setting('t.editor')::uuid, current_setting('t.content')::uuid, gen_random_uuid(), 'comunicados_internos', '{}', null, null, null, 'x', 'y', false);
  raise exception 'Rascunho preparado';
exception when others then if sqlerrm <> 'NOT_APPROVED' then raise; end if;
end $$;
reset role;

-- Fluxo editorial até a aprovação.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('t.editor'), true);
select set_config('t.v1', public.submit_content_for_review(current_setting('t.content')::uuid)::text, true);
select set_config('request.jwt.claim.sub', current_setting('t.approver'), true);
select public.decide_content_review(current_setting('t.content')::uuid, current_setting('t.v1')::uuid, 'approved');
do $$
begin
  if has_function_privilege('authenticated', 'public.register_publication_package(uuid, uuid, uuid, uuid, text, jsonb, text, text, text, text, text, boolean)', 'execute')
     or has_function_privilege('authenticated', 'public.portal_acknowledge_publication(uuid, uuid, uuid, uuid, text, text, text, timestamptz, text)', 'execute') then
    raise exception 'Funções de backend expostas a usuários';
  end if;
  if has_table_privilege('authenticated', 'public.publication_exports', 'insert') or has_table_privilege('authenticated', 'public.publication_exports', 'update') then
    raise exception 'Escrita direta em publication_exports liberada';
  end if;
end $$;
reset role;

set local role service_role;
do $$
declare p1 uuid; again uuid; working uuid;
begin
  select id into working from public.content_versions where content_id = current_setting('t.content')::uuid and version_kind = 'working';
  begin
    perform public.register_publication_package(gen_random_uuid(), current_setting('t.editor')::uuid, current_setting('t.content')::uuid, working, 'comunicados_internos', '{}', null, null, null, 'x', 'y', false);
    raise exception 'Versão de trabalho aceita';
  exception when others then if sqlerrm <> 'VERSION_NOT_CURRENT' then raise; end if; end;
  begin
    perform public.register_publication_package(gen_random_uuid(), current_setting('t.approver')::uuid, current_setting('t.content')::uuid, current_setting('t.v1')::uuid, 'comunicados_internos', '{}', null, null, null, 'x', 'y', false);
    raise exception 'Aprovador preparou';
  exception when others then if sqlerrm <> 'FORBIDDEN_ROLE' then raise; end if; end;
  begin
    perform public.register_publication_package(gen_random_uuid(), current_setting('t.editor')::uuid, current_setting('t.content')::uuid, current_setting('t.v1')::uuid, 'newsletter_contabil', '{}', null, null, null, 'x', 'y', false);
    raise exception 'Destino incompatível aceito';
  exception when others then if sqlerrm <> 'INVALID_DESTINATION' then raise; end if; end;

  p1 := gen_random_uuid();
  perform public.register_publication_package(p1, current_setting('t.editor')::uuid, current_setting('t.content')::uuid, current_setting('t.v1')::uuid, 'comunicados_internos', '{"schema_version":"1.0"}', repeat('1', 64), repeat('2', 64), repeat('3', 64), 'pkg1.zip', 'img1.png', true);
  again := public.register_publication_package(p1, current_setting('t.editor')::uuid, current_setting('t.content')::uuid, current_setting('t.v1')::uuid, 'comunicados_internos', '{"schema_version":"1.0"}', repeat('1', 64), repeat('2', 64), repeat('4', 64), 'pkg1b.zip', 'img1.png', true);
  if again <> p1 then raise exception 'Preparação duplicada criou novo registro'; end if;
  perform set_config('t.p1', p1::text, true);
end $$;
reset role;

-- Exportação pelo autor; confirmação exige administrador e dados.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('t.editor'), true);
do $$
begin
  if public.transition_publication(current_setting('t.p1')::uuid, 'exported') <> 'exported' then raise exception 'Exportação não registrada'; end if;
  begin
    perform public.transition_publication(current_setting('t.p1')::uuid, 'confirm_published', 'Portal', now());
    raise exception 'Editor confirmou publicação';
  exception when insufficient_privilege then null; end;
  if (select status from public.contents where id = current_setting('t.content')::uuid) <> 'approved' then raise exception 'Exportação alterou status editorial'; end if;
end $$;
select set_config('request.jwt.claim.sub', current_setting('t.admin'), true);
do $$
begin
  begin
    perform public.transition_publication(current_setting('t.p1')::uuid, 'confirm_published');
    raise exception 'Confirmação sem dados aceita';
  exception when others then if sqlerrm <> 'CONFIRMATION_DATA_REQUIRED' then raise; end if; end;
  perform public.transition_publication(current_setting('t.p1')::uuid, 'confirm_published', 'Portal · Newsletter', now(), 'n-ais-1', 'https://portal.contabilidade-eqtl.com/#central');
  if (select status from public.contents where id = current_setting('t.content')::uuid) <> 'published' then raise exception 'Conteúdo não marcado como publicado'; end if;
  if public.transition_publication(current_setting('t.p1')::uuid, 'confirm_published', 'Outro canal', now()) <> 'published' then raise exception 'Reconfirmação alterou registro'; end if;
  if (select published_channel from public.publication_exports where id = current_setting('t.p1')::uuid) <> 'Portal · Newsletter' then raise exception 'Confirmação original sobrescrita'; end if;
end $$;
reset role;

-- Confirmação duplicada pela API é idempotente.
set local role service_role;
do $$
declare r record;
begin
  select * into r from public.portal_acknowledge_publication(current_setting('t.client')::uuid, current_setting('t.p1')::uuid, current_setting('t.content')::uuid, current_setting('t.v1')::uuid, 'published', 'outro-id', null, now(), null);
  if not r.duplicate then raise exception 'Confirmação duplicada não detectada'; end if;
  if (select external_publication_id from public.publication_exports where id = current_setting('t.p1')::uuid) <> 'n-ais-1' then raise exception 'Registro original alterado'; end if;
  begin
    perform public.portal_acknowledge_publication(current_setting('t.client')::uuid, current_setting('t.p1')::uuid, gen_random_uuid(), current_setting('t.v1')::uuid, 'received', null, null, null, null);
    raise exception 'Ack com conteúdo divergente aceito';
  exception when others then if sqlerrm <> 'PUBLICATION_MISMATCH' then raise; end if; end;
end $$;
reset role;

-- Nova versão a partir do publicado, nova aprovação e substituição controlada.
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('t.editor'), true);
select public.create_new_content_version(current_setting('t.content')::uuid);
update public.content_versions set snapshot = jsonb_set(snapshot, '{elements,0,type}', '"rect"') where content_id = current_setting('t.content')::uuid and version_kind = 'working';
select set_config('t.v2', public.submit_content_for_review(current_setting('t.content')::uuid)::text, true);
select set_config('request.jwt.claim.sub', current_setting('t.approver'), true);
select public.decide_content_review(current_setting('t.content')::uuid, current_setting('t.v2')::uuid, 'approved');
reset role;

set local role service_role;
do $$
declare p2 uuid;
begin
  begin
    perform public.register_publication_package(gen_random_uuid(), current_setting('t.editor')::uuid, current_setting('t.content')::uuid, current_setting('t.v1')::uuid, 'comunicados_internos', '{}', null, null, null, 'x', 'y', false);
    raise exception 'Versão desatualizada preparada';
  exception when others then if sqlerrm <> 'VERSION_NOT_CURRENT' then raise; end if; end;
  p2 := public.register_publication_package(gen_random_uuid(), current_setting('t.editor')::uuid, current_setting('t.content')::uuid, current_setting('t.v2')::uuid, 'comunicados_internos', '{}', repeat('5', 64), repeat('6', 64), repeat('7', 64), 'pkg2.zip', 'img2.png', true);
  if (select supersedes_id from public.publication_exports where id = p2) <> current_setting('t.p1')::uuid then raise exception 'Vínculo de substituição ausente'; end if;
  if (select status from public.publication_exports where id = current_setting('t.p1')::uuid) <> 'published' then raise exception 'Publicação anterior substituída antes da confirmação'; end if;
  perform set_config('t.p2', p2::text, true);
  -- Falha, nova tentativa e confirmação pela API.
  perform public.portal_acknowledge_publication(current_setting('t.client')::uuid, p2, current_setting('t.content')::uuid, current_setting('t.v2')::uuid, 'failed', null, null, null, 'Portal indisponível');
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('t.admin'), true);
select public.transition_publication(current_setting('t.p2')::uuid, 'retry');
reset role;
set local role service_role;
do $$
begin
  perform public.portal_acknowledge_publication(current_setting('t.client')::uuid, current_setting('t.p2')::uuid, current_setting('t.content')::uuid, current_setting('t.v2')::uuid, 'received', 'n-ais-2', null, null, null);
  perform public.portal_acknowledge_publication(current_setting('t.client')::uuid, current_setting('t.p2')::uuid, current_setting('t.content')::uuid, current_setting('t.v2')::uuid, 'published', 'n-ais-2', null, now(), null);
  if (select status from public.publication_exports where id = current_setting('t.p1')::uuid) <> 'superseded' then raise exception 'Versão anterior não marcada como substituída'; end if;
  if (select count(*) from public.publication_events where publication_id in (current_setting('t.p1')::uuid, current_setting('t.p2')::uuid)) < 9 then raise exception 'Histórico incompleto'; end if;
  if (select approved_version_id from public.contents where id = current_setting('t.content')::uuid) <> current_setting('t.v2')::uuid then raise exception 'Versão aprovada incorreta'; end if;
end $$;

rollback;
