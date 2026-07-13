import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AFTER_MEMO_DELAY_MINUTES,
  PRE_MEETING_LEAD_MINUTES,
  buildMeetingReminderPlan,
} from '../../src/logic/meetingReminders';

const baseInput = {
  personName: '田中太郎',
  personId: 'person-1',
  calendarEventId: 'event-1',
};

describe('meeting reminder plan', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 13, 9, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('予定前は開始30分前、予定後は終了30分後に発火する', () => {
    expect(PRE_MEETING_LEAD_MINUTES).toBe(30);
    expect(AFTER_MEMO_DELAY_MINUTES).toBe(30);

    const startAt = new Date(2026, 6, 13, 13, 0, 0);
    const endAt = new Date(2026, 6, 13, 14, 0, 0);
    const plan = buildMeetingReminderPlan({ now: new Date(), startAt, endAt, ...baseInput });

    expect(plan).toHaveLength(2);
    const pre = plan.find((entry) => entry.kind === 'pre_meeting');
    const after = plan.find((entry) => entry.kind === 'after_memo');
    expect(pre?.fireAt).toEqual(new Date(2026, 6, 13, 12, 30, 0));
    expect(after?.fireAt).toEqual(new Date(2026, 6, 13, 14, 30, 0));
  });

  it('通知タップ用のペイロードに種別・予定ID・人物IDを載せる', () => {
    const startAt = new Date(2026, 6, 13, 13, 0, 0);
    const endAt = new Date(2026, 6, 13, 14, 0, 0);
    const plan = buildMeetingReminderPlan({ now: new Date(), startAt, endAt, ...baseInput });

    const pre = plan.find((entry) => entry.kind === 'pre_meeting');
    expect(pre?.data).toEqual({ kind: 'pre_meeting', calendarEventId: 'event-1', personId: 'person-1' });
    expect(pre?.title).toContain('田中太郎');
  });

  it('既に過ぎた発火時刻は予約しても意味がないので計画から除外する', () => {
    // 現在 9:00。開始 9:20 の予定 → 予定前(8:50)は過去なので落ち、予定後だけ残る。
    const startAt = new Date(2026, 6, 13, 9, 20, 0);
    const endAt = new Date(2026, 6, 13, 10, 0, 0);
    const plan = buildMeetingReminderPlan({ now: new Date(), startAt, endAt, ...baseInput });

    expect(plan.map((entry) => entry.kind)).toEqual(['after_memo']);
  });

  it('不正な日時では計画を作らない', () => {
    const plan = buildMeetingReminderPlan({
      now: new Date(),
      startAt: new Date('invalid'),
      endAt: new Date('invalid'),
      ...baseInput,
    });
    expect(plan).toEqual([]);
  });

  it('人物名が空でも代替表記でクラッシュしない', () => {
    const startAt = new Date(2026, 6, 13, 13, 0, 0);
    const endAt = new Date(2026, 6, 13, 14, 0, 0);
    const plan = buildMeetingReminderPlan({
      now: new Date(),
      startAt,
      endAt,
      ...baseInput,
      personName: '   ',
    });
    expect(plan[0]?.title).toContain('この相手');
  });
});
