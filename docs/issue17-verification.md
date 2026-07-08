# Issue #17 検証結果: 新規人物の一気通貫E2E検証

実施日: 2026-07-08
環境: Expo Web (localhost:8081) / Supabase 本番プロジェクト / LLMプロバイダは検証時のみ `mock`
（ローカルOllamaがメモリ不足で応答不能だったため。検証後に `.env.local` から
`EXPO_PUBLIC_LLM_PROVIDER=mock` を削除し、ollamaデフォルトへ復元済み）

テスト人物: CLAUDE.md 7章のテスト人物を人物追加画面の雑メモから新規作成。
雑メモ「新規連動テスト 佐藤さん。連動検証株式会社の営業責任者。人材採用と営業組織づくりに関心あり。」
→ AI整理により名前「佐藤さん」・業種「人材・採用支援」として保存
（mockプロバイダの名前抽出仕様。会社名・役職はcontactsに独立カラムとして保持されない既存仕様）。

- contact_id: `<user_id>:1783478003297`
- user_id: `6821727c-1366-4f95-a8f6-81c552d31820`

## 発見した重大な不具合（本Issue内で修正済み）

**予定前ナビ / 後メモ / 文面確認 / 営業コーチ / 終業後チェックのいずれも、
対応するSupabaseテーブル（`pre_meeting_navs` / `after_memos` / `message_checks` /
`coach_logs` / `end_of_day_checks`）へ一切書き込んでいなかった。**
各画面は `contacts.additional_memo` への追記等のみで完結しており、
Issue #17 受け入れ条件8（各テーブルへの実データ保存）を満たしていなかった。

また、予定前ナビの質問が後メモへ正確に引き継がれず、後メモ側で業種から
汎用質問を再生成していた（CLAUDE.md 5.4「Saved 3 questions must pass exactly
into the after-memo flow」違反）。

### 修正内容

- `src/storage/flowLogStorage.ts`（新規）: 5テーブルへの永続化層。
  行IDは既存規約どおり `<user_id>:<client_id>` 名前空間方式。
  AI成功時のみ保存し、保存失敗時はエラーを投げて成功表示しない（CLAUDE.md 4.2 / 4.4）。
- `PreMeetingPane`: ナビ生成成功時に `pre_meeting_navs` へ保存（status: `created`）。
  「後メモへ進む」でナビの質問列と `pre_meeting_navs` 行IDを後メモへ引き継ぐ。
- `home/types.ts`: 引き継ぎ型 `AfterMemoHandoff` を追加（personIdガード付きで
  別人物への質問混入を防止）。
- `AfterMemoPane`: 引き継ぎ質問を最優先で表示。「人脈カードを更新」時に
  `after_memos` へ保存（`pre_meeting_nav_id` 紐付け、`saved_to_contact: true`）し、
  `pre_meeting_navs.after_memo_id` / `status` を書き戻し。保存失敗時はエラー表示。
- `LineCheckPane`: 「人脈カードに保存」時に `message_checks` へ保存。
- `CoachChatScreen`: 回答成功ごとに `coach_logs` へ保存（人物コンテキスト付き）。
- `EndOfDayPane`: 「終業後チェックを完了する」で `end_of_day_checks` へ
  1日1行のスナップショットをupsert。保存失敗時は完了扱いにしない。
- `followUpStorage.ts`: 人物名が既に「〜さん」で終わる場合にタスク/リマインダー
  タイトルが「佐藤さんさん」と重複する軽微バグを修正。

## 検証手順と結果

| # | 手順 | 結果 |
|---|------|------|
| 0 | 人物追加画面から雑メモ→AI整理→保存で新規人物を作成 | 成功。次回連絡日未入力→3日後9:00（2026/07/11 09:00）自動設定、`action_tasks`・`reminders`・`interaction_logs` に連動行を確認（Issue #16の動作） |
| 1 | 予定前ナビで新規人物を検索・選択（ContactPicker検索） | 成功。「人材」で検索し2件ヒット、新規佐藤さんを選択（業種・分類・次アクション表示で同名人物と区別可能） |
| 2 | アクション種別を選び「今日のナビを作る」 | 成功。目的・到達点・質問3件・NG等が生成され、`pre_meeting_navs` に1行保存 |
| 3 | 「後メモへ進む」で質問引き継ぎ確認 | 成功（修正後）。ナビの `main_questions` 3件が後メモの質問欄に完全一致で表示 |
| 4 | 後メモに回答・会話内容を入力し「AIで整理する」→人脈カードへ反映 | 成功。`after_memos` に1行保存（question_answers に3問3答、`pre_meeting_nav_id` 紐付け、`saved_to_contact: true`）。contacts のゴール・次アクション等が更新 |
| 5 | 文面確認で人物選択→文面入力→AI整理→人脈カードに保存 | 成功。`message_checks` に1行保存（check_type: 受信文チェック、temperature、reply_text等）。contacts へ反映 |
| 6 | 営業コーチで人物選択→複数回のやり取り | 成功。2往復実施し `coach_logs` に2行保存（contact_id・contextに人物名/分類）。回答は選択人物の文脈を反映 |
| 7 | 終業後チェックで新規人物由来の項目確認 | 成功。「今日の人脈カード更新」に佐藤さん（更新済み・次アクション・次回連絡日）、「明日の優先行動」に佐藤さんの次アクションが反映。後メモ保存済みのため「後メモ未入力」には出ない（正しい） |
| 8 | Supabase 5テーブルの実データ確認 | 成功。認証済みセッション（anon key + ユーザーJWT）経由のRESTクエリで確認: `pre_meeting_navs` 1行 / `after_memos` 1行 / `message_checks` 1行 / `coach_logs` 2行 / `end_of_day_checks` 1行。全行の `user_id` がログインユーザーと一致、`contact_id` が新規人物を指す |

## 見つけたが未修正の不具合（軽微・別Issue候補）

1. **営業コーチの人物選択に検索がない**。FilterChipの横並びで名前のみ表示のため、
   同名人物（佐藤さん2名）を区別できない（CLAUDE.md 5.2は「every place that selects
   a person must support search」を要求）。他画面のContactPickerと同等のUIに
   置き換えるべき。
2. mockプロバイダが人物名の敬称を二重に付ける（「佐藤さんさん、ありがとう…」等の文案）。
   mock品質の問題でOllama/実プロバイダでは影響なし。
3. 予定前ナビでアクション種別チップを押した直後に「今日のナビを作る」を同一tickで
   押すと、直前の種別で生成される場合がある（自動操作特有のタイミングで、
   人間の操作では実質再現しない）。
4. 会社名・役職はAI整理結果に含まれても `contacts` の独立カラム
   （company/role）には保存されない（rawMemo内には残る）。スキーマにはカラムが
   存在するためマッピング追加を検討。

## 環境復元

- `.env.local` から `EXPO_PUBLIC_LLM_PROVIDER=mock` を削除済み。
- devサーバーを再起動し、`env: export EXPO_PUBLIC_SUPABASE_ANON_KEY EXPO_PUBLIC_SUPABASE_URL`
  のみがロードされる（＝LLMプロバイダはollamaデフォルト）ことをログで確認済み。

## 型チェック

`npx.cmd tsc --noEmit`: 成功（エラーなし）
