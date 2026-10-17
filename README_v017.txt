MealLog Ver.0.17 CSS復元修正版

今回の原因:
Ver.0.14以降で index.html から基礎CSSの読み込みを外してしまったため、
.hidden { display:none } などの共通スタイルが消えていました。

そのため本来は非表示の
「Supabaseの接続設定が必要です」
画面が常に表示されていました。

Supabase設定自体は正常です。

修正内容:
- styles.css を再読込
- v003.css / v004.css / v005.css / v006.css / v009.css を再読込
- v011.css は最後に読ませて夜祭りデザインを維持
- Service Worker を v017 に更新

差し替え:
- index.html
- app.js
- sw.js

反映後:
1. GitHubへ上書き
2. DevTools > Application > Service Workers > Unregister
3. Ctrl + F5
