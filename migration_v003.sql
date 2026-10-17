-- MealLog Ver.0.03 migration
-- 既存の meal_entries に「食事区分・店舗名・評価」を追加します。

alter table public.meal_entries
  add column if not exists place_type text not null default 'home',
  add column if not exists store_name text not null default '',
  add column if not exists rating smallint;

-- 既存制約がなければ追加
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meal_entries_place_type_check'
      AND conrelid = 'public.meal_entries'::regclass
  ) THEN
    ALTER TABLE public.meal_entries
      ADD CONSTRAINT meal_entries_place_type_check
      CHECK (place_type IN ('home', 'dineout', 'takeout'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meal_entries_store_name_length_check'
      AND conrelid = 'public.meal_entries'::regclass
  ) THEN
    ALTER TABLE public.meal_entries
      ADD CONSTRAINT meal_entries_store_name_length_check
      CHECK (char_length(store_name) <= 120);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'meal_entries_rating_check'
      AND conrelid = 'public.meal_entries'::regclass
  ) THEN
    ALTER TABLE public.meal_entries
      ADD CONSTRAINT meal_entries_rating_check
      CHECK (rating IS NULL OR rating BETWEEN 1 AND 5);
  END IF;
END $$;
