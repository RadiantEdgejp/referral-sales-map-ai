# 紹介営業マップAI

紹介営業で得た人物情報、予定、会話前の質問、会話後メモ、文面、次の行動を一人の人脈カードへ蓄積する Expo React Native アプリです。

## 現在の構成

- Expo / React Native / TypeScript
- Supabase Auth（登録、ログイン、セッション復元、ログアウト）
- Supabase PostgreSQL、RLS、ユーザー別データ分離
- 予定 → 予定前ナビ → 後メモ → 人脈カード更新 → 終業後チェック
- Ollama `gemma3:latest`（予定前ナビ、後メモ、文面確認、営業コーチ）
- Mock AIへの明示切替
- Expoローカル通知
- Web、Android、iOSを同じコードから提供

## 必要なもの

- Node.js 22
- npm 10以上
- Supabaseプロジェクト
- AIを使う場合はOllamaと`gemma3:latest`
- 実機確認にはExpo Go、またはEAS development build

## セットアップ

```powershell
git clone https://github.com/RadiantEdgejp/referral-sales-map-ai.git
cd referral-sales-map-ai
npm.cmd ci
Copy-Item .env.example .env.local
```

`.env.local`へ自分のSupabase URLとanon keyを設定します。`service_role`キーはフロントへ置かないでください。

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_ANON_KEY
EXPO_PUBLIC_LLM_PROVIDER=ollama
EXPO_PUBLIC_OLLAMA_URL=http://127.0.0.1:11434
EXPO_PUBLIC_OLLAMA_MODEL=gemma3:latest
```

`.env.local`、βテスター資格情報、Tunnel URL、実行ログはGit管理外です。

## Supabase DB

SQLは[`supabase/migrations`](supabase/migrations)をファイル名順に適用します。新規環境ではSupabase CLIをリンクして実行します。

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
npx.cmd supabase db push
```

適用後に確認すること：

- publicテーブルのRLSが有効
- anonでは営業データを取得できない
- authenticatedユーザーは自分の`user_id`だけ取得・更新できる
- `create_scheduled_sales_flow`などのRPCをanonが実行できない

本番DBへ未確認SQLを直接貼らず、先にテスト用Supabaseで検証してください。

## Ollama

```powershell
ollama pull gemma3:latest
ollama serve
```

PCブラウザでは`EXPO_PUBLIC_OLLAMA_URL=http://127.0.0.1:11434`を使えます。外部スマホの一時βではOllamaの11434番を公開せず、同一オリジンproxyを使います。

OllamaなしでUI・保存フローを確認する場合：

```dotenv
EXPO_PUBLIC_LLM_PROVIDER=mock
```

Ollama接続失敗時に自動でmockへ戻ることはありません。AI失敗を成功として保存しないためです。

## 起動

```powershell
npm.cmd start
npm.cmd run web
npm.cmd run android
npm.cmd run ios
```

PowerShellでは`npm`ではなく`npm.cmd`を使うと実行ポリシーの影響を避けられます。

## デモデータ

ログイン後、設定画面の「デモ人物を追加」から追加できます。既存の同じIDの人物は上書きしません。実データがあるユーザーで一括リセットを実行しないでください。

## 自動検証

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run doctor
npm.cmd run audit:security
npm.cmd run export:web
npm.cmd run export:android
npm.cmd run export:ios
```

GitHub Actionsの`Quality`も同じ検証をNode 22・日本時間で実行します。

実Supabase E2Eは[`tests/e2e`](tests/e2e)にあります。テスト用プロジェクトでメール自動確認を有効にし、次を設定して個別に実行します。

```powershell
$env:SUPABASE_TEST_URL='https://TEST.supabase.co'
$env:SUPABASE_TEST_ANON_KEY='TEST_ANON_KEY'
node tests/e2e/coreSalesFlow.local.mjs
node tests/e2e/endOfDay.local.mjs
node tests/e2e/issue19UiStorage.local.mjs
```

共有本番プロジェクトで自動反復するとテストAuthユーザーが残るため禁止です。

## 障害時の確認

1. 画面の再試行を押す
2. Supabase Dashboardで対象テーブル、RLS、APIログを確認する
3. Ollama利用時は`ollama list`と11434の疎通を確認する
4. 保存処理を連打しない。未確定の文面確認は終業後チェックに表示される
5. migration障害時は新しい破壊的SQLを重ねず、直前のGit commitとDBバックアップを確認する

アプリはSupabase失敗時にlocalStorageへ黙ってフォールバックしません。

## リリース

`eas.json`にdevelopment、preview、productionプロファイルがあります。

```powershell
npx.cmd eas-cli build --profile preview --platform android
npx.cmd eas-cli build --profile preview --platform ios
```

署名資格情報、ストア情報、プライバシー表示、問い合わせ先を確認してからproduction buildを作成してください。
