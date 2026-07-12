import { formatDateTime } from '../utils/date';
import { nextContactDate } from './nextContact';

export const AUTO_FOLLOW_UP_DAYS = 3;
export const AUTO_FOLLOW_UP_HOUR = 9;

export type AutoFollowUpPlan = {
  dueDate: Date;
  reason: string;
};

export function hasValidNextContact(value?: string): boolean {
  if (!value) {
    return false;
  }
  return !Number.isNaN(new Date(value).getTime());
}

/** Initial rule for a new contact without an explicit next-contact date. */
export function buildAutoFollowUpPlan(): AutoFollowUpPlan {
  const dueDate = nextContactDate(AUTO_FOLLOW_UP_DAYS, AUTO_FOLLOW_UP_HOUR);
  const reason =
    `次回連絡日が未入力だったため、初期ルール（${AUTO_FOLLOW_UP_DAYS}日後 ` +
    `${AUTO_FOLLOW_UP_HOUR}:00）を適用し、${formatDateTime(dueDate.toISOString())} に設定しました。`;
  return { dueDate, reason };
}
