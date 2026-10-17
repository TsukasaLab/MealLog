-- MealLog Ver.0.05
-- 共有グループ機能追加
-- Supabase Dashboard > SQL Editor で、このファイル全体を1回実行してください。

create extension if not exists pgcrypto;

-- 共有グループ
create table if not exists public.share_groups (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  invite_code text not null default upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 12)),
  created_at timestamptz not null default now(),
  unique (invite_code)
);

-- 共有グループのメンバー
create table if not exists public.share_group_members (
  group_id uuid not null references public.share_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- 食事記録に共有先を追加
alter table public.meal_entries
  add column if not exists share_group_id uuid references public.share_groups(id) on delete set null;

create index if not exists share_group_members_user_idx
  on public.share_group_members(user_id);

create index if not exists meal_entries_share_group_idx
  on public.meal_entries(share_group_id, eaten_at desc);

-- RLS判定用。security definerでRLSの自己参照を避けます。
create or replace function public.is_share_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.share_group_members m
    where m.group_id = p_group_id
      and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_meal(p_meal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.meal_entries e
    where e.id = p_meal_id
      and e.user_id = auth.uid()
  );
$$;

create or replace function public.can_access_meal(p_meal_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.meal_entries e
    where e.id = p_meal_id
      and (
        e.user_id = auth.uid()
        or (
          e.share_group_id is not null
          and public.is_share_group_member(e.share_group_id)
        )
      )
  );
$$;

create or replace function public.can_access_meal_photo_object(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.meal_photos p
    where p.storage_path = p_storage_path
      and public.can_access_meal(p.meal_id)
  );
$$;

-- グループ作成者を自動的にownerメンバーとして登録
create or replace function public.add_share_group_owner_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.share_group_members (group_id, user_id, role)
  values (new.id, new.owner_id, 'owner')
  on conflict (group_id, user_id)
  do update set role = 'owner';

  return new;
end;
$$;

drop trigger if exists share_group_add_owner_member on public.share_groups;
create trigger share_group_add_owner_member
after insert on public.share_groups
for each row
execute function public.add_share_group_owner_member();

-- 招待コードで参加
create or replace function public.join_share_group(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select g.id
    into v_group_id
  from public.share_groups g
  where upper(g.invite_code) = upper(trim(p_invite_code))
  limit 1;

  if v_group_id is null then
    raise exception 'Invalid invite code';
  end if;

  insert into public.share_group_members (group_id, user_id, role)
  values (v_group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return v_group_id;
end;
$$;

-- メンバーが退出。自分がそのグループへ共有していた記録は自分だけに戻す。
create or replace function public.leave_share_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select owner_id into v_owner_id
  from public.share_groups
  where id = p_group_id;

  if v_owner_id is null then
    raise exception 'Group not found';
  end if;

  if v_owner_id = auth.uid() then
    raise exception 'Owner cannot leave the group. Delete the group instead.';
  end if;

  update public.meal_entries
  set share_group_id = null
  where user_id = auth.uid()
    and share_group_id = p_group_id;

  delete from public.share_group_members
  where group_id = p_group_id
    and user_id = auth.uid();
end;
$$;

-- RLS
alter table public.share_groups enable row level security;
alter table public.share_group_members enable row level security;

drop policy if exists "share_groups_select_member" on public.share_groups;
drop policy if exists "share_groups_insert_owner" on public.share_groups;
drop policy if exists "share_groups_update_owner" on public.share_groups;
drop policy if exists "share_groups_delete_owner" on public.share_groups;

create policy "share_groups_select_member"
on public.share_groups
for select to authenticated
using (public.is_share_group_member(id));

create policy "share_groups_insert_owner"
on public.share_groups
for insert to authenticated
with check (owner_id = (select auth.uid()));

create policy "share_groups_update_owner"
on public.share_groups
for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

create policy "share_groups_delete_owner"
on public.share_groups
for delete to authenticated
using (owner_id = (select auth.uid()));

drop policy if exists "share_group_members_select_group" on public.share_group_members;

create policy "share_group_members_select_group"
on public.share_group_members
for select to authenticated
using (public.is_share_group_member(group_id));

-- meal_entriesのRLSを共有対応へ更新
drop policy if exists "meal_entries_select_own" on public.meal_entries;
drop policy if exists "meal_entries_insert_own" on public.meal_entries;
drop policy if exists "meal_entries_update_own" on public.meal_entries;
drop policy if exists "meal_entries_delete_own" on public.meal_entries;
drop policy if exists "meal_entries_select_shared" on public.meal_entries;
drop policy if exists "meal_entries_select_own_or_shared" on public.meal_entries;

create policy "meal_entries_select_own_or_shared"
on public.meal_entries
for select to authenticated
using (
  user_id = (select auth.uid())
  or (
    share_group_id is not null
    and public.is_share_group_member(share_group_id)
  )
);

create policy "meal_entries_insert_own"
on public.meal_entries
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (
    share_group_id is null
    or public.is_share_group_member(share_group_id)
  )
);

create policy "meal_entries_update_own"
on public.meal_entries
for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (
    share_group_id is null
    or public.is_share_group_member(share_group_id)
  )
);

create policy "meal_entries_delete_own"
on public.meal_entries
for delete to authenticated
using (user_id = (select auth.uid()));

-- meal_photosも共有記録は閲覧可能。編集・削除は記録の作成者のみ。
drop policy if exists "meal_photos_select_own" on public.meal_photos;
drop policy if exists "meal_photos_insert_own" on public.meal_photos;
drop policy if exists "meal_photos_update_own" on public.meal_photos;
drop policy if exists "meal_photos_delete_own" on public.meal_photos;
drop policy if exists "meal_photos_select_shared" on public.meal_photos;
drop policy if exists "meal_photos_select_accessible" on public.meal_photos;

create policy "meal_photos_select_accessible"
on public.meal_photos
for select to authenticated
using (public.can_access_meal(meal_id));

create policy "meal_photos_insert_own"
on public.meal_photos
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.can_edit_meal(meal_id)
);

create policy "meal_photos_update_own"
on public.meal_photos
for update to authenticated
using (
  user_id = (select auth.uid())
  and public.can_edit_meal(meal_id)
)
with check (
  user_id = (select auth.uid())
  and public.can_edit_meal(meal_id)
);

create policy "meal_photos_delete_own"
on public.meal_photos
for delete to authenticated
using (
  user_id = (select auth.uid())
  and public.can_edit_meal(meal_id)
);

-- Storage: 共有された食事の写真は共有メンバーもSigned URLで閲覧可能
drop policy if exists "meal_photos_storage_select_own" on storage.objects;
drop policy if exists "meal_photos_storage_select_shared" on storage.objects;
drop policy if exists "meal_photos_storage_select_accessible" on storage.objects;

create policy "meal_photos_storage_select_accessible"
on storage.objects
for select to authenticated
using (
  bucket_id = 'meal-photos'
  and public.can_access_meal_photo_object(name)
);

-- 必要権限
grant select, insert, update, delete on public.share_groups to authenticated;
grant select on public.share_group_members to authenticated;

revoke all on function public.is_share_group_member(uuid) from public;
revoke all on function public.can_edit_meal(uuid) from public;
revoke all on function public.can_access_meal(uuid) from public;
revoke all on function public.can_access_meal_photo_object(text) from public;
revoke all on function public.join_share_group(text) from public;
revoke all on function public.leave_share_group(uuid) from public;

grant execute on function public.is_share_group_member(uuid) to authenticated;
grant execute on function public.can_edit_meal(uuid) to authenticated;
grant execute on function public.can_access_meal(uuid) to authenticated;
grant execute on function public.can_access_meal_photo_object(text) to authenticated;
grant execute on function public.join_share_group(text) to authenticated;
grant execute on function public.leave_share_group(uuid) to authenticated;
