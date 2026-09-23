-- Sprint 8: governança da trilha de auditoria.
-- A trilha (audit_logs) passa a ser imutável também para o service_role (chave do servidor):
--  * UPDATE: somente a anonimização do ator (actor_id -> NULL) causada pela exclusão do usuário (FK ON DELETE SET NULL);
--  * DELETE: somente pela função de retenção app_private.purge_audit_logs, executável apenas pelo dono do banco;
--  * TRUNCATE: bloqueado.
begin;

create or replace function app_private.protect_audit_logs()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'TRUNCATE' then
    raise exception 'AUDIT_IMMUTABLE' using errcode = '42501', detail = 'TRUNCATE não é permitido na trilha de auditoria.';
  elsif tg_op = 'UPDATE' then
    if new.actor_id is null and old.actor_id is not null
       and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
      return new; -- anonimização por exclusão do usuário
    end if;
    raise exception 'AUDIT_IMMUTABLE' using errcode = '42501', detail = 'Registros de auditoria não podem ser alterados.';
  elsif tg_op = 'DELETE' then
    if coalesce(current_setting('app.audit_retention', true), '') = 'on' then
      return old;
    end if;
    raise exception 'AUDIT_IMMUTABLE' using errcode = '42501', detail = 'Exclusão somente pela rotina de retenção.';
  end if;
  return null;
end;
$$;

drop trigger if exists audit_logs_immutable_row on public.audit_logs;
create trigger audit_logs_immutable_row before update or delete on public.audit_logs
for each row execute function app_private.protect_audit_logs();
drop trigger if exists audit_logs_immutable_truncate on public.audit_logs;
create trigger audit_logs_immutable_truncate before truncate on public.audit_logs
for each statement execute function app_private.protect_audit_logs();

revoke update, delete, truncate on public.audit_logs from service_role, authenticated, anon;

-- Retenção: remove registros anteriores ao limite informado e registra a própria execução.
-- O prazo é decisão de negócio/compliance (não definido aqui). Executável apenas pelo dono do banco (SQL Editor/CLI).
create or replace function app_private.purge_audit_logs(p_before timestamptz, p_reason text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare removed integer;
begin
  if p_before > now() - interval '365 days' then
    raise exception 'RETENTION_TOO_SHORT' using detail = 'O limite mínimo de segurança é de 365 dias.';
  end if;
  if coalesce(length(trim(p_reason)), 0) < 10 then raise exception 'REASON_REQUIRED'; end if;
  perform set_config('app.audit_retention', 'on', true);
  delete from public.audit_logs where created_at < p_before;
  get diagnostics removed = row_count;
  perform set_config('app.audit_retention', 'off', true);
  insert into public.audit_logs (actor_id, action, entity_type, metadata)
  values (null, 'audit.retention_purge', 'audit_logs', jsonb_build_object('before', p_before, 'removed', removed, 'reason', left(p_reason, 300)));
  return removed;
end;
$$;
revoke all on function app_private.purge_audit_logs(timestamptz, text) from public, anon, authenticated, service_role;

commit;
