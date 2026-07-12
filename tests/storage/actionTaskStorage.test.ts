import { beforeEach, describe, expect, it, vi } from 'vitest';

type Result = { data: unknown; error: { message: string } | null };

const db = vi.hoisted(() => ({
  result: { data: [], error: null } as Result,
  calls: [] as Array<{ table: string; operation: string; payload?: unknown; filters: unknown[] }>,
}));

function query(table: string) {
  const call = { table, operation: 'select', payload: undefined as unknown, filters: [] as unknown[] };
  db.calls.push(call);
  const builder: any = {
    select: (...args: unknown[]) => { call.operation = call.operation === 'update' ? 'update' : 'select'; call.filters.push(['select', ...args]); return builder; },
    update: (payload: unknown) => { call.operation = 'update'; call.payload = payload; return builder; },
    eq: (...args: unknown[]) => { call.filters.push(['eq', ...args]); return builder; },
    in: (...args: unknown[]) => { call.filters.push(['in', ...args]); return builder; },
    lte: (...args: unknown[]) => { call.filters.push(['lte', ...args]); return builder; },
    not: (...args: unknown[]) => { call.filters.push(['not', ...args]); return builder; },
    order: (...args: unknown[]) => { call.filters.push(['order', ...args]); return Promise.resolve(db.result); },
    single: () => Promise.resolve(db.result),
    then: (resolve: (value: Result) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(db.result).then(resolve, reject),
  };
  return builder;
}

vi.mock('../../src/lib/supabaseClient', () => ({ supabase: { from: (table: string) => query(table) } }));
vi.mock('../../src/storage/personStorage', () => ({
  requireUserId: vi.fn().mockResolvedValue('user-a'),
  fromContactRowId: (userId: string, rowId: string) => rowId.replace(`${userId}:`, ''),
}));

import { completeActionTask, getOpenActionTasks, postponeActionTask } from '../../src/storage/actionTaskStorage';
import { requiresWorkflowSave } from '../../src/storage/actionTaskCore';

describe('ActionTask UI persistence', () => {
  beforeEach(() => { db.calls.length = 0; db.result = { data: [], error: null }; });

  it('requires the real workflow save for pre-meeting and after-memo tasks', () => {
    expect(requiresWorkflowSave({ actionType: 'pre_meeting' })).toBe(true);
    expect(requiresWorkflowSave({ actionType: 'after_memo' })).toBe(true);
    expect(requiresWorkflowSave({ actionType: 'follow_up' })).toBe(false);
  });

  it('loads only persisted open tasks and preserves linked route/event IDs', async () => {
    db.result = { data: [{
      id: 'task-1', contact_id: 'user-a:contact-1', sales_route_id: 'route-1', calendar_event_id: 'event-1',
      title: '予定前ナビ', action_type: 'pre_meeting', priority: 'high', reason: '明日の面談準備', today_goal: '質問を決める',
      next_step: 'ナビを作る', target_screen: 'PreMeeting', due_date: '2026-07-13T01:00:00.000Z', status: 'open', created_from: 'user',
    }], error: null };
    await expect(getOpenActionTasks()).resolves.toEqual([expect.objectContaining({
      id: 'task-1', personId: 'contact-1', salesRouteId: 'route-1', calendarEventId: 'event-1',
    })]);
    expect(db.calls[0].filters).toContainEqual(['in', 'status', ['open', 'pending']]);
    expect(db.calls[0].filters).toContainEqual(['lte', 'due_date', expect.any(String)]);
  });

  it('persists completion to action_tasks for the signed-in user', async () => {
    db.result = { data: { id: 'task-1' }, error: null };
    await completeActionTask('task-1');
    expect(db.calls[0]).toMatchObject({ table: 'action_tasks', operation: 'update', payload: { status: 'completed' } });
    expect(db.calls[0].filters).toContainEqual(['eq', 'user_id', 'user-a']);
    expect(db.calls[0].filters).toContainEqual(['not', 'action_type', 'in', '("pre_meeting","after_memo")']);
  });

  it('persists postponement instead of changing Contact.nextContactDate', async () => {
    db.result = { data: { id: 'task-1' }, error: null };
    await postponeActionTask('task-1', new Date('2026-07-14T00:00:00.000Z'));
    expect(db.calls[0]).toMatchObject({ table: 'action_tasks', operation: 'update', payload: { due_date: '2026-07-14T00:00:00.000Z', status: 'open' } });
  });
});
