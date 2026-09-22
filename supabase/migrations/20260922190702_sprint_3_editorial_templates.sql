begin;
alter table public.templates add column category text check (category in ('internal_communication','accounting_newsletter','system_announcement','internal_campaign'));
alter table public.templates add column slug text unique;
alter table public.contents add column editorial_details jsonb not null default '{}'::jsonb check (jsonb_typeof(editorial_details) = 'object' and octet_length(editorial_details::text) <= 16000);
alter table public.contents add column layout_snapshot jsonb not null default '{}'::jsonb check (jsonb_typeof(layout_snapshot) = 'object' and octet_length(layout_snapshot::text) <= 8000);
alter table public.contents add column collection_name text not null default '' check (char_length(collection_name) <= 100);
create index contents_owner_collection_idx on public.contents(created_by, collection_name);
create table public.brand_settings (
 id boolean primary key default true check (id),
 organization text not null check (char_length(organization) between 2 and 120),
 primary_color text not null check (primary_color ~ '^#[0-9a-fA-F]{6}$'),
 accent_color text not null check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
 font_family text not null default 'Calibri' check (font_family in ('Calibri','Segoe UI','Arial')),
 logo_url text not null default '' check (logo_url = '' or logo_url ~ '^https?://'),
 footer_text text not null default '' check (char_length(footer_text) <= 200),
 updated_at timestamptz not null default now()
);
alter table public.brand_settings enable row level security;
revoke all on public.brand_settings from anon, authenticated;
grant select on public.brand_settings to authenticated;
grant update (organization,primary_color,accent_color,font_family,logo_url,footer_text) on public.brand_settings to authenticated;
grant all on public.brand_settings to service_role;
create policy brand_read on public.brand_settings for select to authenticated using ((select app_private.is_active_user()));
create policy brand_admin_update on public.brand_settings for update to authenticated using ((select app_private.has_role('admin'))) with check ((select app_private.has_role('admin')));
create trigger brand_updated before update on public.brand_settings for each row execute function app_private.set_updated_at();
insert into public.brand_settings(organization,primary_color,accent_color,footer_text) values ('Gerência de Contabilidade','#0b2b50','#1769aa','Comunicação Contábil · AI Studio');

insert into public.templates(slug,name,description,category,configuration) values
('comunicado-corporativo','Comunicado Corporativo','Mensagem objetiva, imagem de apoio e assinatura institucional.','internal_communication','{"layout":"notice","width":1080,"height":1080,"show_image":true,"show_footer":true,"alignment":"left"}'),
('newsletter-contabil','Newsletter Contábil','Edição vertical com resumo, fonte e data da notícia.','accounting_newsletter','{"layout":"newsletter","width":1080,"height":1600,"show_image":true,"show_footer":true,"alignment":"left"}'),
('divulgacao-sistemas','Divulgação de Sistemas','Composição horizontal para apresentar soluções e atualizações.','system_announcement','{"layout":"system","width":1200,"height":800,"show_image":true,"show_footer":true,"alignment":"left"}'),
('campanha-interna','Campanha Interna','Destaque visual, público-alvo e chamada para participação.','internal_campaign','{"layout":"campaign","width":1080,"height":1350,"show_image":true,"show_footer":true,"alignment":"center"}');

-- Snapshot initialization is trusted; subsequent changes belong only to the content instance.
create function app_private.initialize_content_template() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare selected_template public.templates;
begin
 if tg_op = 'UPDATE' then
   if new.template_id is distinct from old.template_id or new.category is distinct from old.category then
     raise exception 'Template and category cannot be reassigned after creation.' using errcode='42501';
   end if;
 elsif new.template_id is not null then
   select * into selected_template from public.templates where id = new.template_id and is_active;
   if not found or selected_template.category is distinct from new.category then
     raise exception 'Template unavailable or incompatible with category.' using errcode='23514';
   end if;
   if new.layout_snapshot = '{}'::jsonb then new.layout_snapshot := selected_template.configuration; end if;
 end if;
 if new.layout_snapshot <> '{}'::jsonb and not (
    new.layout_snapshot ?& array['layout','width','height','show_image','show_footer','alignment']
    and new.layout_snapshot->>'layout' in ('notice','newsletter','system','campaign')
    and (new.layout_snapshot->>'width')::integer between 600 and 2400
    and (new.layout_snapshot->>'height')::integer between 600 and 3200
    and jsonb_typeof(new.layout_snapshot->'show_image') = 'boolean'
    and jsonb_typeof(new.layout_snapshot->'show_footer') = 'boolean'
    and new.layout_snapshot->>'alignment' in ('left','center')
 ) then raise exception 'Invalid layout.' using errcode='23514'; end if;
 return new;
end; $$;
revoke all on function app_private.initialize_content_template() from public,anon,authenticated;
create trigger contents_template_snapshot before insert or update on public.contents for each row execute function app_private.initialize_content_template();

-- Invoker preserves all RLS checks; source visibility and destination ownership are independent.
create function public.duplicate_content(source_id uuid) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare source public.contents; result_id uuid;
begin
 if not (app_private.has_role('editor') or app_private.has_role('admin')) then
   raise exception 'Editorial access required.' using errcode='42501';
 end if;
 select * into source from public.contents where id=source_id;
 if not found then raise exception 'Content unavailable.' using errcode='42501'; end if;
 insert into public.contents(title,subtitle,description,category,created_by,template_id,reference_date,source_name,source_url,editorial_details,layout_snapshot,collection_name)
 values (left(source.title,190) || ' — cópia',source.subtitle,source.description,source.category,auth.uid(),source.template_id,source.reference_date,source.source_name,source.source_url,source.editorial_details,source.layout_snapshot,source.collection_name)
 returning id into result_id;
 return result_id;
end; $$;
revoke all on function public.duplicate_content(uuid) from public,anon;
grant execute on function public.duplicate_content(uuid) to authenticated;
create function app_private.audit_brand_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 insert into public.audit_logs(actor_id,action,entity_type,metadata)
 values(auth.uid(),'brand.updated','brand_settings','{}'::jsonb);
 return new;
end; $$;
revoke all on function app_private.audit_brand_update() from public,anon,authenticated;
create trigger brand_audit after update on public.brand_settings for each row execute function app_private.audit_brand_update();
-- Limit editorial writes to actual editable columns. Status/owner protections also remain in triggers.
revoke update on public.contents from authenticated;
grant update(title,subtitle,description,reference_date,source_name,source_url,editorial_details,layout_snapshot,collection_name) on public.contents to authenticated;
commit;
