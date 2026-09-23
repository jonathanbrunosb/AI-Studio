begin;

-- Keep PostgREST-facing RPCs in public as SECURITY INVOKER wrappers while the
-- privileged implementations live outside the exposed API schema.
alter function public.submit_content_for_review(uuid, uuid, text, timestamptz)
  set schema app_private;
alter function public.decide_content_review(uuid, uuid, text, text)
  set schema app_private;
alter function public.create_new_content_version(uuid)
  set schema app_private;
alter function public.archive_content(uuid, text)
  set schema app_private;
alter function public.list_eligible_reviewers(uuid)
  set schema app_private;
alter function public.transition_publication(uuid, text, text, timestamptz, text, text, text)
  set schema app_private;

create function public.submit_content_for_review(
  p_content_id uuid,
  p_reviewer_id uuid default null,
  p_comment text default null,
  p_expected_working_updated_at timestamptz default null
)
returns uuid
language sql
security invoker
set search_path = ''
as $$
  select app_private.submit_content_for_review(
    p_content_id,
    p_reviewer_id,
    p_comment,
    p_expected_working_updated_at
  );
$$;

create function public.decide_content_review(
  p_content_id uuid,
  p_version_id uuid,
  p_decision text,
  p_comment text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.decide_content_review(
    p_content_id,
    p_version_id,
    p_decision,
    p_comment
  );
$$;

create function public.create_new_content_version(p_content_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.create_new_content_version(p_content_id);
$$;

create function public.archive_content(
  p_content_id uuid,
  p_reason text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select app_private.archive_content(p_content_id, p_reason);
$$;

create function public.list_eligible_reviewers(p_content_id uuid)
returns table (id uuid, full_name text, email text)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from app_private.list_eligible_reviewers(p_content_id);
$$;

create function public.transition_publication(
  p_publication_id uuid,
  p_action text,
  p_channel text default null,
  p_published_at timestamptz default null,
  p_external_id text default null,
  p_external_url text default null,
  p_message text default null
)
returns text
language sql
security invoker
set search_path = ''
as $$
  select app_private.transition_publication(
    p_publication_id,
    p_action,
    p_channel,
    p_published_at,
    p_external_id,
    p_external_url,
    p_message
  );
$$;

-- The wrappers can reach only the exact private implementations they need.
grant usage on schema app_private to authenticated, service_role;

revoke all on function app_private.submit_content_for_review(uuid, uuid, text, timestamptz) from public, anon;
revoke all on function app_private.decide_content_review(uuid, uuid, text, text) from public, anon;
revoke all on function app_private.create_new_content_version(uuid) from public, anon;
revoke all on function app_private.archive_content(uuid, text) from public, anon;
revoke all on function app_private.list_eligible_reviewers(uuid) from public, anon;
revoke all on function app_private.transition_publication(uuid, text, text, timestamptz, text, text, text) from public, anon;

grant execute on function app_private.submit_content_for_review(uuid, uuid, text, timestamptz) to authenticated, service_role;
grant execute on function app_private.decide_content_review(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function app_private.create_new_content_version(uuid) to authenticated, service_role;
grant execute on function app_private.archive_content(uuid, text) to authenticated, service_role;
grant execute on function app_private.list_eligible_reviewers(uuid) to authenticated, service_role;
grant execute on function app_private.transition_publication(uuid, text, text, timestamptz, text, text, text) to authenticated, service_role;

revoke all on function public.submit_content_for_review(uuid, uuid, text, timestamptz) from public, anon;
revoke all on function public.decide_content_review(uuid, uuid, text, text) from public, anon;
revoke all on function public.create_new_content_version(uuid) from public, anon;
revoke all on function public.archive_content(uuid, text) from public, anon;
revoke all on function public.list_eligible_reviewers(uuid) from public, anon;
revoke all on function public.transition_publication(uuid, text, text, timestamptz, text, text, text) from public, anon;

grant execute on function public.submit_content_for_review(uuid, uuid, text, timestamptz) to authenticated, service_role;
grant execute on function public.decide_content_review(uuid, uuid, text, text) to authenticated, service_role;
grant execute on function public.create_new_content_version(uuid) to authenticated, service_role;
grant execute on function public.archive_content(uuid, text) to authenticated, service_role;
grant execute on function public.list_eligible_reviewers(uuid) to authenticated, service_role;
grant execute on function public.transition_publication(uuid, text, text, timestamptz, text, text, text) to authenticated, service_role;

commit;
