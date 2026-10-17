-- MealLog Ver.0.02 / Supabase 初期設定
-- Supabase Dashboard > SQL Editor でこのファイル全体を1回実行してください。

create extension if not exists pgcrypto;

create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  note text not null default '' check (char_length(note) <= 800),
  eaten_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.meal_photos (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references public.meal_entries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists meal_entries_user_eaten_idx on public.meal_entries(user_id, eaten_at desc);
create index if not exists meal_photos_meal_idx on public.meal_photos(meal_id);
create index if not exists meal_photos_user_idx on public.meal_photos(user_id);

alter table public.meal_entries enable row level security;
alter table public.meal_photos enable row level security;

-- 既存ポリシーがある場合に再実行できるよう削除
DROP POLICY IF EXISTS "meal_entries_select_own" ON public.meal_entries;
DROP POLICY IF EXISTS "meal_entries_insert_own" ON public.meal_entries;
DROP POLICY IF EXISTS "meal_entries_update_own" ON public.meal_entries;
DROP POLICY IF EXISTS "meal_entries_delete_own" ON public.meal_entries;
DROP POLICY IF EXISTS "meal_photos_select_own" ON public.meal_photos;
DROP POLICY IF EXISTS "meal_photos_insert_own" ON public.meal_photos;
DROP POLICY IF EXISTS "meal_photos_update_own" ON public.meal_photos;
DROP POLICY IF EXISTS "meal_photos_delete_own" ON public.meal_photos;

create policy "meal_entries_select_own" on public.meal_entries
for select to authenticated using ((select auth.uid()) = user_id);
create policy "meal_entries_insert_own" on public.meal_entries
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "meal_entries_update_own" on public.meal_entries
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "meal_entries_delete_own" on public.meal_entries
for delete to authenticated using ((select auth.uid()) = user_id);

create policy "meal_photos_select_own" on public.meal_photos
for select to authenticated using ((select auth.uid()) = user_id);
create policy "meal_photos_insert_own" on public.meal_photos
for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "meal_photos_update_own" on public.meal_photos
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "meal_photos_delete_own" on public.meal_photos
for delete to authenticated using ((select auth.uid()) = user_id);

-- 非公開バケット。画像はSigned URLで一時的に表示します。
insert into storage.buckets (id, name, public)
values ('meal-photos', 'meal-photos', false)
on conflict (id) do update set public = false;

DROP POLICY IF EXISTS "meal_photos_storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "meal_photos_storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "meal_photos_storage_delete_own" ON storage.objects;

-- ファイルパスの先頭フォルダをログインユーザーIDに固定
create policy "meal_photos_storage_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'meal-photos'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- 自分がアップロードしたファイルだけ閲覧可能
create policy "meal_photos_storage_select_own"
on storage.objects for select to authenticated
using (
  bucket_id = 'meal-photos'
  and owner_id = (select auth.uid()::text)
);

-- 自分がアップロードしたファイルだけ削除可能
create policy "meal_photos_storage_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'meal-photos'
  and owner_id = (select auth.uid()::text)
);
