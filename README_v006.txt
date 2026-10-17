MealLog Ver.0.06 更新内容
============================

今回の更新ファイル
- index.html
- app.js
- v006.css
- manifest.webmanifest
- sw.js
- icons/icon-192.png
- icons/icon-512.png
- icons/icon-maskable-512.png
- icons/apple-touch-icon.png

主な変更
- お祭り感のあるポップなアプリ風デザインへ更新
- ホーム画面、カード、モーダル、ログイン画面の見た目をアプリ寄りに調整
- PWA用 manifest / icon / service worker を追加
- インストール時のアイコンを追加
- 記録カードの見た目を改善（写真なし時のプレースホルダー含む）

反映手順
1. 既存の MealLog ファイルがあるフォルダを開く
2. この更新の各ファイルを同名で上書きする
3. icons フォルダごと追加する
4. GitHub にコミットして Pages を更新する
5. ブラウザで開いた後、強制再読み込みする
   - PC: Ctrl + F5
   - スマホ: タブを閉じて再度開く
6. 以前インストール済みのPWAが古い見た目のままなら、一度ホーム画面アイコンを削除して再インストール

補足
- 今回は見た目中心の更新なので、DB追加は不要です。
- 共有機能の紐づけは保留のままでOKです。
