-- RN GROUP: one private workspace per authenticated owner.
begin;
create table if not exists public.rn_workspaces (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null check (jsonb_typeof(data) = 'object' and data->>'version' = '1' and octet_length(data::text) < 8388608),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);
alter table public.rn_workspaces enable row level security;
revoke all on public.rn_workspaces from anon;
grant select, insert, update on public.rn_workspaces to authenticated;
drop policy if exists "rn_owner_select" on public.rn_workspaces;
create policy "rn_owner_select" on public.rn_workspaces for select to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "rn_owner_insert" on public.rn_workspaces;
create policy "rn_owner_insert" on public.rn_workspaces for insert to authenticated with check (owner_id = (select auth.uid()));
drop policy if exists "rn_owner_update" on public.rn_workspaces;
create policy "rn_owner_update" on public.rn_workspaces for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create or replace function public.rn_save_workspace(snapshot jsonb, expected_revision bigint)
returns bigint language plpgsql security invoker set search_path = public as $$
declare next_revision bigint;
begin
  if auth.uid() is null then raise exception 'RN_AUTH_REQUIRED'; end if;
  if expected_revision < 0 then raise exception 'RN_BAD_REVISION'; end if;
  if jsonb_typeof(snapshot) is distinct from 'object' or snapshot->>'version' is distinct from '1'
    or jsonb_typeof(snapshot->'roles') is distinct from 'array'
    or jsonb_typeof(snapshot->'orders') is distinct from 'array'
    or jsonb_typeof(snapshot->'settings') is distinct from 'object' then raise exception 'RN_INVALID_DATA'; end if;
  if expected_revision = 0 then
    insert into public.rn_workspaces(owner_id, data, revision) values(auth.uid(), snapshot, 1)
      on conflict (owner_id) do nothing returning revision into next_revision;
  else
    update public.rn_workspaces set data = snapshot, revision = revision + 1, updated_at = now()
      where owner_id = auth.uid() and revision = expected_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'RN_CONFLICT: workspace changed on another device'; end if;
  return next_revision;
end;
$$;
revoke all on function public.rn_save_workspace(jsonb, bigint) from public, anon;
grant execute on function public.rn_save_workspace(jsonb, bigint) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit) values ('rn-files', 'rn-files', false, 20971520) on conflict(id) do nothing;
update storage.buckets set public = false, file_size_limit = 20971520 where id = 'rn-files';
drop policy if exists "rn_private_read" on storage.objects;
create policy "rn_private_read" on storage.objects for select to authenticated using (bucket_id = 'rn-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "rn_private_insert" on storage.objects;
create policy "rn_private_insert" on storage.objects for insert to authenticated with check (bucket_id = 'rn-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "rn_private_update" on storage.objects;
create policy "rn_private_update" on storage.objects for update to authenticated using (bucket_id = 'rn-files' and (storage.foldername(name))[1] = (select auth.uid())::text) with check (bucket_id = 'rn-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "rn_private_delete" on storage.objects;
create policy "rn_private_delete" on storage.objects for delete to authenticated using (bucket_id = 'rn-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
commit;
