-- Behavioral tests execute as API roles. All fixtures and mutations are rolled back.
begin;
do $$
declare editor_id uuid := gen_random_uuid(); other_id uuid := gen_random_uuid(); admin_id uuid := gen_random_uuid();
begin
 perform set_config('test.editor',editor_id::text,true);
 perform set_config('test.other',other_id::text,true);
 perform set_config('test.admin',admin_id::text,true);
 insert into auth.users(id,email,raw_user_meta_data) values
 (editor_id,editor_id::text || '@example.invalid','{"full_name":"Editor de teste"}'),
 (other_id,other_id::text || '@example.invalid','{"full_name":"Outro editor"}'),
 (admin_id,admin_id::text || '@example.invalid','{"full_name":"Admin de teste"}');
 insert into public.user_roles(user_id,role) values(editor_id,'editor'),(other_id,'editor'),(admin_id,'admin');
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('test.editor'),true);
do $$
declare template_row public.templates; original_id uuid; copy_id uuid; rows_changed integer;
begin
 select * into template_row from public.templates where slug='newsletter-contabil';
 if template_row.id is null then raise exception 'Seed missing'; end if;
 insert into public.contents(title,category,created_by,template_id,editorial_details,collection_name)
 values('Newsletter de teste','accounting_newsletter',current_setting('test.other')::uuid,template_row.id,'{"image_url":"https://example.invalid/image.png"}','Teste transacional') returning id into original_id;
 perform set_config('test.content',original_id::text,true);
 if not exists(select 1 from public.contents where id=original_id and created_by=auth.uid() and layout_snapshot=template_row.configuration and status='draft') then raise exception 'Ownership or snapshot failed'; end if;
 copy_id := public.duplicate_content(original_id);
 if not exists(select 1 from public.contents where id=copy_id and id<>original_id and layout_snapshot=template_row.configuration and collection_name='Teste transacional' and status='draft') then raise exception 'Duplication failed'; end if;
 update public.contents set title='Cópia personalizada', layout_snapshot=jsonb_set(layout_snapshot,'{width}','900') where id=copy_id;
 if not exists(select 1 from public.contents where id=original_id and title='Newsletter de teste' and layout_snapshot=template_row.configuration) then raise exception 'Original was mutated'; end if;
 if not exists(select 1 from public.templates where id=template_row.id and configuration=template_row.configuration) then raise exception 'Template was mutated'; end if;
 begin
   update public.contents set status='approved' where id=original_id;
   raise exception 'Status write allowed';
 exception when insufficient_privilege then null; end;
 begin
   update public.templates set name='Unauthorized' where id=template_row.id;
   raise exception 'Template write allowed';
 exception when insufficient_privilege then null; end;
 update public.brand_settings set organization='Unauthorized';
 get diagnostics rows_changed=row_count;
 if rows_changed<>0 then raise exception 'Brand RLS failed'; end if;
 if exists(select 1 from public.audit_logs) then raise exception 'Audit leaked to editor'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
declare rows_changed integer;
begin
 if exists(select 1 from public.contents where id=current_setting('test.content')::uuid) then raise exception 'Other draft visible'; end if;
 update public.contents set title='Unauthorized' where id=current_setting('test.content')::uuid;
 get diagnostics rows_changed=row_count;
 if rows_changed<>0 then raise exception 'Other draft editable'; end if;
 begin
   perform public.duplicate_content(current_setting('test.content')::uuid);
   raise exception 'Invisible draft duplicated';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.admin'),true);
do $$
begin
 update public.brand_settings set footer_text='Assinatura de teste';
 if not exists(select 1 from public.audit_logs where actor_id=auth.uid() and action='brand.updated') then raise exception 'Brand audit missing'; end if;
 if (select count(*) from public.audit_logs where actor_id=current_setting('test.editor')::uuid and action like 'content.%') <> 3 then raise exception 'Content audit missing'; end if;
 update public.profiles set is_active=false where id=current_setting('test.other')::uuid;
end $$;
select set_config('request.jwt.claim.sub',current_setting('test.other'),true);
do $$
begin
 if exists(select 1 from public.templates) or exists(select 1 from public.brand_settings) then raise exception 'Inactive access allowed'; end if;
 begin perform public.duplicate_content(current_setting('test.content')::uuid); raise exception 'Inactive duplication allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$
begin
 begin perform * from public.brand_settings; raise exception 'Anonymous brand access allowed'; exception when insufficient_privilege then null; end;
 begin perform public.duplicate_content(gen_random_uuid()); raise exception 'Anonymous duplicate allowed'; exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
