MealLog Ver.0.09 更新内容

主な変更
- CarLog寄りのアプリっぽいホーム画面に変更
- 大きすぎる表題をやめて、ダッシュボード型のレイアウトに変更
- 色を増やして、お祭り感のあるポップな見た目に調整
- スマホで画像と文字が被りにくいよう、カード・検索欄・上部エリアの余白を調整
- 価格入力を追加（任意）
- 店舗履歴で、訪問回数・平均評価・合計金額・平均金額を表示

入っているファイル
- index.html
- app.js
- v006.css
- v009.css
- SQL_v009_price_column.sql
- manifest.webmanifest
- sw.js
- icons/...

反映方法
1. 既存ファイルをバックアップ
2. index.html を上書き
3. app.js を上書き
4. v009.css を追加
5. 価格機能も使うなら、Supabase SQL Editor で SQL_v009_price_column.sql を実行
6. GitHubへコミット
7. ブラウザで Ctrl + F5

補足
- SQLをまだ実行していなくても、アプリ自体は動くようにしてあります
- その場合、価格集計は自動で無効表示になります
