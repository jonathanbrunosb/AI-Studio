-- Sprint 6: fluxo editorial executado com as roles da API. Tudo é revertido ao final.
begin;

do $$
declare editor_id uuid := gen_random_uuid(); approver_id uuid := gen_random_uuid(); approver2_id uuid := gen_random_uuid();
        admin_id uuid := gen_random_uuid(); content_id uuid;
begin
  perform set_config('t.editor', editor_id::text, true);
  perform set_config('t.approver', approver_id::text, true);
  perform set_config('t.approver2', approver2_id::text, true);
  perform set_config('t.admin', admin_id::text, true);
  insert into auth.users(id, email, raw_user_meta_data) values
    (editor_id, editor_id || '@example.invalid', '{"full_name":"Editora"}'),
    (approver_id, approver_id || '@example.invalid', '{"full_name":"Aprovador A"}'),
    (approver2_id, approver2_id || '@example.invalid', '{"full_name":"Aprovador B"}'),
    (admin_id, admin_id || '@example.invalid', '{"full_name":"Admin autor"}');
  insert into public.user_roles(user_id, role) values
    (editor_id, 'editor'), (approver_id, 'approver'), (approver2_id, 'approver'), (admin_id, 'admin'), (admin_id, 'editor');
  insert into public.contents(title, category, created_by) values ('Newsletter de março', 'accounting_newsletter', editor_id)
    returning id into content_id;
  perform set_config('t.content', content_id::text, true);
  insert into public.content_versions(content_id, snapshot, version_kind, created_by, version_number)
  values (content_id, '{"schemaVersion":1,"canvas":{"width":1080,"height":1080,"backgroundColor":"#ffffff"},"elements":[{"type":"textbox","text":"Título"}],"templateId":null,"templateSnapshot":null,"updatedAt":null}', 'working', editor_id, 1);
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('t.editor'), true);

do $$
declare v1 uuid; v2 uuid;
begin
  -- Newsletter sem fonte: bloqueada.
  begin
    perform public.submit_content_for_review(current_setting('t.content')::uuid);
    raise exception 'Envio incompleto aceito';
  exception when others then if sqlerrm <> 'MISSING_NEWSLETTER_SOURCE' then raise; end if; end;

  update public.contents set source_name = 'CFC', source_url = 'https://cfc.org.br' where id = current_setting('t.content')::uuid;

  -- Autor como aprovador: bloqueado.
  begin
    perform public.submit_content_for_review(current_setting('t.content')::uuid, current_setting('t.editor')::uuid);
    raise exception 'Autor aceito como aprovador';
  exception when others then if sqlerrm <> 'INVALID_REVIEWER' then raise; end if; end;

  v1 := public.submit_content_for_review(current_setting('t.content')::uuid, null, 'Primeira versão');
  perform set_config('t.v1', v1::text, true);
  if (select status from public.contents where id = current_setting('t.content')::uuid) <> 'in_review' then raise exception 'Status não mudou'; end if;

  -- Tentativas diretas de burlar o fluxo.
  begin
    update public.contents set status = 'approved' where id = current_setting('t.content')::uuid;
    if found then raise exception 'Status alterado diretamente'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update public.contents set title = 'Alterado em revisão' where id = current_setting('t.content')::uuid;
    if found then raise exception 'Conteúdo em revisão editado'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update public.content_versions set snapshot = snapshot where content_id = current_setting('t.content')::uuid;
    if found then raise exception 'Versão editada em revisão'; end if;
  exception when insufficient_privilege then null; end;
  begin
    insert into public.approval_events(content_id, actor_id, action) values (current_setting('t.content')::uuid, auth.uid(), 'approved');
    raise exception 'Evento inserido diretamente';
  exception when insufficient_privilege then null; end;
  begin
    perform public.decide_content_review(current_setting('t.content')::uuid, v1, 'approved');
    raise exception 'Editor aprovou';
  exception when insufficient_privilege then null; end;
end $$;

-- Aprovador A solicita ajustes (comentário obrigatório).
select set_config('request.jwt.claim.sub', current_setting('t.approver'), true);
do $$
begin
  begin
    perform public.decide_content_review(current_setting('t.content')::uuid, current_setting('t.v1')::uuid, 'changes_requested', '');
    raise exception 'Ajuste sem justificativa aceito';
  exception when others then if sqlerrm <> 'COMMENT_REQUIRED' then raise; end if; end;
  perform public.decide_content_review(current_setting('t.content')::uuid, current_setting('t.v1')::uuid, 'changes_requested', 'Revisar a fonte da notícia.');
  if (select count(*) from public.notifications) <> 1 then raise exception 'Aprovador deve ver apenas suas notificações'; end if;
end $$;

-- Aprovador B tenta decidir a mesma versão: estado já mudou.
select set_config('request.jwt.claim.sub', current_setting('t.approver2'), true);
do $$
begin
  perform public.decide_content_review(current_setting('t.content')::uuid, current_setting('t.v1')::uuid, 'approved');
  raise exception 'Decisão conflitante aceita';
exception when others then if sqlerrm not in ('STATE_CHANGED', 'CONTENT_NOT_FOUND') then raise; end if;
end $$;

-- Autor ajusta e reenvia, designando o aprovador B.
select set_config('request.jwt.claim.sub', current_setting('t.editor'), true);
do $$
declare v2 uuid;
begin
  if not exists (select 1 from public.notifications where type = 'changes_requested') then raise exception 'Autor não notificado'; end if;
  update public.content_versions set snapshot = jsonb_set(snapshot, '{elements,0,text}', '"Título corrigido"')
  where content_id = current_setting('t.content')::uuid and version_kind = 'working';
  v2 := public.submit_content_for_review(current_setting('t.content')::uuid, current_setting('t.approver2')::uuid, 'Fonte revisada');
  perform set_config('t.v2', v2::text, true);
  if v2 = current_setting('t.v1')::uuid then raise exception 'Nova versão não criada'; end if;
  if (select review_cycle from public.contents where id = current_setting('t.content')::uuid) <> 2 then raise exception 'Ciclo incorreto'; end if;
end $$;

-- Aprovador A não é o designado; B aprova a versão exata; decisão sobre v1 é recusada.
select set_config('request.jwt.claim.sub', current_setting('t.approver'), true);
do $$
begin
  perform public.decide_content_review(current_setting('t.content')::uuid, current_setting('t.v2')::uuid, 'approved');
  raise exception 'Aprovador não designado decidiu';
exception when others then if sqlerrm not in ('NOT_ASSIGNED', 'CONTENT_NOT_FOUND') then raise; end if;
end $$;

select set_config('request.jwt.claim.sub', current_setting('t.approver2'), true);
do $$
begin
  begin
    perform public.decide_content_review(current_setting('t.content')::uuid, current_setting('t.v1')::uuid, 'approved');
    raise exception 'Decisão sobre versão antiga aceita';
  exception when others then if sqlerrm <> 'VERSION_MISMATCH' then raise; end if; end;
  perform public.decide_content_review(current_setting('t.content')::uuid, current_setting('t.v2')::uuid, 'approved');
  if not exists (select 1 from public.contents where id = current_setting('t.content')::uuid and status = 'approved' and approved_version_id = current_setting('t.v2')::uuid) then
    raise exception 'Aprovação não vinculada à versão';
  end if;
end $$;

-- Conteúdo aprovado: edição bloqueada; nova versão preserva a aprovada; arquivamento preserva histórico.
select set_config('request.jwt.claim.sub', current_setting('t.editor'), true);
do $$
begin
  begin
    update public.contents set title = 'Pós-aprovação' where id = current_setting('t.content')::uuid;
    if found then raise exception 'Aprovado editado'; end if;
  exception when insufficient_privilege then null; end;
  begin
    update public.content_versions set label = 'x' where id = current_setting('t.v2')::uuid;
    if found then raise exception 'Versão aprovada alterada'; end if;
  exception when insufficient_privilege then null; end;
  perform public.create_new_content_version(current_setting('t.content')::uuid);
  if not exists (select 1 from public.contents where id = current_setting('t.content')::uuid and status = 'draft' and approved_version_id = current_setting('t.v2')::uuid) then
    raise exception 'Nova versão não preservou a aprovada';
  end if;
  perform public.archive_content(current_setting('t.content')::uuid, 'Substituído');
  if (select count(*) from public.approval_events where content_id = current_setting('t.content')::uuid) <> 6 then
    raise exception 'Histórico incompleto: %', (select count(*) from public.approval_events where content_id = current_setting('t.content')::uuid);
  end if;
  if (select count(*) from public.content_versions where content_id = current_setting('t.content')::uuid and version_kind = 'frozen') <> 2 then
    raise exception 'Versões congeladas perdidas';
  end if;
end $$;

-- Admin autor não pode aprovar o próprio conteúdo.
reset role;
do $$
declare cid uuid;
begin
  insert into public.contents(title, category, created_by) values ('Comunicado do admin', 'internal_communication', current_setting('t.admin')::uuid) returning id into cid;
  insert into public.content_versions(content_id, snapshot, version_kind, created_by, version_number)
  values (cid, '{"schemaVersion":1,"canvas":{},"elements":[{"type":"rect"}]}', 'working', current_setting('t.admin')::uuid, 1);
  perform set_config('t.admin_content', cid::text, true);
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('t.admin'), true);
do $$
declare v uuid;
begin
  v := public.submit_content_for_review(current_setting('t.admin_content')::uuid);
  perform public.decide_content_review(current_setting('t.admin_content')::uuid, v, 'approved');
  raise exception 'Autoaprovação do admin aceita';
exception when others then if sqlerrm <> 'SELF_APPROVAL' then raise; end if;
end $$;

rollback;
