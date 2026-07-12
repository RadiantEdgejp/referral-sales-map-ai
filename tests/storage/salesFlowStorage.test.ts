import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Person } from '../../src/types/person';

const db = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    rpc: db.rpc,
  },
}));

vi.mock('../../src/storage/personStorage', () => ({
  requireUserId: vi.fn().mockResolvedValue('user-a'),
  toContactRowId: (userId: string, entityId: string) => `${userId}:${entityId}`,
}));

import {
  buildScheduledSalesFlowRpcArgs,
  createScheduledSalesFlow,
  type CreateScheduledSalesFlowInput,
} from '../../src/storage/salesFlowStorage';

function person(): Person {
  return {
    id: 'contact-1',
    name: '田中さん',
    industry: '美容サロン経営',
    relationship: '交流会で会った',
    categories: [],
    openingTalk: '',
    nextQuestion: '',
    goal: '情報交換を続ける',
    roadmap: [],
    nextAction: '採用事例を共有する',
    lineMessage: '',
    emailMessage: '',
    cautions: '',
    recommendedNextContactAt: '',
    rawMemo: '',
    createdAt: '2026-07-12T00:00:00.000Z',
  };
}

function input(): CreateScheduledSalesFlowInput {
  return {
    person: person(),
    title: '田中さんと情報交換',
    eventType: 'meeting',
    startAt: new Date('2026-07-15T04:00:00.000Z'),
    endAt: new Date('2026-07-15T04:30:00.000Z'),
    purpose: '採用課題を確認する',
    meetingMethod: 'online',
    reminderAt: new Date('2026-07-15T03:30:00.000Z'),
  };
}

describe('scheduled sales flow persistence contract', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-12T00:00:00.000Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0.123456);
    db.rpc.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('builds one linked, user-namespaced RPC payload for route, event, tasks, reminder and log', () => {
    const args = buildScheduledSalesFlowRpcArgs('user-a', input());

    expect(args).toMatchObject({
      p_contact_id: 'user-a:contact-1',
      p_sales_route_id: 'user-a:contact-1-1783814400000-123456-route',
      p_calendar_event_id: 'user-a:contact-1-1783814400000-123456-event',
      p_pre_meeting_task_id: 'user-a:contact-1-1783814400000-123456-pre-task',
      p_after_memo_task_id: 'user-a:contact-1-1783814400000-123456-after-task',
      p_reminder_id: 'user-a:contact-1-1783814400000-123456-reminder',
      p_interaction_log_id: 'user-a:contact-1-1783814400000-123456-log',
      p_event_title: '田中さんと情報交換',
      p_start_at: '2026-07-15T04:00:00.000Z',
      p_end_at: '2026-07-15T04:30:00.000Z',
      p_reminder_at: '2026-07-15T03:30:00.000Z',
    });
  });

  it('rejects an invalid date range before any database call can be made', async () => {
    const invalid = input();
    invalid.endAt = invalid.startAt;

    await expect(createScheduledSalesFlow(invalid)).rejects.toThrow('終了日時');
    expect(db.rpc).not.toHaveBeenCalled();
  });

  it('uses one atomic RPC and returns every linked ID', async () => {
    const expected = {
      contactId: 'user-a:contact-1',
      salesRouteId: 'route-1',
      calendarEventId: 'event-1',
      preMeetingTaskId: 'task-pre-1',
      afterMemoTaskId: 'task-after-1',
      reminderId: 'reminder-1',
      interactionLogId: 'log-1',
    };
    db.rpc.mockResolvedValue({ data: expected, error: null });

    await expect(createScheduledSalesFlow(input())).resolves.toEqual(expected);
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith('create_scheduled_sales_flow', expect.any(Object));
  });

  it('rejects incomplete RPC results instead of reporting a partial save as success', async () => {
    db.rpc.mockResolvedValue({
      data: { contactId: 'user-a:contact-1', calendarEventId: 'event-1' },
      error: null,
    });

    await expect(createScheduledSalesFlow(input())).rejects.toThrow('IDが不足');
  });
});
