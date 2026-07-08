import { supabase } from '../lib/supabaseClient';
import type { ReactionKind } from '../logic/relationshipScore';
import type { Person } from '../types/person';
import { requireUserId, toContactRowId } from './personStorage';

/**
 * 行動→反応の台帳（Interaction Ledger）。
 *
 * 「どんなアクションをして、どんなリアクションが返ってきたか」を
 * `interaction_logs` に構造化イベントとして記録する層。
 *
 * 設計メモ:
 * - 既存スキーマの列だけで表現する（マイグレーション追加なし）。
 *   - `type` 列に `<action>` または `<action>:<reaction>` の統制語彙を保存する
 *     （例: `task_completed:positive`）。JSONを summary に埋めない。
 *   - `title` / `summary` は人間可読の日本語（タイムライン表示にそのまま使う）。
 *   - `source_type` / `source_id` で根拠行（after_memos / message_checks /
 *     action_tasks 等）へリンクする。
 * - スコアのデルタは interaction_logs には持たせず、update_histories 側に
 *   `source_id = このイベントの行ID` として記録する（根拠の一方向リンク）。
 * - 行IDは contacts と同じ `<user_id>:<client_id>` 名前空間方式。
 * - Supabase書き込み失敗時はエラーを投げ、ローカルへフォールバックしない
 *   （CLAUDE.md 4.2）。
 */

export type LedgerAction =
  | 'task_completed'
  | 'meeting_memo'
  | 'message_received'
  | 'message_sent'
  | 'postponed'
  | 'auto_next_contact';

export const LEDGER_ACTION_LABELS: Record<LedgerAction, string> = {
  task_completed: '優先行動を完了',
  meeting_memo: '面談・会話（後メモ）',
  message_received: 'メッセージ受信',
  message_sent: 'メッセージ送信',
  postponed: '延期',
  auto_next_contact: '次回連絡日を自動設定',
};

const REACTION_KINDS: ReactionKind[] = ['positive', 'neutral', 'no_response', 'rejected'];

function newClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export type RecordInteractionInput = {
  person: Person;
  action: LedgerAction;
  reaction?: ReactionKind;
  title: string;
  summary: string;
  sourceType: string;
  sourceId?: string;
  happenedAt?: Date;
};

/** 構造化イベントを1件記録し、行ID（名前空間付き）を返す */
export async function recordInteraction(input: RecordInteractionInput): Promise<string> {
  const userId = await requireUserId();
  const rowId = toContactRowId(userId, newClientId(`${input.person.id}-ixn`));

  const { error } = await supabase.from('interaction_logs').insert({
    id: rowId,
    user_id: userId,
    contact_id: toContactRowId(userId, input.person.id),
    sales_route_id: null,
    type: input.reaction ? `${input.action}:${input.reaction}` : input.action,
    title: input.title,
    summary: input.summary,
    source_type: input.sourceType,
    source_id: input.sourceId ?? null,
    happened_at: (input.happenedAt ?? new Date()).toISOString(),
  });
  if (error) {
    throw new Error(`行動記録の保存に失敗しました: ${error.message}`);
  }

  return rowId;
}

export type TimelineEntry = {
  rowId: string;
  /** 統制語彙のアクション部（未知の値は生のまま返す） */
  action: string;
  /** アクションの日本語ラベル（未知のアクションは type をそのまま表示） */
  actionLabel: string;
  reaction?: ReactionKind;
  title: string;
  summary: string;
  sourceType: string;
  happenedAt: string;
};

function parseType(type: string): { action: string; reaction?: ReactionKind } {
  const [action, reaction] = type.split(':');
  if (reaction && (REACTION_KINDS as string[]).includes(reaction)) {
    return { action, reaction: reaction as ReactionKind };
  }
  return { action: type };
}

/** 指定人物の行動→反応タイムラインを新しい順に返す */
export async function getInteractionTimeline(personId: string, limit = 30): Promise<TimelineEntry[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('interaction_logs')
    .select('id,type,title,summary,source_type,happened_at')
    .eq('user_id', userId)
    .eq('contact_id', toContactRowId(userId, personId))
    .order('happened_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`行動履歴の取得に失敗しました: ${error.message}`);
  }

  return ((data ?? []) as Array<{
    id: string;
    type: string;
    title: string;
    summary: string;
    source_type: string;
    happened_at: string;
  }>).map((row) => {
    const { action, reaction } = parseType(row.type);
    return {
      rowId: row.id,
      action,
      actionLabel: LEDGER_ACTION_LABELS[action as LedgerAction] ?? row.type,
      reaction,
      title: row.title,
      summary: row.summary,
      sourceType: row.source_type,
      happenedAt: row.happened_at,
    };
  });
}
