-- Sprint 7: Central de Publicações, destinos do Portal da Contabilidade,
-- pacotes estruturados, API de integração e confirmação de publicação.
-- O status editorial (contents.status) e o status de publicação
-- (publication_exports.status) são independentes.
begin;

-- ---------------------------------------------------------------------------
-- Destinos do portal e mapeamento por categoria (configuração institucional)
-- ---------------------------------------------------------------------------
create table public.portal_destinations (
  id text primary key check (id ~ '^[a-z][a-z0-9_]{2,40}$'),
  label text not null check (char_length(label) between 3 and 120),
  portal_collection text not null check (portal_collection in ('newsletter', 'noticias')),
  portal_category text not null check (char_length(portal_category) between 2 and 80),
  enabled boolean not null default true,
  notes text check (notes is null or char_length(notes) <= 500),
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.content_category_destinations (
  category text not null check (category in ('internal_communication', 'accounting_newsletter', 'system_announcement', 'internal_campaign')),
  destination_id text not null references public.portal_destinations(id) on delete cascade,
  is_default boolean not null default false,
  primary key (category, destination_id)
);
create unique index content_category_one_default on public.content_category_destinations (category) where is_default;

-- Destinos que existem hoje no portal (inspecionado: Central de Conteúdo → Newsletter Contábil,
-- com a categoria "Comunicado Interno"; não há módulo próprio de comunicados nem de anúncios de sistemas).
insert into public.portal_destinations (id, label, portal_collection, portal_category, notes) values
  ('newsletter_contabil', 'Central de Conteúdo → Newsletter Contábil', 'newsletter', 'CPC / IFRS', 'Categoria do portal ajustável na importação.'),
  ('comunicados_internos', 'Central de Conteúdo → Newsletter (Comunicado Interno)', 'newsletter', 'Comunicado Interno', 'O portal não possui aba própria de Comunicados Internos; usa a categoria "Comunicado Interno" da Newsletter.'),
  ('divulgacao_sistemas', 'Central de Conteúdo → Newsletter (Tecnologia)', 'newsletter', 'Tecnologia', 'Sistemas da Área é um catálogo de acessos, não recebe anúncios. Evolução do portal registrada na documentação.');

insert into public.content_category_destinations (category, destination_id, is_default) values
  ('accounting_newsletter', 'newsletter_contabil', true),
  ('internal_communication', 'comunicados_internos', true),
  ('internal_campaign', 'comunicados_internos', true),
  ('system_announcement', 'divulgacao_sistemas', true),
  ('system_announcement', 'comunicados_internos', false);

-- ---------------------------------------------------------------------------
-- Configuração da integração (singleton) e clientes da API
-- ---------------------------------------------------------------------------
create table public.portal_integration_settings (
  id boolean primary key default true check (id),
  api_enabled boolean not null default false,
  require_signature boolean not null default true,
  last_sync_at timestamptz,
  last_error_at timestamptz,
  last_error text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
insert into public.portal_integration_settings (id) values (true);

create table public.integration_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 80),
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  token_prefix text not null check (char_length(token_prefix) between 4 and 16),
  scopes text[] not null default array['publications:read', 'publications:ack'],
  enabled boolean not null default true,
  last_used_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

-- ---------------------------------------------------------------------------
-- publication_exports: registro de cada operação de disponibilização
-- ---------------------------------------------------------------------------
alter table public.publication_exports
  add column version_id uuid references public.content_versions(id) on delete restrict,
  add column destination text references public.portal_destinations(id) on delete restrict,
  add column status text not null default 'prepared'
    check (status in ('prepared', 'exported', 'received', 'pending_publication', 'published', 'failed', 'superseded')),
  add column manifest jsonb,
  add column manifest_sha256 text check (manifest_sha256 is null or manifest_sha256 ~ '^[0-9a-f]{64}$'),
  add column image_sha256 text check (image_sha256 is null or image_sha256 ~ '^[0-9a-f]{64}$'),
  add column package_sha256 text check (package_sha256 is null or package_sha256 ~ '^[0-9a-f]{64}$'),
  add column image_path text,
  add column signed boolean not null default false,
  add column prepared_at timestamptz,
  add column exported_by uuid references public.profiles(id) on delete set null,
  add column exported_at timestamptz,
  add column received_at timestamptz,
  add column external_publication_id text check (external_publication_id is null or char_length(external_publication_id) <= 200),
  add column external_url text check (external_url is null or external_url ~* '^https?://'),
  add column published_channel text check (published_channel is null or char_length(published_channel) <= 120),
  add column published_at timestamptz,
  add column confirmed_by uuid references public.profiles(id) on delete set null,
  add column confirmation_source text check (confirmation_source is null or confirmation_source in ('manual', 'portal_api')),
  add column error_message text check (error_message is null or char_length(error_message) <= 1000),
  add column supersedes_id uuid references public.publication_exports(id) on delete set null,
  add column superseded_by_id uuid references public.publication_exports(id) on delete set null,
  add column updated_at timestamptz not null default now();

comment on column public.publication_exports.created_by is 'Usuário que preparou o pacote.';
comment on column public.publication_exports.storage_path is 'Pacote ZIP no bucket privado publication-packages.';

-- Uma publicação ativa por versão aprovada e destino: evita envios duplicados.
create unique index publication_exports_one_active
  on public.publication_exports (version_id, destination)
  where status not in ('failed', 'superseded');
create index publication_exports_status_idx on public.publication_exports (status, updated_at desc);
create index publication_exports_content_created_idx on public.publication_exports (content_id, created_at desc);

create table public.publication_events (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.publication_exports(id) on delete cascade,
  content_id uuid not null references public.contents(id) on delete cascade,
  event text not null check (event in ('prepared', 'repackaged', 'exported', 'received', 'pending_publication', 'published', 'failed', 'retry', 'superseded', 'duplicate_ack')),
  from_status text,
  to_status text,
  actor_id uuid references public.profiles(id) on delete set null,
  client_id uuid references public.integration_clients(id) on delete set null,
  source text not null check (source in ('user', 'portal_api', 'system')),
  details jsonb not null default '{}'::jsonb check (octet_length(details::text) <= 4000),
  created_at timestamptz not null default now()
);
create index publication_events_publication_idx on public.publication_events (publication_id, created_at);
create index publication_events_failed_idx on public.publication_events (created_at desc) where event = 'failed';

-- Visão da publicação mais recente por conteúdo (respeita RLS de quem consulta).
create view public.publication_latest with (security_invoker = true) as
select distinct on (p.content_id) p.*
from public.publication_exports p
order by p.content_id, p.created_at desc;

-- ---------------------------------------------------------------------------
-- RLS e grants
-- ---------------------------------------------------------------------------
alter table public.portal_destinations enable row level security;
alter table public.content_category_destinations enable row level security;
alter table public.portal_integration_settings enable row level security;
alter table public.integration_clients enable row level security;
alter table public.publication_events enable row level security;

create policy portal_destinations_select on public.portal_destinations for select to authenticated using (app_private.is_active_user());
create policy portal_destinations_admin on public.portal_destinations for all to authenticated
  using (app_private.has_role('admin')) with check (app_private.has_role('admin'));
create policy category_destinations_select on public.content_category_destinations for select to authenticated using (app_private.is_active_user());
create policy category_destinations_admin on public.content_category_destinations for all to authenticated
  using (app_private.has_role('admin')) with check (app_private.has_role('admin'));
create policy integration_settings_select on public.portal_integration_settings for select to authenticated using (app_private.has_role('admin'));
create policy integration_settings_admin on public.portal_integration_settings for update to authenticated
  using (app_private.has_role('admin')) with check (app_private.has_role('admin'));
create policy integration_clients_admin_select on public.integration_clients for select to authenticated using (app_private.has_role('admin'));
create policy integration_clients_admin_update on public.integration_clients for update to authenticated
  using (app_private.has_role('admin')) with check (app_private.has_role('admin'));
create policy publication_events_select on public.publication_events for select to authenticated using (app_private.can_view_content(content_id));

grant select, insert, update, delete on public.portal_destinations, public.content_category_destinations to authenticated;
grant select, update (api_enabled, require_signature, updated_by) on public.portal_integration_settings to authenticated;
-- Hash e prefixo nunca são alterados pelo usuário; revogação apenas.
grant select (id, name, token_prefix, scopes, enabled, last_used_at, created_by, created_at, revoked_at) on public.integration_clients to authenticated;
grant update (enabled, revoked_at) on public.integration_clients to authenticated;
grant select on public.publication_events to authenticated;
grant select on public.publication_latest to authenticated;
grant all on public.portal_destinations, public.content_category_destinations, public.portal_integration_settings,
  public.integration_clients, public.publication_events, public.publication_latest to service_role;

create trigger portal_destinations_updated before update on public.portal_destinations
for each row execute function app_private.set_updated_at();
create trigger portal_integration_settings_updated before update on public.portal_integration_settings
for each row execute function app_private.set_updated_at();
create trigger publication_exports_updated before update on public.publication_exports
for each row execute function app_private.set_updated_at();

create or replace function app_private.audit_integration_config()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values ((select auth.uid()), 'integration.' || tg_table_name || '.' || lower(tg_op), tg_table_name, null,
    case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end - 'token_hash');
  if tg_op = 'DELETE' then return old; end if;
  return new;
end; $$;
revoke all on function app_private.audit_integration_config() from public, anon, authenticated;
create trigger portal_destinations_audit after insert or update or delete on public.portal_destinations
for each row execute function app_private.audit_integration_config();
create trigger category_destinations_audit after insert or update or delete on public.content_category_destinations
for each row execute function app_private.audit_integration_config();
create trigger integration_settings_audit after update on public.portal_integration_settings
for each row execute function app_private.audit_integration_config();
create trigger integration_clients_audit after insert or update on public.integration_clients
for each row execute function app_private.audit_integration_config();

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------
create or replace function app_private.user_has_role(p_user uuid, p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = p_user and p.is_active)
     and exists (select 1 from public.user_roles r where r.user_id = p_user and r.role = p_role);
$$;
revoke all on function app_private.user_has_role(uuid, text) from public, anon, authenticated;

create or replace function app_private.log_publication_event(
  p_publication public.publication_exports, p_event text, p_from text, p_to text,
  p_actor uuid, p_client uuid, p_source text, p_details jsonb
) returns void language sql security definer set search_path = '' as $$
  insert into public.publication_events (publication_id, content_id, event, from_status, to_status, actor_id, client_id, source, details)
  values (p_publication.id, p_publication.content_id, p_event, p_from, p_to, p_actor, p_client, p_source, coalesce(p_details, '{}'::jsonb));
$$;
revoke all on function app_private.log_publication_event(public.publication_exports, text, text, text, uuid, uuid, text, jsonb) from public, anon, authenticated;

-- Confirma a publicação: marca substituição da publicação anterior e o status editorial.
create or replace function app_private.apply_published(p_pub public.publication_exports)
returns void language plpgsql security definer set search_path = '' as $$
declare
  previous public.publication_exports;
begin
  for previous in
    select * from public.publication_exports
    where content_id = p_pub.content_id and id <> p_pub.id and status = 'published'
    for update
  loop
    update public.publication_exports set status = 'superseded', superseded_by_id = p_pub.id where id = previous.id;
    perform app_private.log_publication_event(previous, 'superseded', 'published', 'superseded', null, null, 'system',
      jsonb_build_object('superseded_by', p_pub.id));
  end loop;
  perform set_config('app.editorial_transition', 'on', true);
  update public.contents set status = 'published'
  where id = p_pub.content_id and status = 'approved' and approved_version_id = p_pub.version_id;
end; $$;
revoke all on function app_private.apply_published(public.publication_exports) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Preparação (somente backend: o pacote e os hashes são gerados no servidor)
-- ---------------------------------------------------------------------------
create or replace function public.register_publication_package(
  p_publication_id uuid,
  p_actor uuid,
  p_content_id uuid,
  p_version_id uuid,
  p_destination text,
  p_manifest jsonb,
  p_manifest_sha256 text,
  p_image_sha256 text,
  p_package_sha256 text,
  p_package_path text,
  p_image_path text,
  p_signed boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.contents;
  existing public.publication_exports;
  previous_published uuid;
  new_id uuid;
begin
  if not (app_private.user_has_role(p_actor, 'admin') or app_private.user_has_role(p_actor, 'editor')) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('publication:' || p_content_id::text, 0));
  select * into c from public.contents where id = p_content_id for update;
  if not found then raise exception 'CONTENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not app_private.user_has_role(p_actor, 'admin') and c.created_by <> p_actor then
    raise exception 'NOT_OWNER' using errcode = '42501';
  end if;
  if c.status = 'archived' then raise exception 'CONTENT_ARCHIVED' using errcode = 'P0001'; end if;
  if c.approved_version_id is null then raise exception 'NOT_APPROVED' using errcode = 'P0001'; end if;
  if c.approved_version_id <> p_version_id then raise exception 'VERSION_NOT_CURRENT' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.content_versions v where v.id = p_version_id and v.content_id = c.id and v.version_kind = 'frozen') then
    raise exception 'VERSION_INVALID' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.content_category_destinations m join public.portal_destinations d on d.id = m.destination_id
    where m.category = c.category and d.id = p_destination and d.enabled
  ) then
    raise exception 'INVALID_DESTINATION' using errcode = 'P0001';
  end if;

  select * into existing from public.publication_exports
  where version_id = p_version_id and destination = p_destination and status not in ('failed', 'superseded')
  for update;

  if found then
    if existing.status in ('received', 'pending_publication', 'published') then
      raise exception 'ALREADY_IN_PORTAL' using errcode = 'P0001';
    end if;
    if existing.id <> p_publication_id then raise exception 'CONFLICT_RETRY' using errcode = 'P0001'; end if;
    update public.publication_exports set
      manifest = p_manifest, manifest_sha256 = p_manifest_sha256, image_sha256 = p_image_sha256,
      package_sha256 = p_package_sha256, storage_path = p_package_path, image_path = p_image_path,
      signed = p_signed, status = 'prepared', prepared_at = now(), error_message = null
    where id = existing.id;
    perform app_private.log_publication_event(existing, 'repackaged', existing.status, 'prepared', p_actor, null, 'user',
      jsonb_build_object('package_sha256', p_package_sha256));
    return existing.id;
  end if;

  select id into previous_published from public.publication_exports
  where content_id = c.id and status = 'published' order by published_at desc nulls last limit 1;

  insert into public.publication_exports (id, content_id, format, storage_path, created_by, version_id, destination, status,
    manifest, manifest_sha256, image_sha256, package_sha256, image_path, signed, prepared_at, supersedes_id)
  values (p_publication_id, c.id, 'zip', p_package_path, p_actor, p_version_id, p_destination, 'prepared',
    p_manifest, p_manifest_sha256, p_image_sha256, p_package_sha256, p_image_path, p_signed, now(), previous_published)
  returning id into new_id;

  insert into public.publication_events (publication_id, content_id, event, from_status, to_status, actor_id, source, details)
  values (new_id, c.id, 'prepared', null, 'prepared', p_actor, 'user',
    jsonb_build_object('destination', p_destination, 'version_id', p_version_id, 'supersedes', previous_published, 'signed', p_signed));
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, 'publication.prepared', 'publication_exports', new_id, jsonb_build_object('content_id', c.id, 'version_id', p_version_id));
  return new_id;
end;
$$;
revoke all on function public.register_publication_package(uuid, uuid, uuid, uuid, text, jsonb, text, text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.register_publication_package(uuid, uuid, uuid, uuid, text, jsonb, text, text, text, text, text, boolean) to service_role;

-- ---------------------------------------------------------------------------
-- Transições por usuários autenticados
-- ---------------------------------------------------------------------------
create or replace function public.transition_publication(
  p_publication_id uuid,
  p_action text,
  p_channel text default null,
  p_published_at timestamptz default null,
  p_external_id text default null,
  p_external_url text default null,
  p_message text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  p public.publication_exports;
  c public.contents;
  previous_status text;
begin
  if actor is null or not app_private.is_active_user() then raise exception 'NOT_AUTHENTICATED' using errcode = '42501'; end if;
  select * into p from public.publication_exports where id = p_publication_id for update;
  if not found then raise exception 'PUBLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  select * into c from public.contents where id = p.content_id;
  if not app_private.can_view_content(c.id) then raise exception 'PUBLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  previous_status := p.status;

  if p_action = 'exported' then
    if not (app_private.has_role('admin') or (app_private.has_role('editor') and c.created_by = actor)) then
      raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
    end if;
    if p.status not in ('prepared', 'exported') then return p.status; end if;
    update public.publication_exports set status = 'exported', exported_by = actor, exported_at = coalesce(exported_at, now()) where id = p.id;
    if p.status = 'prepared' then
      perform app_private.log_publication_event(p, 'exported', p.status, 'exported', actor, null, 'user', '{}');
    end if;
    return 'exported';
  end if;

  if not app_private.has_role('admin') then raise exception 'FORBIDDEN_ROLE' using errcode = '42501'; end if;

  if p_action = 'confirm_published' then
    if p.status = 'published' then return 'published'; end if;
    if p.status not in ('prepared', 'exported', 'received', 'pending_publication') then raise exception 'STATE_CHANGED' using errcode = 'P0001'; end if;
    if c.approved_version_id is distinct from p.version_id and not exists (
      select 1 from public.content_versions v where v.id = p.version_id and v.version_kind = 'frozen'
    ) then raise exception 'VERSION_INVALID' using errcode = 'P0001'; end if;
    if char_length(trim(coalesce(p_channel, ''))) < 3 or p_published_at is null then
      raise exception 'CONFIRMATION_DATA_REQUIRED' using errcode = 'P0001';
    end if;
    if p_published_at > now() + interval '1 day' then raise exception 'INVALID_DATE' using errcode = 'P0001'; end if;
    update public.publication_exports set status = 'published', published_at = p_published_at, published_channel = trim(p_channel),
      external_publication_id = nullif(trim(p_external_id), ''), external_url = nullif(trim(p_external_url), ''),
      confirmed_by = actor, confirmation_source = 'manual', error_message = null
    where id = p.id returning * into p;
    perform app_private.log_publication_event(p, 'published', previous_status, 'published', actor, null, 'user',
      jsonb_build_object('channel', trim(p_channel), 'external_id', p_external_id, 'external_url', p_external_url, 'published_at', p_published_at));
    perform app_private.apply_published(p);
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (actor, 'publication.confirmed', 'publication_exports', p.id, jsonb_build_object('content_id', p.content_id, 'source', 'manual'));
    return 'published';
  end if;

  if p_action = 'mark_pending' then
    if p.status not in ('exported', 'received') then raise exception 'STATE_CHANGED' using errcode = 'P0001'; end if;
    update public.publication_exports set status = 'pending_publication', received_at = coalesce(received_at, now()) where id = p.id;
    perform app_private.log_publication_event(p, 'pending_publication', p.status, 'pending_publication', actor, null, 'user',
      jsonb_build_object('note', left(p_message, 500)));
    return 'pending_publication';
  end if;

  if p_action = 'fail' then
    if p.status in ('published', 'superseded', 'failed') then raise exception 'STATE_CHANGED' using errcode = 'P0001'; end if;
    if char_length(trim(coalesce(p_message, ''))) < 5 then raise exception 'MESSAGE_REQUIRED' using errcode = 'P0001'; end if;
    update public.publication_exports set status = 'failed', error_message = left(trim(p_message), 1000) where id = p.id;
    perform app_private.log_publication_event(p, 'failed', p.status, 'failed', actor, null, 'user', jsonb_build_object('message', left(trim(p_message), 500)));
    update public.portal_integration_settings set last_error_at = now(), last_error = left(trim(p_message), 500);
    return 'failed';
  end if;

  if p_action = 'retry' then
    if p.status <> 'failed' then raise exception 'STATE_CHANGED' using errcode = 'P0001'; end if;
    if exists (select 1 from public.publication_exports o where o.version_id = p.version_id and o.destination = p.destination
               and o.status not in ('failed', 'superseded')) then
      raise exception 'ALREADY_ACTIVE' using errcode = 'P0001';
    end if;
    if c.approved_version_id is distinct from p.version_id then raise exception 'VERSION_NOT_CURRENT' using errcode = 'P0001'; end if;
    update public.publication_exports set status = 'prepared', error_message = null where id = p.id;
    perform app_private.log_publication_event(p, 'retry', 'failed', 'prepared', actor, null, 'user', '{}');
    return 'prepared';
  end if;

  raise exception 'INVALID_ACTION' using errcode = 'P0001';
end;
$$;
revoke all on function public.transition_publication(uuid, text, text, timestamptz, text, text, text) from public, anon;
grant execute on function public.transition_publication(uuid, text, text, timestamptz, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Confirmação pelo portal (API autenticada; somente backend)
-- Idempotente: repetições não duplicam nem alteram a confirmação original.
-- ---------------------------------------------------------------------------
create or replace function public.portal_acknowledge_publication(
  p_client_id uuid,
  p_publication_id uuid,
  p_content_id uuid,
  p_version_id uuid,
  p_status text,
  p_external_id text,
  p_external_url text,
  p_published_at timestamptz,
  p_message text
)
returns table (status text, duplicate boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  p public.publication_exports;
  rank_current integer;
  rank_target integer;
  ranks constant jsonb := '{"prepared":1,"exported":2,"received":3,"pending_publication":4,"published":5}';
begin
  if not exists (select 1 from public.integration_clients ic where ic.id = p_client_id and ic.enabled and ic.revoked_at is null
                 and 'publications:ack' = any(ic.scopes)) then
    raise exception 'CLIENT_FORBIDDEN' using errcode = '42501';
  end if;
  if p_status not in ('received', 'pending_publication', 'published', 'failed') then raise exception 'INVALID_STATUS' using errcode = 'P0001'; end if;
  select * into p from public.publication_exports where id = p_publication_id for update;
  if not found or p.content_id <> p_content_id or p.version_id <> p_version_id then
    raise exception 'PUBLICATION_MISMATCH' using errcode = 'P0001';
  end if;
  if p.status in ('superseded') then raise exception 'PUBLICATION_SUPERSEDED' using errcode = 'P0001'; end if;

  if p.status = 'published' then
    perform app_private.log_publication_event(p, 'duplicate_ack', p.status, p.status, null, p_client_id, 'portal_api',
      jsonb_build_object('requested', p_status, 'external_id', p_external_id));
    return query select p.status, true;
    return;
  end if;

  if p_status = 'failed' then
    update public.publication_exports set status = 'failed', error_message = left(coalesce(p_message, 'Falha informada pelo portal.'), 1000) where id = p.id;
    perform app_private.log_publication_event(p, 'failed', p.status, 'failed', null, p_client_id, 'portal_api', jsonb_build_object('message', left(p_message, 500)));
    update public.portal_integration_settings set last_error_at = now(), last_error = left(coalesce(p_message, 'Falha informada pelo portal.'), 500);
    return query select 'failed'::text, false;
    return;
  end if;

  rank_current := coalesce((ranks ->> p.status)::integer, 0);
  rank_target := (ranks ->> p_status)::integer;
  if rank_current >= rank_target then
    perform app_private.log_publication_event(p, 'duplicate_ack', p.status, p.status, null, p_client_id, 'portal_api', jsonb_build_object('requested', p_status));
    return query select p.status, true;
    return;
  end if;
  if p.status = 'failed' then raise exception 'PUBLICATION_FAILED' using errcode = 'P0001'; end if;

  if p_status = 'published' then
    if p_published_at is null then raise exception 'CONFIRMATION_DATA_REQUIRED' using errcode = 'P0001'; end if;
    update public.publication_exports set status = 'published', published_at = p_published_at, published_channel = 'Portal da Contabilidade (API)',
      external_publication_id = nullif(trim(p_external_id), ''), external_url = nullif(trim(p_external_url), ''),
      confirmation_source = 'portal_api', received_at = coalesce(received_at, now()), error_message = null
    where id = p.id returning * into p;
    perform app_private.log_publication_event(p, 'published', 'received', 'published', null, p_client_id, 'portal_api',
      jsonb_build_object('external_id', p_external_id, 'external_url', p_external_url));
    perform app_private.apply_published(p);
  else
    update public.publication_exports set status = p_status, received_at = coalesce(received_at, now()),
      external_publication_id = coalesce(nullif(trim(p_external_id), ''), external_publication_id)
    where id = p.id;
    perform app_private.log_publication_event(p, p_status, p.status, p_status, null, p_client_id, 'portal_api', jsonb_build_object('external_id', p_external_id));
  end if;
  update public.portal_integration_settings set last_sync_at = now();
  update public.integration_clients set last_used_at = now() where id = p_client_id;
  return query select p_status, false;
end;
$$;
revoke all on function public.portal_acknowledge_publication(uuid, uuid, uuid, uuid, text, text, text, timestamptz, text) from public, anon, authenticated;
grant execute on function public.portal_acknowledge_publication(uuid, uuid, uuid, uuid, text, text, text, timestamptz, text) to service_role;

-- ---------------------------------------------------------------------------
-- Nova versão também a partir de conteúdo publicado (a publicação anterior é preservada)
-- ---------------------------------------------------------------------------
create or replace function public.create_new_content_version(p_content_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  c public.contents;
begin
  if actor is null or not app_private.is_active_user()
     or not (app_private.has_role('editor') or app_private.has_role('admin')) then
    raise exception 'FORBIDDEN_ROLE' using errcode = '42501';
  end if;
  select * into c from public.contents where id = p_content_id for update;
  if not found then raise exception 'CONTENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if c.created_by <> actor and not app_private.has_role('admin') then raise exception 'NOT_OWNER' using errcode = '42501'; end if;
  if c.status not in ('approved', 'published') then raise exception 'STATE_CHANGED' using errcode = 'P0001'; end if;

  perform set_config('app.editorial_transition', 'on', true);
  update public.contents set status = 'draft', assigned_reviewer_id = null where id = c.id;

  insert into public.approval_events (content_id, actor_id, action, comment, version_id, from_status, to_status, cycle)
  values (c.id, actor, 'new_version', 'Nova versão de trabalho criada a partir da versão aprovada.', c.approved_version_id, c.status, 'draft', c.review_cycle);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (actor, 'editorial.new_version', 'contents', c.id, jsonb_build_object('approved_version_id', c.approved_version_id, 'from_status', c.status));
end;
$$;

-- ---------------------------------------------------------------------------
-- Storage privado dos pacotes (acesso somente pelo backend)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('publication-packages', 'publication-packages', false, 52428800, array['application/zip', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

commit;
