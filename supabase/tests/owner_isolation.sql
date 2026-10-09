-- Temporary test rows, no password/email/session. All changes roll back.
begin;
insert into auth.users(id) values ('00000000-0000-4000-8000-00000000000a'), ('00000000-0000-4000-8000-00000000000b');
insert into public.rn_workspaces(owner_id, data) values ('00000000-0000-4000-8000-00000000000b', '{"version":1,"roles":[],"orders":[],"settings":{}}');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000000a', true);
set local role authenticated;
select public.rn_save_workspace('{"version":1,"roles":[],"orders":[],"settings":{}}', 0) = 1 as first_save_ok;
select count(*) = 1 and bool_and(owner_id = auth.uid()) as owner_isolated from public.rn_workspaces;
select public.rn_save_workspace('{"version":1,"roles":[],"orders":[],"settings":{}}', 1) = 2 as revision_ok;
do $$
begin
  begin
    perform public.rn_save_workspace('{"version":1,"roles":[],"orders":[],"settings":{}}', 1);
    raise exception 'TEST_CONFLICT_NOT_REJECTED';
  exception when others then
    if sqlerrm not like 'RN_CONFLICT%' then raise; end if;
  end;
  begin
    insert into public.rn_workspaces(owner_id, data) values ('00000000-0000-4000-8000-00000000000b', '{"version":1}');
    raise exception 'TEST_OTHER_OWNER_INSERT_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
select c.relrowsecurity as rls_enabled,
       not has_table_privilege('anon', 'public.rn_workspaces', 'SELECT') as anonymous_denied,
       not b.public as storage_private,
       b.file_size_limit = 20971520 as file_limit_ok
from pg_class c join pg_namespace n on c.relnamespace = n.oid
cross join storage.buckets b
where n.nspname = 'public' and c.relname = 'rn_workspaces' and b.id = 'rn-files';
rollback;
