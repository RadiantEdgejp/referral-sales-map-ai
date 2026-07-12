import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/supabaseClient', () => ({ supabase: {} }));
vi.mock('../../src/storage/personStorage', () => ({ requireUserId: vi.fn() }));

import {
  carryActionTasksToTomorrowWithClient,
  completeEndOfDayCheckWithClient,
  type EndOfDayPersistence,
  type EndOfDayReconciliation,
} from '../../src/storage/endOfDayStorage';

const NOW = new Date('2026-07-12T11:00:00.000Z');

function task(id = 'task-1') {
  return {
    id,
    contact_id: 'contact-1',
    sales_route_id: 'route-1',
    calendar_event_id: 'event-1',
    title: '情報交換後の事例共有',
    action_type: 'follow_up',
    due_date: '2026-07-12T00:00:00.000Z',
    status: 'open',
    created_from: 'after_memo',
  };
}

function reconciliation(): EndOfDayReconciliation {
  return {
    date: '2026-07-12',
    contactNames: { 'contact-1': '山本さん' },
    completedTasks: [],
    incompleteTasks: [
      {
        id: 'task-1',
        contactId: 'contact-1',
        salesRouteId: 'route-1',
        calendarEventId: 'event-1',
        title: '情報交換後の事例共有',
        actionType: 'follow_up',
        dueDate: '2026-07-12T00:00:00.000Z',
        status: 'open',
        createdFrom: 'after_memo',
        updatedAt: '2026-07-12T00:00:00.000Z',
      },
    ],
    completedEvents: [],
    savedAfterMemos: [],
    eventsMissingAfterMemo: [],
    unsavedAfterMemos: [],
    unsavedMessageChecks: [],
    contactsMissingNextContact: [],
    unresolvedDataGaps: [],
  };
}

function client(overrides: Partial<EndOfDayPersistence> = {}): EndOfDayPersistence {
  return {
    readTasks: vi.fn().mockResolvedValue([task()]),
    updateTasks: vi.fn().mockResolvedValue([
      { id: 'task-1', contact_id: 'contact-1', sales_route_id: 'route-1', title: '情報交換後の事例共有' },
    ]),
    restoreTask: vi.fn().mockResolvedValue(undefined),
    insertInteractionLogs: vi.fn().mockResolvedValue(undefined),
    upsertInteractionLogs: vi.fn().mockResolvedValue(undefined),
    readEndOfDayCheck: vi.fn().mockResolvedValue(null),
    upsertEndOfDayCheck: vi.fn().mockResolvedValue(undefined),
    deleteEndOfDayCheck: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('Issue #21 終業後チェック永続化', () => {
  it('未完了ActionTaskを明日へ更新し、同じタスクIDのInteractionLogを保存する', async () => {
    const db = client();

    await expect(carryActionTasksToTomorrowWithClient(db, 'user-1', ['task-1'], NOW)).resolves.toEqual(['task-1']);

    expect(db.updateTasks).toHaveBeenCalledWith('user-1', ['task-1'], {
      due_date: '2026-07-13T00:00:00.000Z',
      status: 'open',
      created_from: 'end_of_day',
    });
    expect(db.insertInteractionLogs).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: 'user-1',
        contact_id: 'contact-1',
        sales_route_id: 'route-1',
        source_id: 'task-1',
        type: 'task_carried_over',
      }),
    ]);
  });

  it('操作履歴の保存に失敗したらActionTaskを元の期限・状態・作成元へ戻す', async () => {
    const db = client({ insertInteractionLogs: vi.fn().mockRejectedValue(new Error('log insert failed')) });

    await expect(carryActionTasksToTomorrowWithClient(db, 'user-1', ['task-1'], NOW)).rejects.toThrow(
      'タスク更新を取り消しました',
    );

    expect(db.restoreTask).toHaveBeenCalledWith('user-1', task());
  });

  it('明日送り後に永続ストアを再読込しても同じActionTask IDと明日の期限が残る', async () => {
    let stored = task();
    const db = client({
      readTasks: vi.fn().mockImplementation(async () => [stored]),
      updateTasks: vi.fn().mockImplementation(async (_userId, _ids, patch) => {
        stored = { ...stored, ...patch };
        return [
          { id: stored.id, contact_id: stored.contact_id, sales_route_id: stored.sales_route_id, title: stored.title },
        ];
      }),
    });

    await carryActionTasksToTomorrowWithClient(db, 'user-1', ['task-1'], NOW);
    const reloaded = await db.readTasks('user-1', ['task-1']);

    expect(reloaded[0]).toMatchObject({
      id: 'task-1',
      due_date: '2026-07-13T00:00:00.000Z',
      status: 'open',
      created_from: 'end_of_day',
    });
  });

  it('一部のActionTaskしか更新されなければ全対象を復元して成功扱いにしない', async () => {
    const first = task('task-1');
    const second = task('task-2');
    const db = client({
      readTasks: vi.fn().mockResolvedValue([first, second]),
      updateTasks: vi.fn().mockResolvedValue([
        { id: 'task-1', contact_id: 'contact-1', sales_route_id: 'route-1', title: first.title },
      ]),
    });

    await expect(carryActionTasksToTomorrowWithClient(db, 'user-1', ['task-1', 'task-2'], NOW)).rejects.toThrow(
      '一部のタスクを更新できなかった',
    );
    expect(db.restoreTask).toHaveBeenCalledTimes(2);
    expect(db.insertInteractionLogs).not.toHaveBeenCalled();
  });

  it('完了時に実データのスナップショットと明日タスクIDをEndOfDayCheckへ保存する', async () => {
    const db = client();

    await expect(
      completeEndOfDayCheckWithClient(db, 'user-1', reconciliation(), ['task-1'], '記録漏れなし', NOW),
    ).resolves.toBe('user-1:eod-2026-07-12');

    expect(db.upsertEndOfDayCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'user-1:eod-2026-07-12',
        user_id: 'user-1',
        incomplete_tasks: [{ id: 'task-1', title: '情報交換後の事例共有' }],
        tomorrow_tasks: ['task-1'],
        status: 'completed',
      }),
    );
    expect(db.upsertInteractionLogs).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'end_of_day_completed', source_id: 'user-1:eod-2026-07-12' }),
    ]);
  });

  it('完了ログ保存に失敗したら新規EndOfDayCheckを削除する', async () => {
    const db = client({ upsertInteractionLogs: vi.fn().mockRejectedValue(new Error('log insert failed')) });

    await expect(
      completeEndOfDayCheckWithClient(db, 'user-1', reconciliation(), [], '確認済み', NOW),
    ).rejects.toThrow('終業後チェックを取り消しました');

    expect(db.deleteEndOfDayCheck).toHaveBeenCalledWith('user-1', 'user-1:eod-2026-07-12');
  });

  it('既存EndOfDayCheckの上書き後に失敗したら削除せず以前の内容へ戻す', async () => {
    const previous = {
      id: 'user-1:eod-2026-07-12',
      user_id: 'user-1',
      date: '2026-07-12',
      completed_tasks: [],
      incomplete_tasks: [],
      completed_events: [],
      unresolved_items: [],
      contact_updates: [],
      data_gap_ids: [],
      feedback: '以前の保存内容',
      tomorrow_theme: '以前のテーマ',
      tomorrow_tasks: [],
      status: 'completed',
    };
    const db = client({
      readEndOfDayCheck: vi.fn().mockResolvedValue(previous),
      upsertInteractionLogs: vi.fn().mockRejectedValue(new Error('log insert failed')),
    });

    await expect(
      completeEndOfDayCheckWithClient(db, 'user-1', reconciliation(), ['task-1'], '新しい内容', NOW),
    ).rejects.toThrow('終業後チェックを取り消しました');

    expect(db.upsertEndOfDayCheck).toHaveBeenNthCalledWith(2, previous);
    expect(db.deleteEndOfDayCheck).not.toHaveBeenCalled();
  });
});
