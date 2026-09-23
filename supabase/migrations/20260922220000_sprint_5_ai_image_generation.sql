-- Sprint 5: integração com IA para geração de imagens (provedor inicial: fal.ai).
-- Escritas de estado dos jobs, custos e arquivos gerados ocorrem somente no backend
-- (service_role), após verificação explícita de identidade, permissão e cota.
begin;

-- ---------------------------------------------------------------------------
-- generation_jobs: campos adicionais e padronização de status
-- ---------------------------------------------------------------------------
alter table public.generation_jobs drop constraint if exists generation_jobs_status_check;
update public.generation_jobs set status = 'pending' where status = 'queued';
update public.generation_jobs set status = 'canceled' where status = 'cancelled';
alter table public.generation_jobs alter column status set default 'pending';
alter table public.generation_jobs add constraint generation_jobs_status_check
  check (status in ('pending', 'processing', 'completed', 'failed', 'canceled'));

alter table public.generation_jobs
  add column provider text not null default 'fal',
  add column model text not null default 'unknown',
  add column prompt text not null default '',
  add column settings jsonb not null default '{}'::jsonb,
  add column external_request_id text,
  add column error_message text,
  add column estimated_cost numeric(12, 4),
  add column actual_cost numeric(12, 4),
  add column image_count integer not null default 1 check (image_count between 1 and 8),
  add column completed_at timestamptz,
  add column finalizing_at timestamptz,
  add column parent_job_id uuid references public.generation_jobs(id) on delete set null;

alter table public.generation_jobs alter column provider drop default;
alter table public.generation_jobs alter column model drop default;
alter table public.generation_jobs add constraint generation_jobs_prompt_length check (char_length(prompt) <= 4000);

comment on column public.generation_jobs.created_by is 'Usuário solicitante (requested_by na especificação da Sprint 5).';
comment on column public.generation_jobs.settings is 'Parâmetros enviados ao provedor e metadados de acompanhamento. Nunca contém credenciais.';
comment on column public.generation_jobs.actual_cost is 'Custo informado pelo provedor. Nulo quando indisponível; nunca estimado.';

create index generation_jobs_created_by_created_at_idx on public.generation_jobs (created_by, created_at desc);
create index generation_jobs_model_idx on public.generation_jobs (model);

drop policy if exists generation_jobs_select_authorized on public.generation_jobs;
create policy generation_jobs_select_authorized
on public.generation_jobs for select to authenticated
using (
  app_private.is_active_user()
  and (created_by = (select auth.uid()) or app_private.has_role('admin') or app_private.can_view_content(content_id))
);

-- ---------------------------------------------------------------------------
-- media_assets: origem, vínculo com a geração, metadados técnicos e retenção
-- ---------------------------------------------------------------------------
alter table public.media_assets
  add column bucket text not null default 'editor-assets'
    check (bucket in ('editor-assets', 'ai-generated', 'ai-references')),
  add column source text not null default 'upload'
    check (source in ('upload', 'ai_generation', 'ai_reference')),
  add column generation_job_id uuid references public.generation_jobs(id) on delete set null,
  add column width integer check (width is null or width > 0),
  add column height integer check (height is null or height > 0),
  add column size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  add column in_library boolean not null default true,
  add column sensitivity text not null default 'internal'
    check (sensitivity in ('public', 'internal', 'restricted', 'confidential')),
  add column deleted_at timestamptz;

create index media_assets_generation_job_id_idx on public.media_assets (generation_job_id) where generation_job_id is not null;
create index media_assets_source_idx on public.media_assets (source, created_at desc);

comment on column public.media_assets.in_library is 'Imagens de IA só aparecem na biblioteca do editor após "Salvar na biblioteca".';
comment on column public.media_assets.deleted_at is 'Exclusão lógica. O arquivo é mantido quando referenciado por versões do conteúdo.';

-- ---------------------------------------------------------------------------
-- Catálogo de modelos habilitáveis e configurações de consumo
-- ---------------------------------------------------------------------------
create table public.ai_models (
  id text primary key,
  provider text not null,
  name text not null,
  is_enabled boolean not null default false,
  estimated_cost_per_image numeric(12, 4),
  cost_currency text not null default 'USD',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ai_models is 'Habilitação administrativa dos modelos. As capacidades técnicas ficam no catálogo versionado em código (src/lib/ai/models).';

create table public.ai_settings (
  id boolean primary key default true check (id),
  integration_enabled boolean not null default true,
  default_max_requests integer not null default 30 check (default_max_requests between 0 and 10000),
  period_days integer not null default 30 check (period_days between 1 and 365),
  allow_restricted_references boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.ai_user_limits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  max_requests integer not null check (max_requests between 0 and 10000),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.ai_settings (id) values (true);

-- Valores de referência da tabela pública do fal.ai (≈1 megapixel por imagem).
-- Devem ser revisados pelo administrador; não representam cobrança efetiva.
insert into public.ai_models (id, provider, name, is_enabled, estimated_cost_per_image) values
  ('fal-ai/flux/schnell', 'fal', 'FLUX.1 [schnell]', true, 0.003),
  ('fal-ai/flux/dev', 'fal', 'FLUX.1 [dev]', true, 0.025),
  ('fal-ai/flux/dev/image-to-image', 'fal', 'FLUX.1 [dev] · Imagem de referência', true, 0.030);

create trigger ai_models_set_updated_at before update on public.ai_models
for each row execute function app_private.set_updated_at();
create trigger ai_settings_set_updated_at before update on public.ai_settings
for each row execute function app_private.set_updated_at();
create trigger ai_user_limits_set_updated_at before update on public.ai_user_limits
for each row execute function app_private.set_updated_at();

create or replace function app_private.audit_ai_configuration()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  audit_action text;
  audit_metadata jsonb;
  audit_entity_id uuid;
begin
  if tg_table_name = 'ai_models' then
    if new.is_enabled is not distinct from old.is_enabled
       and new.estimated_cost_per_image is not distinct from old.estimated_cost_per_image then
      return new;
    end if;
    audit_action := case
      when new.is_enabled is distinct from old.is_enabled then
        case when new.is_enabled then 'ai_model.enabled' else 'ai_model.disabled' end
      else 'ai_model.cost_updated' end;
    audit_metadata := jsonb_build_object('model', new.id, 'is_enabled', new.is_enabled,
      'estimated_cost_per_image', new.estimated_cost_per_image);
  elsif tg_table_name = 'ai_settings' then
    audit_action := 'ai_settings.updated';
    audit_metadata := jsonb_build_object('integration_enabled', new.integration_enabled,
      'default_max_requests', new.default_max_requests, 'period_days', new.period_days,
      'allow_restricted_references', new.allow_restricted_references);
  else
    audit_action := case when tg_op = 'DELETE' then 'ai_limit.removed' else 'ai_limit.updated' end;
    audit_entity_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
    audit_metadata := case when tg_op = 'DELETE' then '{}'::jsonb else jsonb_build_object('max_requests', new.max_requests) end;
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), audit_action, tg_table_name, audit_entity_id, audit_metadata);
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function app_private.audit_ai_configuration() from public, anon, authenticated;

create trigger ai_models_audit after update on public.ai_models
for each row execute function app_private.audit_ai_configuration();
create trigger ai_settings_audit after update on public.ai_settings
for each row execute function app_private.audit_ai_configuration();
create trigger ai_user_limits_audit after insert or update or delete on public.ai_user_limits
for each row execute function app_private.audit_ai_configuration();

alter table public.ai_models enable row level security;
alter table public.ai_settings enable row level security;
alter table public.ai_user_limits enable row level security;

create policy ai_models_select_active on public.ai_models for select to authenticated
using (app_private.is_active_user());
create policy ai_models_update_admin on public.ai_models for update to authenticated
using (app_private.has_role('admin')) with check (app_private.has_role('admin'));

create policy ai_settings_select_active on public.ai_settings for select to authenticated
using (app_private.is_active_user());
create policy ai_settings_update_admin on public.ai_settings for update to authenticated
using (app_private.has_role('admin')) with check (app_private.has_role('admin'));

create policy ai_user_limits_select on public.ai_user_limits for select to authenticated
using (app_private.is_active_user() and (user_id = (select auth.uid()) or app_private.has_role('admin')));
create policy ai_user_limits_write_admin on public.ai_user_limits for all to authenticated
using (app_private.has_role('admin')) with check (app_private.has_role('admin'));

grant select, update (is_enabled, estimated_cost_per_image, updated_by) on public.ai_models to authenticated;
grant select, update (integration_enabled, default_max_requests, period_days, allow_restricted_references, updated_by)
  on public.ai_settings to authenticated;
grant select, insert, update, delete on public.ai_user_limits to authenticated;
grant all on public.ai_models, public.ai_settings, public.ai_user_limits to service_role;

-- ---------------------------------------------------------------------------
-- Reserva atômica de cota: serializa por usuário e conta jobs em andamento.
-- Executável apenas pelo backend (service_role), após autenticação no app.
-- ---------------------------------------------------------------------------
create or replace function public.reserve_generation_job(
  p_user_id uuid,
  p_content_id uuid,
  p_provider text,
  p_model text,
  p_prompt text,
  p_settings jsonb,
  p_image_count integer,
  p_estimated_cost numeric,
  p_parent_job_id uuid default null
)
returns table (job_id uuid, used integer, quota integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg public.ai_settings;
  user_quota integer;
  used_count integer;
  new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('ai-quota:' || p_user_id::text, 0));

  select * into cfg from public.ai_settings where id;
  if not coalesce(cfg.integration_enabled, false) then
    raise exception 'AI_DISABLED' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.is_active) then
    raise exception 'USER_INACTIVE' using errcode = '42501';
  end if;

  if not exists (select 1 from public.ai_models m where m.id = p_model and m.is_enabled) then
    raise exception 'MODEL_DISABLED' using errcode = 'P0001';
  end if;

  select coalesce(l.max_requests, cfg.default_max_requests) into user_quota
  from (select 1) s left join public.ai_user_limits l on l.user_id = p_user_id;

  select count(*) into used_count
  from public.generation_jobs j
  where j.created_by = p_user_id
    and (
      j.status in ('pending', 'processing')
      or (j.status = 'completed' and j.created_at >= now() - make_interval(days => cfg.period_days))
    );

  if used_count >= user_quota then
    raise exception 'QUOTA_EXCEEDED' using errcode = 'P0001';
  end if;

  insert into public.generation_jobs (content_id, created_by, status, provider, model, prompt, settings,
    image_count, estimated_cost, parent_job_id)
  values (p_content_id, p_user_id, 'pending', p_provider, p_model, p_prompt, coalesce(p_settings, '{}'::jsonb),
    p_image_count, p_estimated_cost, p_parent_job_id)
  returning id into new_id;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_user_id, 'ai_generation.requested', 'generation_jobs', new_id,
    jsonb_build_object('model', p_model, 'content_id', p_content_id, 'image_count', p_image_count));

  return query select new_id, used_count + 1, user_quota;
end;
$$;

revoke all on function public.reserve_generation_job(uuid, uuid, text, text, text, jsonb, integer, numeric, uuid)
  from public, anon, authenticated;
grant execute on function public.reserve_generation_job(uuid, uuid, text, text, text, jsonb, integer, numeric, uuid)
  to service_role;

-- ---------------------------------------------------------------------------
-- Storage privado para imagens geradas e referências visuais
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('ai-generated', 'ai-generated', false, 20971520, array['image/png', 'image/jpeg', 'image/webp']),
  ('ai-references', 'ai-references', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Leitura segue a visibilidade do registro em media_assets (e, portanto, do conteúdo).
-- Escritas ocorrem apenas pelo backend; não há políticas de insert/update/delete para usuários.
create policy ai_buckets_select_by_media_asset
on storage.objects for select to authenticated
using (
  bucket_id in ('ai-generated', 'ai-references')
  and app_private.is_active_user()
  and exists (
    select 1 from public.media_assets m
    where m.bucket = storage.objects.bucket_id
      and m.storage_path = storage.objects.name
  )
);

commit;
