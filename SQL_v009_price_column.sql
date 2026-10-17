-- MealLog Ver.0.09 用 SQL
-- 価格記録機能を追加します。
alter table public.meal_entries
  add column if not exists price_yen integer;

comment on column public.meal_entries.price_yen is '食事の価格（円）';
