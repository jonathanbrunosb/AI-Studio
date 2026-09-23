-- Sprint 8: regressões encontradas pelos testes E2E. Tudo é revertido.
begin;

do $$
declare editor_id uuid := gen_random_uuid(); approver_id uuid := gen_random_uuid();
begin
  perform set_config('t.editor', editor_id::text, true);
  perform set_config('t.approver', approver_id::text, true);
  insert into auth.users(id, email, raw_user_meta_data) values
    (editor_id, editor_id || '@example.invalid', '{"full_name":"Editora"}'),
    (approver_id, approver_id || '@example.invalid', '{"full_name":"Aprovador"}');
  insert into public.user_roles(user_id, role) values (editor_id, 'editor'), (approver_id, 'approver');
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('t.editor'), true);

-- 1. INSERT … RETURNING pelo autor (equivalente ao insert().select() do PostgREST) respeita a política de SELECT.
do $$
declare new_id uuid;
begin
  insert into public.contents(title, category, created_by)
  values ('Comunicado de teste', 'internal_communication', current_setting('t.editor')::uuid)
  returning id into new_id;
  if new_id is null then raise exception 'INSERT RETURNING não retornou o conteúdo'; end if;
  perform set_config('t.content', new_id::text, true);
end $$;

-- 2. Lista de aprovadores elegíveis executa sem ambiguidade e exclui o autor.
do $$
declare ids uuid[];
begin
  select array_agg(r.id) into ids from public.list_eligible_reviewers(current_setting('t.content')::uuid) r;
  if ids is null or not (current_setting('t.approver')::uuid = any(ids)) then raise exception 'Aprovador elegível ausente'; end if;
  if current_setting('t.editor')::uuid = any(ids) then raise exception 'Autor listado como aprovador'; end if;
end $$;

rollback;
