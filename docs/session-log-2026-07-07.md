# 作業ログ（2026-07-07 〜 2026-07-08）

対象リポジトリ: `RadiantEdgejp/referral-sales-map-ai`
起点コミット: `dd2f928`（Add completion gap audit report）
終点コミット: `69fd73d`（Add new-contact E2E checklist results）
実装体制: オーケストレーター（Claude Sonnet 5）+ 複数の `fable-advisor`（Claude Fable 5）サブエージェントによる並行実装

このドキュメントは、本セッションで行った作業を時系列・工程別に、判断理由も含めて詳細に記録したものである。

---

## フェーズ0: 環境準備

1. GitHubリポジトリ `RadiantEdgejp/referral-sales-map-ai` を `C:\Users\snomu\dev\referral-sales-map-ai` にクローン。`gh auth status` でRadiantEdgejpアカウントとして認証済みであることを確認。
2. `npm install` 実行（542パッケージ）。
3. `.claude/launch.json`（Web版プレビュー起動設定）を作成し、Expo Web版をポート8081で起動。スクリーンショットでホーム画面の表示を確認。
4. ユーザーレベルのカスタムサブエージェント `fable-advisor`（Claude Fable 5、`~/.claude/agents/fable-advisor.md`）を新設。`~/.claude/CLAUDE.md` に「複雑な設計判断はfable-advisorに相談する」旨を追記。

---

## フェーズ1: 現状監査（GitHub Issue #1 対応）

Issue #1「現状棚卸し・完成前ギャップ監査と完成計画書作成」の対応として、以下を実施。

### 調査内容

- `CLAUDE.md`（502行）、`README.md`、リポジトリ内の全ソースコード（5,527行）を読了。
- `git log --oneline`（26コミット）でこれまでの開発履歴を確認。
- `npx tsc --noEmit` を実行しエラー0件を確認。
- `grep` でSupabase・LLM Adapter・認証・RLS関連のキーワードを検索 → **すべて0件**（README記載通り未実装であることをコードで裏付け）。
- ブラウザで実際にアプリを操作し、以下を発見:
  - **P0（最重要）**: `AddPersonScreen` への遷移コードがリポジトリ内に1箇所のみ（`PeoplePane`の`ListEmptyComponent`内）。`MOCK_PEOPLE`が起動時に自動シードされ削除機能もないため、人脈カード一覧が0件になることがなく、この導線に永久に到達できない。直接URL遷移（`/AddPerson`）もHomeへリダイレクトされることを確認。
  - `src/screens/PreMeetingNavScreen.tsx` / `AfterMemoScreen.tsx` / `LineCheckScreen.tsx` / `EndOfDayCheckScreen.tsx`（合計513行）が `RootNavigator` に登録されているが、どこからも遷移されない死んだコードであることを`grep`で確認。実際に稼働しているのは`HomeScreen.tsx`内のタブパネル実装。
  - `createTodayActions()`（ホームの「今日の優先行動」生成ロジック）が山本・田中・佐藤という固定名の`findPerson`検索のみで、新規人物が反映されない。
  - `createMockAnalysis()`（人物追加のAI整理機能）が引数`_memo`を完全に無視し、常に同一の「田中さん」分析を返す。
  - `EndOfDayPane` が`people`をpropsで受け取らず、日付・件数・人物名（存在しない「村上さん」を含む）すべて固定文字列。
  - `grep -rn "想定です" src` で27箇所のAlertスタブ（開発者が「〜する想定です」と明示した未実装箇所）を検出。
  - `PersonCard`の「詳細/LINE文/通知」、Homeの「詳細/完了/延期」ボタンが`View`のみで`onPress`なし（タップ無反応）。
  - `docs/`配下に存在すべきとされていた6ファイル（`rc-remediation-report.md`等）はすべて不在。

### 成果物

- `docs/completion-gap-audit.md`（319行）を作成。総合判定・P0〜P3の課題一覧・できている/いない機能・完成までに必要なIssue案（A〜N、14件）を記載。
- git identity をこのリポジトリにローカル設定（`RadiantEdgejp <242349050+RadiantEdgejp@users.noreply.github.com>`、過去のコミットと同一アカウント。グローバル設定は変更していない）。
- コミット`dd2f928`として保存し、ユーザー承認を得た上で`origin/main`にpush。
- Issue #1に完了報告をコメント。

---

## フェーズ2: GitHub Issue化（#2〜#15の作成）

監査で提案したIssue案A〜Nを、実行順・依存関係を整理した上でGitHub Issueとして作成。

- ラベル`P0-blocker`（赤）・`P1-required`（オレンジ）・`P2-later`（黄）を新設し、各Issueに付与。
- 作成したIssue（実行順）:
  - #2 新規人物を追加する導線を復旧する（P0）
  - #3 ホームの「今日の優先行動」を実データ駆動にする（P0）
  - #4 人物アーカイブ・削除機能を実装する（P1）
  - #5 「AIで整理する」が入力内容を無視する問題を解消する（P0）
  - #6 終業後チェックを実データ連動にする（P1）
  - #7 死んだ画面（重複実装）を整理する（P1）
  - #8 HomeScreen.tsx（2,941行）をファイル分割する（P2）
  - #9 Supabaseスキーマ導入と永続化の移行（P1）
  - #10 認証（サインアップ・ログイン・セッション復元）を導入する（P1）
  - #11 LLM Adapter層を新設する（P1）
  - #12 Alertスタブ（27箇所）を実装または削除する（P2）
  - #13 装飾のみで無反応なボタンを実装または削除する（P2）
  - #14 最低限の利用規約・プライバシー・AI注意ページ（P1）
  - #15 新規人物E2E回帰チェックリストの整備と実行（P1・最終ゲート）
- 各Issueに背景・対象画面/テーブル・実装内容・受け入れ条件・確認方法・依存関係を詳細記載。
- Issue #1に、作成した14件のIssue一覧と実行順序をまとめてコメント。

---

## フェーズ3: fable-advisor運用方針の検討

- ユーザーから「fableはSupabaseスキーマ設計・認証アーキテクチャ・LLM Adapter設計など高難度の設計判断にのみ使う」方針の確認があり、合意。
- その後ユーザーから方針転換の指示: 「実装をfableにやらせたい」「完成度優先」「fableは日本時間7/8までしか使えないので急ぎたい」「トークンが余るなら使い切りたい」。
- この指示を受け、fable-advisorを**設計相談役ではなく実装担当**として運用する方針に切り替え。以降、`subagent_type: fable-advisor`で「アドバイザーではなく実装者として振る舞うこと」を明示したプロンプトを用いて多数のバックグラウンドタスクを起動。

---

## フェーズ4: 環境確認とSupabase認証情報の授受

- `supabase` CLIが未インストール、`~/.supabase`にプロジェクト情報なしを確認。
- Ollamaがローカルで稼働中、複数モデル（`llama3:latest` 8B/4.6GB、`llama3.3:latest` 70B/42GB、`mistral-small3.1:latest` 24B/15GB、`qwen3-coder-next` 51GB、`functiongemma`）が利用可能なことを確認。
- ユーザーから段階的にSupabase認証情報を受領し、都度用途を確認しながら取り扱った:
  1. anon key + プロジェクトURL（`https://ephyevmcqezodwavuvce.supabase.co`）→ クライアント接続用。
  2. `sb_publishable_...` キー → anon keyと同等の公開鍵と判明（DDL権限なし）。
  3. service_role key → RLSバイパス用の強力な鍵。アプリコードには組み込まない前提でサブエージェントに一時的に共有。
  4. Personal Access Token（`sbp_...`）→ Supabase Management API用のアカウントレベル鍵。マイグレーション適用に使用。
- **セキュリティガードレールの発動**: サブエージェントへのプロンプトにPersonal Access Tokenを直接埋め込もうとした際、Claude Codeの自動モード分類器が「Credential Leakage」としてブロック。以降、強い権限を持つ鍵はオーケストレーター（このセッション）のBashコンテキストでのみ使用し、サブエージェントにはanon keyのみを渡す方針に切り替えた。
- 同様に、Supabase Management APIの認証設定（`/config/auth`）を読み取ろうとした際も「Credential Materialization」（SMTPパスワード等の別の機密情報が混入するリスク）として分類器にブロックされ、ユーザーに直接確認する方針に切り替えた。

---

## フェーズ5: 並行実装（1周目） — #2〜#8, #9, #10, #12, #13

### 実装体制

- **Agent A**（メイン作業ディレクトリ、`C:\Users\snomu\dev\referral-sales-map-ai`）: #2→#3→#4→#5→#6→#7→#8→#12→#13 を順次実装。
- **Agent B**（手動作成したgit worktree `C:\Users\snomu\dev\referral-sales-map-ai-supabase`、ブランチ`work/supabase-auth`）: #9→#10 を実装。harnessの自動worktree分離機能が本環境では利用不可（`Cannot create agent worktree: not in a git repository`）だったため、`git worktree add`で手動作成し、npm install・git identity設定を個別に実施した上でエージェントに割り当てた。

### 各Issueの実装内容（コミット単位）

| コミット | Issue | 内容 |
|---|---|---|
| `469f740` | #2 | HomeScreenヘッダーの人物追加アイコンを人脈タブ専用に配線し直し、常時表示の「人物を追加する」導線を追加 |
| `9299114` | #3 | `createTodayActions`を実データ駆動に書き換え（258行差分） |
| `f667ff1` | #4 | `Person.archivedAt`追加、人物詳細にアーカイブ機能、通知サービス拡張 |
| `a99ed98` | #5 | `createMockAnalysis`を入力連動の正規表現ヒューリスティックに全面書き換え（152行差分） |
| `dd02e9b` | #6 | `EndOfDayPane`を実データ連動に書き換え（462行差分） |
| `1d76c32` | #7 | 死んだ画面4ファイル（525行）を削除、`RootNavigator`/`navigation.ts`から登録解除 |
| `d816986` | #8 | `HomeScreen.tsx`（2,784行）を21ファイルに分割（`src/logic/`5ファイル、`src/components/`6ファイル、`src/screens/home/`9ファイル） |
| `1afadac` | #9 | Supabaseクライアント新設、16テーブル・RLSポリシーのマイグレーション（652行）、`personStorage.ts`をSupabase版に書き換え |
| `4fbae7b` | #10 | 認証一式（`AuthContext`, `authErrors`, 4画面, `RootNavigator`の認証分岐）を894行差分で追加 |
| `1b9590a` | #12 | Alertスタブを実処理に置換（145行差分） |
| `e8110e9` | #13 | 装飾ボタンを`Pressable`化し実処理を実装、`src/logic/nextContact.ts`新設 |

### セッション上限による中断と再開

作業中、fable-advisorのセッション利用上限に**3回**到達した。

1. 1回目: Agent A・Agent B同時に上限到達（リセット予定 10:20 JST）。ユーザーの「リセットはとっくにされてる」との申告を受け、実際の時刻確認はしたが指示に従い再開を試行 → 成功。
2. 2回目: Agent A（#12着手中）が上限到達（リセット予定 8:20 JST、約8時間後）。ユーザーに状況説明とオプション提示（8時間待つ/オーケストレーターが引き継ぐ/全てオーケストレーターに切替）を提示したところ、ユーザーが「上限来てなくない？」と返答したため即座に再試行 → 成功（実際にはまだ稼働可能だった）。
3. 3回目: Issue #11実装中に上限到達（リセット予定 2:10 JST）。ただちに再開を試行し成功。

いずれの中断でも、中断時点の未コミット差分を`git status`/`git diff`/`npx tsc --noEmit`で確認し、破棄せず次のエージェント起動時のコンテキストとして正確に引き継いだ。

### オーケストレーターによる直接介入（Issue #7）

2回目の上限到達時、Agent Aが Issue #7（死んだ画面削除）の作業を未コミットのまま中断していた。オーケストレーター自身が差分内容（`RootNavigator.tsx`・`types/navigation.ts`からの4画面削除）をレビューし、Issue本文の意図と一致することを確認した上で、`npx tsc --noEmit`合格を確認してからコミット（`1d76c32`）した。

---

## フェーズ6: Supabaseプロジェクトのクリーンアップ

Agent Bが#9のマイグレーションを実際にSupabase Management API経由で適用した後、オーケストレーターが実データを確認したところ、以下を発見した。

- 対象プロジェクト（`ephyevmcqezodwavuvce`）に、本アプリと無関係な**31テーブル**（`business_pack_*`、`tool_registry_*`、`role_model_registry`、`workspace_audit_entries`、`events`、`meetings`等、別システムのものと思われる）が既に存在。
- `auth.users`に既存ユーザー**2件**（`mobile-beta-20260628@example.com`、`ridokunnorichang+sbtest1@gmail.com`）が存在。

ユーザーに確認したところ、「このDBは元々別のものに使っていて、全部消した状態で再利用する予定だった」との回答。**不可逆な削除操作**であるため、削除対象（31テーブル名・2ユーザーのメールアドレス）を明示した上でAskUserQuestionツールで最終確認を取り、承認を得てから実行した。

- `DROP TABLE ... CASCADE`で31テーブルを削除（Management API経由）。
- Supabase Auth Admin API（`DELETE /auth/v1/admin/users/{id}`）で2ユーザーを削除。
- 削除後、`public`スキーマに本アプリの16テーブルのみ、`auth.users`が0件であることを再確認。

---

## フェーズ7: 並行実装（2周目） — #12続き, #13, #14

- Agent A再開（#12続き→#13）と、空いたworktreeでAgent C（#14: 法務ページ）を並行起動。
- #14はSignUpScreenへの同意チェックボックス追加、法務3ページ（利用規約・プライバシーポリシー・AI利用上の注意）、設定画面の新設を実装。headless Chrome（puppeteer-core）による実機検証で11/11のテストケースに合格したことを確認（Claude Previewツールのサーバーが別セッションに占有されており使用できなかったための代替手段）。
- コミット`a5740ea`（#14）、`1b9590a`（#12続き）、`e8110e9`（#13）。

---

## フェーズ8: ブランチ統合（マージ）と発見・修正したバグ

`work/supabase-auth`ブランチ（#9, #10, #14を含む）をメインブランチにマージ（`git merge --no-edit`）。**2件の競合**が発生し、オーケストレーターが手動で解消した。

### 競合1: `src/navigation/RootNavigator.tsx`

原因: worktreeブランチの分岐元コミットが#7（死んだ画面削除）より前だったため、work/supabase-auth側は死んだ4画面（`PreMeetingNavScreen`等）のimportと`Stack.Screen`登録を保持したまま、認証分岐（未ログイン/ログイン後/パスワード復旧/初期化中）を追加していた。

解消方針: `git show work/supabase-auth:...`で認証側の完全な実装を確認した上で、死んだ4画面への参照だけを除いた統合版を`Write`ツールで作成。`Settings`/`LegalDoc`画面registration、`LogoutButton`/`SettingsButton`は維持。

### 競合2: `src/storage/personStorage.ts`

原因: メイン側（#12/#13）は`nextContact.ts`等の新規ロジックから`const saved = await updatePerson({...})`という戻り値ありの呼び出しパターンを前提にしていたが（12箇所で使用）、Supabase移行版の`updatePerson`は`void`を返す実装だった。

解消方針: Supabaseの`.update(updates).eq('id', id).select(CONTACT_COLUMNS).single()`パターンに変更し、DB更新後の実際の行を`rowToPerson`で変換して返す形に統合。あわせて、`Person`型に存在する`archivedAt`・`updatedAt`フィールドが`ContactRow`/`CONTACT_COLUMNS`/`rowToPerson`/`personToRow`のいずれにもマッピングされておらず、Supabase経由では**アーカイブ操作が永続化されずに消失する**という潜在バグを発見。`contacts`テーブルには`archived_at`/`updated_at`カラムが既に存在していたため（Agent Bが先回りして追加済み）、アプリ側のマッピングを追加して解消。

### マージ後の追加対応

- `package.json`にマージされた`@supabase/supabase-js`が未インストールだったため`npm install`実行。
- `.env.local`（gitignore対象のためマージに含まれない）をworktreeからメインディレクトリにコピー。
- `npx tsc --noEmit`でエラー0件を確認後、マージコミット完了。

---

## フェーズ9: ライブ環境での手動E2E検証と追加バグ修正

オーケストレーター自身がブラウザ（Claude Previewツール）を操作し、実際のSupabase・実際のメールアドレスで検証を実施。

### 発見1: React Native Web入力欄の二重DOM問題

`preview_fill`ツールで入力した値が、送信時にReact側の状態としては空と判定される事象が複数回発生（サインアップ画面・ログイン画面）。原因調査の結果、開発サーバーの度重なるHot Reloadにより`document.querySelectorAll('input')`が本来2個であるべきところ4個検出される、**複数のReactルートが同一DOMに残留**した状態になっていたことが判明。`window.location.reload()`でクリーンな単一マウント状態に戻し、さらに念のためネイティブプロパティセッター経由で`input`/`change`イベントを発火させる方式に切り替えることで解消。

### 発見2: `contacts`テーブルのマイグレーション未適用

新規ユーザーでログイン後、`GET .../rest/v1/contacts` が **400エラー（`column contacts.opening_talk does not exist`）**を返すことを発見。Management API経由で実際のカラム一覧を確認したところ、マイグレーションファイル内の`ALTER TABLE ... ADD COLUMN`文（`opening_talk`, `next_question`, `line_message`, `email_message`, `recommended_next_contact_at`, `additional_memo`, `notification_id`, `archived_at`の8カラム）が、Agent Bによる一括適用時に実際には反映されていなかったことが判明（長大なSQLの一括実行時に一部欠落したとみられる）。

この修正はライブの共有データベースへのDDL変更にあたるため、自動モード分類器に一度ブロックされた（「Modify Shared Resources」）。ユーザーに実行内容（既にコミット済みのマイグレーションファイルと同一の、追加のみでデータ損失リスクのないALTER文）を明示して承認を取得後、Management API経由で適用し、カラム追加を確認した。

### 実施したE2Eシナリオと結果

1. `ridokunnorichang@gmail.com` で新規サインアップ → 確認メール送信（200 OK）確認。
2. ユーザーが確認メールのリンクをクリック。
3. ログイン → 成功（ただし上記のカラム欠落により初回は400エラー、修正後リロードで200 OK）。
4. 人脈カード4件（モック3件が自動シードされた状態）でも「人物を追加する」ボタンが常時表示されることを確認（Issue #2の核心的な受け入れ条件）。
5. 新規人物メモ「新規連動テスト 佐藤。連合検証株式会社。営業責任者。人材採用と営業組織づくりに関心あり」を入力し「AIで整理する」を実行 → 入力内容に応じた分析結果（業種「人材・採用支援」、分類「情報源候補・紹介先候補」等）が返ることを確認（Issue #5）。
6. 保存 → 人脈カードが4件に増加したことを確認（Supabaseへの実書き込み）。
7. ログアウト（`window.confirm`をオーバーライドして実行）。
8. 再ログイン → 人脈カード4件（新規人物含む）が復元されることを確認。

---

## フェーズ10: LLM Adapter実装（Issue #11）

- ユーザーから「PCが重くならないよう軽量モデルで」との要望があり、進行中のエージェントに即座に指示を追加送信。当初想定していた大型モデル（`llama3.3`70B、`qwen3-coder-next`51GB）を避け、**`llama3:latest`（8B、4.6GB）**をデフォルトモデルとして採用。
- `src/ai/`配下にAdapterインターフェース（`types.ts`）、`OllamaProvider`、`MockProvider`、facade（`llmAdapter.ts`）を新設。環境変数`EXPO_PUBLIC_LLM_PROVIDER`でプロバイダ切替可能に。
- Ollama失敗時のMockへの自動フォールバックは**意図的に非採用**（失敗が成功として保存されるのを防ぐため、CLAUDE.md 4.4準拠）。
- `AddPersonScreen`・`PreMeetingPane`・`AfterMemoPane`・`LineCheckPane`・`CoachChatScreen`をAdapter経由の非同期呼び出しに書き換え、ローディング表示・エラーバナーを追加。
- ブラウザ実機検証: Ollama稼働中は実際に`POST http://127.0.0.1:11434/api/generate`が200を返し、2回の実行で異なる分析結果（実LLM生成であることの裏付け）を確認。Ollamaを一時停止した状態ではエラーバナー表示・保存ボタン無効化（DB非更新）を確認、その後Ollamaを再起動して復旧を確認。
- 実装は`work/issue-11-llm-adapter`という別ブランチで行われていたため、`main`が直系の祖先であることを確認した上で`git merge --ff-only`でfast-forwardマージ（コミット`d69f11c`）。

---

## フェーズ11: 最終レポート（Issue #15）

- `docs/new-contact-e2e-checklist.md`を作成し、フェーズ9で実施した実データE2E検証の結果を項目別に記録。
- **正直に「未実施・未実装」と明記した項目**: 次回連絡日の自動タスク・リマインダー生成（CLAUDE.md 5.1、今回のIssueスコープ外）、予定前ナビ〜後メモの質問引き継ぎ、文面確認・営業コーチでの新規人物選択、終業後チェックへの反映（コードは存在するが未検証）、RLSの他ユーザー分離の実地テスト（ポリシー設定は静的確認済みだが2アカウントでの相互不可視性は未検証）。
- コミット`69fd73d`。Issue #15に完了報告をコメント。

---

## 最終状態

- `main`ブランチ、コミット`69fd73d`（起点`dd2f928`から**14コミット**）。
- `origin/main`へは**未push**（フェーズ1の監査レポートのみpush済み。以降の実装コミットはローカルのみ）。
- 完了Issue: #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #12, #13, #14（13件、コード実装完了）。
- 部分完了Issue: #15（核心フローは実データ検証済みだが、CLAUDE.md記載の28ステップ全網羅には未到達）。
- `npx tsc --noEmit`: 全工程を通じて最終的にエラー0件。
- `grep -rn "想定です" src`: 0件。
- 副産物として作成したworktree: `C:\Users\snomu\dev\referral-sales-map-ai-supabase`（ブランチ`work/supabase-auth`、マージ済みのため今後は不要）。

## 未対応・要フォローアップ

- `origin/main`へのpush（ユーザー承認待ち）。
- 各Issue（#2〜#15）のクローズ（現在は完了コメントのみでオープンのまま）。
- `work/supabase-auth`ブランチと同worktreeディレクトリの削除（マージ済みのため）。
- `docs/new-contact-e2e-checklist.md`で「未実施」とした項目の追加Issue化。
- サインアップ検証中に作成された可能性のあるテスト用未確認ユーザー（`issue14-test@example.com`、Issue #14実装時にAgent Cが作成した可能性ありと報告）のクリーンアップ確認。
