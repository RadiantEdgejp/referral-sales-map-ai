/**
 * 予定に接ぎ木するルーティン通知の計画ロジック。
 *
 * 営業マンが最も自然にアプリへ戻る瞬間は「商談の直前」と「商談の直後」なので、
 * 予定を保存したときに、その2点へローカル通知を仕込む。純粋関数として
 * 発火時刻・文面・遷移先ペイロードだけを組み立て、実際のスケジューリング
 * （expo-notifications 呼び出し）は notificationService 側の副作用に委ねる。
 * これは autoFollowUp と同じ「計画は純粋・副作用は分離」の作法。
 */

export const PRE_MEETING_LEAD_MINUTES = 30;
export const AFTER_MEMO_DELAY_MINUTES = 30;

const MINUTE_MS = 60 * 1000;

export type MeetingReminderKind = 'pre_meeting' | 'after_memo';

/** 通知タップ後に該当画面へ戻すためのペイロード（deep-link で参照）。 */
export type MeetingReminderPayload = {
  kind: MeetingReminderKind;
  calendarEventId: string;
  personId: string;
};

export type MeetingReminderPlanEntry = {
  kind: MeetingReminderKind;
  fireAt: Date;
  title: string;
  body: string;
  data: MeetingReminderPayload;
};

export type BuildMeetingReminderPlanInput = {
  now: Date;
  personName: string;
  personId: string;
  calendarEventId: string;
  startAt: Date;
  endAt: Date;
};

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

/**
 * 予定の開始30分前（予定前ナビへの呼び戻し）と終了30分後（後メモへの呼び戻し）の
 * 通知計画を組み立てる。既に過ぎている時刻の通知は「予約しても即発火して意味がない」
 * ため計画から除外する（例: 直前に登録された予定では予定前通知だけ落ちる）。
 */
export function buildMeetingReminderPlan(
  input: BuildMeetingReminderPlanInput,
): MeetingReminderPlanEntry[] {
  const { now, personName, personId, calendarEventId, startAt, endAt } = input;

  if (!isValidDate(startAt) || !isValidDate(endAt) || !isValidDate(now)) {
    return [];
  }

  const name = personName.trim() || 'この相手';
  const preAt = new Date(startAt.getTime() - PRE_MEETING_LEAD_MINUTES * MINUTE_MS);
  const afterAt = new Date(endAt.getTime() + AFTER_MEMO_DELAY_MINUTES * MINUTE_MS);

  const candidates: MeetingReminderPlanEntry[] = [
    {
      kind: 'pre_meeting',
      fireAt: preAt,
      title: `${name}さんとの予定が近づいています`,
      body: `開始${PRE_MEETING_LEAD_MINUTES}分前です。今日の3つの質問を確認しましょう。`,
      data: { kind: 'pre_meeting', calendarEventId, personId },
    },
    {
      kind: 'after_memo',
      fireAt: afterAt,
      title: `${name}さんとの予定はどうでしたか？`,
      body: '30秒で後メモを残しましょう。相手の反応を1つ選ぶだけでも大丈夫です。',
      data: { kind: 'after_memo', calendarEventId, personId },
    },
  ];

  return candidates.filter((entry) => entry.fireAt.getTime() > now.getTime());
}
