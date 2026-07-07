# RLS/user_id分離の実地検証結果（Issue #18）

実施日: 2026-07-07
実施方法: 実際に2つ目のSupabaseアカウントを作成し、ブラウザ（アプリのanon key経由のセッション）から直接検証。Management API（service_role相当）は結果の確認のみに使用し、検証行為そのものには使用していない。

## テストアカウント

- **Account A**: `ridokunnorichang@gmail.com`（既存、人脈カード4件：田中さん・山本さん・佐藤さん・名前未確認の方）
- **Account B**: `ridokunnorichang+rlstest@gmail.com`（本検証のために新規作成、人脈カード3件：モック自動シード分のみ）

## 検証結果

### 1. UI表示レベルの分離

Account Bでログイン後、人脈カード一覧は「3件」（自動シードされたモックのみ）と表示され、Account Aの4件目（「名前未確認の方」）は一切表示されなかった。

### 2. 特定行への直接読み取り試行

Account Bのセッション（有効なaccess_token、anon key）で、Account Aの特定の`contact_id`をURLパラメータで直接指定してSELECTを実行:

```
GET /rest/v1/contacts?id=eq.<AccountAのcontact_id>
```

結果: **HTTPステータス200・レスポンス配列は空 `[]`**。RLSのUSING句によって対象行がクエリ結果から除外され、存在しないのと同じ扱いになることを確認。

### 3. user_id偽装によるINSERT試行

Account Bのセッションで、`user_id`にAccount Aのuser_idを指定して新規行のINSERTを試行:

結果: **HTTP 403、`"new row violates row-level security policy for table \"contacts\""`**。RLSのWITH CHECK句により拒否されることを確認。

### 4. 完全未認証（anonロール）でのSELECT試行

ログインセッションなし、anon keyのみでcontactsテーブルへのSELECTを試行:

結果: **HTTP 401、`"permission denied for table contacts"`**。anonロールでは一切データを読めないことを確認。

### 5. 他ユーザーの行に対するUPDATE試行

Account Bのセッションで、Account Aの`mock-tanaka`行（名前を「田中さん」から「HACKED」に変更）へのPATCHを試行:

結果: **HTTP 200だが影響行数0（`[]`）**。RLSのUSING句によりWHERE条件に一致する対象行が見えず、実質的に何も更新されない。Management API経由でAccount A側の実データを確認したところ、名前は改変されておらず「田中さん」のまま。

### 6. 双方向の新規作成分離

Account Bで新規に人物「RLS検証用B専用人物」を作成（正規のuser_idで、API経由でHTTP 201成功）した後、ログアウトしてAccount Aで再ログインし、人脈カード一覧・ホーム画面のいずれにも「RLS検証用B専用人物」が一切表示されないことを確認。

## 総合評価

`CLAUDE.md` 4.3の要件（他ユーザーのデータが見えない／偽装user_idでの書き込みが拒否される／anonアクセスでデータを読めない）は、`contacts`テーブルに対して**すべて実地検証で確認**できた。RLSは設計通りに機能している。

## 未検証・今後の課題

- 今回は`contacts`テーブルのみを対象とした。他15テーブル（`action_tasks`, `reminders`, `pre_meeting_navs`等）についても同様のポリシー構成（4ポリシー/テーブル）が適用されていることはIssue #9で静的に確認済みだが、本検証と同様の実地攻撃的テストは今回は`contacts`に限定した。
- Supabaseプロジェクトの「Site URL」設定が`localhost:3000`のままになっており、確認メールのリンクを踏むと実際にアプリが動いている`localhost:8081`ではなく空の3000番ポートにリダイレクトされる不具合を発見した（本検証中に偶発的に発覚）。ローカル開発では実害はない（Supabase側でのトークン検証自体は完了する）が、本番デプロイ時は正しいSite URLの設定が必要。
