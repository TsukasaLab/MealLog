MealLog Ver.0.15 Supabase接続表示 修正版

症状:
「Supabaseの接続設定が必要です」と表示される。

原因:
GitHub上の config.js 自体には正しい設定が存在するが、
GitHub Pages / ブラウザ / Service Worker の更新タイミングによって
config.js が app.js より前に正しく取得できない場合がある。

修正:
・config.js の読み込みを残したまま、index.html に同じ公開設定のフォールバックを追加
・Service Worker を v015 に更新
・CSS / JS / manifest のクエリバージョンを v015 に更新

更新対象:
・index.html
・app.js
・sw.js

反映後:
1. GitHubへ3ファイルを上書き
2. Pages反映後、最初だけ Ctrl+F5
3. MealLogがログイン済みならそのままアプリ画面へ戻る
