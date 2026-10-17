MealLog Ver.0.03 更新手順

1. Supabase > SQL Editor で migration_v003.sql を実行
2. GitHub の MealLog リポジトリに次の3ファイルを上書き/追加
   - index.html（上書き）
   - app.js（上書き）
   - v003.css（新規追加）
3. Commit changes
4. GitHub Pages反映後に Ctrl+F5 で再読み込み

追加機能
- 自宅 / 外食 / テイクアウトの区分
- 外食・テイクアウト時の店舗名
- 1〜5の評価（未評価も可）
- 一覧・詳細画面への区分/店舗/評価表示
- 店舗名も検索対象
