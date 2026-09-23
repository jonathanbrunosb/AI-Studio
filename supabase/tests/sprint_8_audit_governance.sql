-- Sprint 8: imutabilidade da trilha de auditoria. Tudo é revertido.
begin;

do $$
declare uid uuid := gen_random_uuid(); log_id uuid;
begin
  insert into auth.users(id, email) values (uid, uid || '@example.invalid');
  insert into public.audit_logs(actor_id, action, entity_type, created_at) values (uid, 'teste.antigo', 'x', now() - interval '800 days') returning id into log_id;
  perform set_config('t.uid', uid::text, true);
  perform set_config('t.log', log_id::text, true);
end $$;

set local role service_role;
do $$
begin
  begin update public.audit_logs set action = 'alterado' where id = current_setting('t.log')::uuid; raise exception 'UPDATE aceito';
  exception when insufficient_privilege then null; end;
  begin delete from public.audit_logs where id = current_setting('t.log')::uuid; raise exception 'DELETE aceito';
  exception when insufficient_privilege then null; end;
  begin truncate public.audit_logs; raise exception 'TRUNCATE aceito';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Mesmo o dono do banco não altera o conteúdo nem apaga fora da rotina de retenção.
do $$
begin
  begin update public.audit_logs set metadata = '{"x":1}' where id = current_setting('t.log')::uuid; raise exception 'UPDATE do dono aceito';
  exception when insufficient_privilege then null; end;
  begin delete from public.audit_logs where id = current_setting('t.log')::uuid; raise exception 'DELETE do dono aceito';
  exception when insufficient_privilege then null; end;
end $$;

-- Exclusão do usuário anonimiza o ator (FK ON DELETE SET NULL) sem violar a imutabilidade.
delete from auth.users where id = current_setting('t.uid')::uuid;
do $$
begin
  if (select actor_id from public.audit_logs where id = current_setting('t.log')::uuid) is not null then raise exception 'Ator não anonimizado'; end if;
  if (select action from public.audit_logs where id = current_setting('t.log')::uuid) <> 'teste.antigo' then raise exception 'Registro alterado'; end if;
end $$;

-- Retenção: exige prazo mínimo e justificativa, e registra a execução.
do $$
declare removed integer;
begin
  begin perform app_private.purge_audit_logs(now() - interval '30 days', 'teste de retenção curta'); raise exception 'Prazo curto aceito';
  exception when others then if sqlerrm <> 'RETENTION_TOO_SHORT' then raise; end if; end;
  removed := app_private.purge_audit_logs(now() - interval '400 days', 'Política de retenção aprovada em teste');
  if removed < 1 then raise exception 'Retenção não removeu registros antigos'; end if;
  if not exists (select 1 from public.audit_logs where action = 'audit.retention_purge') then raise exception 'Execução da retenção não registrada'; end if;
  if has_function_privilege('service_role', 'app_private.purge_audit_logs(timestamptz, text)', 'execute') then raise exception 'service_role executa retenção'; end if;
end $$;

rollback;
