import { supabase } from '../lib/supabaseClient';
import type { Person } from '../types/person';
import { requireUserId, toContactRowId } from './personStorage';

/**
 * Issue #16: 次回連絡日の自動設定に伴うフォローアップ行の作成。
 *
 * `action_tasks` / `reminders` / `interaction_logs` へ、新規人物の
 * フォローアップ一式を anon key + RLS 経由で書き込む（CLAUDE.md 5.1）。
 *
 * 設計メモ:
 * - 行IDは contacts と同じ `<user_id>:<client_id>` 名前空間方式。
 *   client_id を人物IDから決定的に導出することで、同一人物への
 *   二重作成（リトライ時など）を主キー衝突として検出できる。
 * - anon key ではトランザクションを張れないため、FK依存順
 *   （action_task → reminder → interaction_log）に逐次INSERTする。
 *   途中で失敗した場合は部分作成のままエラーを投げる（呼び出し側で通知）。
 * - Supabase書き込み失敗時にローカルへフォールバックしない（CLAUDE.md 4.2）。
 */

export type AutoFollowUpInput = {
  person: Person;
  /** 自動設定された次回連絡日時 */
  dueDate: Date;
  /** interaction_logs に残す自動決定の理由 */
  reason: string;
};

export type AutoFollowUpResult = {
  actionTaskId: string;
  reminderId: string;
  interactionLogId: string;
};

export const FOLLOW_UP_ACTION_TYPE = 'follow_up';
export const FOLLOW_UP_CREATED_FROM = 'auto_next_contact_rule';

export async function createAutoFollowUp(input: AutoFollowUpInput): Promise<AutoFollowUpResult> {
  const { person, dueDate, reason } = input;
  const userId = await requireUserId();
  const contactRowId = toContactRowId(userId, person.id);
  const actionTaskId = toContactRowId(userId, `${person.id}-followup-task`);
  const reminderId = toContactRowId(userId, `${person.id}-followup-reminder`);
  const interactionLogId = toContactRowId(userId, `${person.id}-followup-log`);
  const dueIso = dueDate.toISOString();
  const nextStep = person.nextAction || '次回連絡の内容を決めて接触する';

  const { error: taskError } = await supabase.from('action_tasks').insert({
    id: actionTaskId,
    user_id: userId,
    contact_id: contactRowId,
    sales_route_id: null,
    calendar_event_id: null,
    title: `${person.name}さんへフォローアップ連絡`,
    action_type: FOLLOW_UP_ACTION_TYPE,
    priority: '重要',
    reason,
    today_goal: person.goal || '関係を前に進める',
    next_step: nextStep,
    target_screen: 'PersonDetail',
    due_date: dueIso,
    status: 'open',
    created_from: FOLLOW_UP_CREATED_FROM,
  });
  if (taskError) {
    throw new Error(`フォローアップタスクの作成に失敗しました: ${taskError.message}`);
  }

  const { error: reminderError } = await supabase.from('reminders').insert({
    id: reminderId,
    user_id: userId,
    contact_id: contactRowId,
    sales_route_id: null,
    calendar_event_id: null,
    action_task_id: actionTaskId,
    title: `${person.name}さんに連絡する日です`,
    body: nextStep,
    scheduled_at: dueIso,
    status: 'scheduled',
    source_type: FOLLOW_UP_CREATED_FROM,
    notification_timing: 'at_time',
  });
  if (reminderError) {
    throw new Error(`リマインダーの作成に失敗しました: ${reminderError.message}`);
  }

  const { error: logError } = await supabase.from('interaction_logs').insert({
    id: interactionLogId,
    user_id: userId,
    contact_id: contactRowId,
    sales_route_id: null,
    type: 'auto_next_contact',
    title: '次回連絡日を自動設定',
    summary: reason,
    source_type: 'action_task',
    source_id: actionTaskId,
    happened_at: new Date().toISOString(),
  });
  if (logError) {
    throw new Error(`自動設定ログの記録に失敗しました: ${logError.message}`);
  }

  return { actionTaskId, reminderId, interactionLogId };
}
