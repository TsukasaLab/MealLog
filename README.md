# MealLog Ver.0.02

食べたものを「写真 + 文章」で記録し、Supabaseへクラウド保存するWebアプリです。

## 今回できること

- **Googleアカウントで新規登録 / ログイン**
- メールアドレス + パスワードで新規登録 / ログイン
- スマホのカメラから撮影
- 端末の写真フォルダから1枚または複数枚を選択
- 食事名・日時・メモを登録
- 写真をSupabase Storageへクラウド保存
- ログインした本人だけ自分の記録を閲覧
- 記録の検索
- 詳細表示
- 記録と写真の削除
- PC / スマホのレスポンシブ表示

## 構成

- `index.html` 画面
- `styles.css` デザイン
- `app.js` ログイン・保存・閲覧処理
- `config.js` Supabase接続設定
- `setup.sql` DB / Storage / RLS初期設定

## 1. Supabaseプロジェクトを作る

1. https://supabase.com/ でプロジェクトを作成
2. Dashboardの **SQL Editor** を開く
3. `setup.sql` の内容をすべて貼り付けて実行

これで以下が作成されます。

- `meal_entries` 食事記録
- `meal_photos` 写真情報
- `meal-photos` 非公開Storageバケット
- ログイン中の本人だけアクセスできるRLSポリシー

## 2. `config.js` を設定

Supabase Dashboardの Project Settings / API から

- Project URL
- Publishable key（または legacy anon key）

をコピーして `config.js` に入れます。

```js
window.MEALLOG_CONFIG = {
  SUPABASE_URL: "https://xxxxxxxx.supabase.co",
  SUPABASE_KEY: "sb_publishable_xxxxxxxx"
};
```

### 重要

`service_role` key は絶対にWebサイトへ置かないでください。

## 3. Googleログインを有効にする

### A. Google側

Google Auth Platform / Google Cloud ConsoleでOAuthクライアントを作成します。

1. OAuthクライアントIDを作成
2. アプリケーションの種類は **Web application**
3. Authorized JavaScript origins にMealLogを置くサイトのoriginを登録

GitHub Pagesなら例:

```text
https://tsukasalab.github.io
```

4. Authorized redirect URIs にSupabaseのコールバックURLを登録

```text
https://＜あなたのProject Ref＞.supabase.co/auth/v1/callback
```

Project RefはSupabaseのProject URLに含まれる文字列です。

例:

```text
Project URL
https://abcdefghijk.supabase.co

Googleへ登録するRedirect URI
https://abcdefghijk.supabase.co/auth/v1/callback
```

5. 作成された **Client ID** と **Client Secret** を控える

### B. Supabase側

Supabase Dashboardで:

1. **Authentication > Sign In / Providers** を開く
2. **Google** を有効化
3. Googleで取得した **Client ID** と **Client Secret** を登録
4. 保存

Client SecretはSupabase側だけに登録します。`config.js`やGitHubには置きません。

## 4. SupabaseのURL設定

Supabase Dashboard > **Authentication > URL Configuration** で設定します。

GitHub Pagesへ `https://tsukasalab.github.io/MealLog/` として公開する場合:

```text
Site URL
https://tsukasalab.github.io/MealLog/

Redirect URLs
https://tsukasalab.github.io/MealLog/**
```

Googleログイン後はMealLogへ戻り、そのままログイン済みになります。

## 5. GitHub Pagesへ配置

このフォルダ内のファイルをそのままGitHubリポジトリへ配置できます。

```text
MealLog/
├ index.html
├ styles.css
├ app.js
├ config.js
├ setup.sql
└ README.md
```

GitHub Pagesが有効なら静的サイトとして動作します。

## Googleログイン利用者の扱い

ユーザーが「Googleで続ける」を初めて押した場合も、Supabase Auth側にMealLog用ユーザーが自動作成されます。

利用者が別途Supabaseのアカウントを作る必要はありません。また、MealLog専用のパスワードを新しく決める必要もありません。

## 写真の公開範囲

`meal-photos` は **private bucket** です。

ブラウザではログイン中のユーザーにだけ発行できるSigned URLを使って画像を表示します。URLは1時間で期限切れになります。StorageとDBの両方にRLSを設定しているので、他ユーザーの記録を通常のクライアント操作で閲覧できない構成です。

## Ver.0.03以降の候補

- 家族 / グループ共有
- 店舗名・住所
- 外食 / 自宅 / テイクアウト
- 評価
- タグ
- お気に入り
- 地図
- RouteLog連携
- 画像圧縮
- HEIC変換対応
- PWAインストール
