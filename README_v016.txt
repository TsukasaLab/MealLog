MealLog Ver.0.16 config.js不要化パッチ

今回の修正:
- app.js に Supabase の Project URL / Publishable key を内蔵
- config.js の読み込みに失敗しても setup 画面へ行かないよう修正
- Service Worker のキャッシュ名を更新

差し替え対象:
- index.html
- app.js
- sw.js

手順:
1. GitHub 上の 3 ファイルを上書き
2. 反映後、Ctrl+F5
3. それでも残る場合は DevTools > Application > Service Workers で Unregister 後に再読込
