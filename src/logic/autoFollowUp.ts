import { formatDateTime } from '../utils/date';
import { nextContactDate } from './nextContact';

/**
 * Issue #16 / CLAUDE.md 5.1:
 * 次回連絡日が未入力のまま人物を保存した場合の初期ルール「3日後 9:00」。
 *
 * ホームの「今日の優先行動」（todayActions.ts / personPriority.ts）は
 * `person.nextContactAt` を基準に priorityScore・dueState を計算するため、
 * このルールで next_contact_date を確定させることが、自動生成タスクを
 * ホームに反映させる正規の経路になる（action_tasks.due_date /
 * reminders.scheduled_at も同じ日時を共有する）。
 */

export const AUTO_FOLLOW_UP_DAYS = 3;
export const AUTO_FOLLOW_UP_HOUR = 9;

export type AutoFollowUpPlan = {
  dueDate: Date;
  reason: string;
};

/** 次回連絡日として有効な値（パース可能な日時文字列）が入っているか */
export function hasValidNextContact(value?: string): boolean {
  if (!value) {
    return false;
  }
  return !Number.isNaN(new Date(value).getTime());
}

/** 初期ルール（3日後 9:00）に基づく自動設定プランを作る */
export function buildAutoFollowUpPlan(): AutoFollowUpPlan {
  const dueDate = nextContactDate(AUTO_FOLLOW_UP_DAYS, AUTO_FOLLOW_UP_HOUR);
  const reason =
    `次回連絡日が未入力だったため、初期ルール（${AUTO_FOLLOW_UP_DAYS}日後 ` +
    `${AUTO_FOLLOW_UP_HOUR}:00）を適用して ${formatDateTime(dueDate.toISOString())} に自動設定しました。` +
    'あわせてフォローアップタスクとリマインダーを自動作成しました。';
  return { dueDate, reason };
}
