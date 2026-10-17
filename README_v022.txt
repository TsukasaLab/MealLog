MealLog Ver.0.22 ホーム画面再構築版

今回の方針:
- 画像の上にボタン枠を置く方式をやめ、UI部品をCSSで作り直し
- 夜祭り背景画像は背景演出としてのみ使用
- PCとスマホで別レイアウト調整
- スマホの「食べた場所」は常に横3列
- 集計カードはアイコン領域と文字領域を分離し、重なり防止
- 最近の食事は PC 3列 / タブレット2列 / スマホ1列
- デスクトップのみ左サイドメニューを表示
- Supabase / Googleログイン / 記録 / 編集 / 削除 / 共有の既存機能は維持

主な更新ファイル:
index.html
app.js
sw.js
v022.css
config.js
assets/festival-bg-v22.png

反映後:
1. GitHubへ一式を上書き
2. 最初だけ Ctrl+F5
3. 古い表示が残る場合は Service Worker を Unregister 後に再読込
