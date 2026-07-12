import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; operation: string; payload?: Record<string, unknown>; filters: unknown[] }>,
}));

function from(table: string) {
  const call = { table, operation: 'select', payload: undefined as Record<string, unknown> | undefined, filters: [] as unknown[] };
  state.calls.push(call);
  const builder: any = {
    select: (...args: unknown[]) => { call.filters.push(['select', ...args]); return builder; },
    insert: (payload: Record<string, unknown>) => {
      call.operation = 'insert';
      call.payload = payload;
      return Promise.resolve({ data: null, error: null });
    },
    update: (payload: Record<string, unknown>) => { call.operation = 'update'; call.payload = payload; return builder; },
    eq: (...args: unknown[]) => { call.filters.push(['eq', ...args]); return builder; },
    order: (...args: unknown[]) => { call.filters.push(['order', ...args]); return builder; },
    limit: (...args: unknown[]) => { call.filters.push(['limit', ...args]); return builder; },
    single: () => Promise.resolve({ data: { id: 'message-1' }, error: null }),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve({ data: table === 'sales_routes' ? [{ id: 'route-1' }] : [], error: null }).then(resolve, reject),
  };
  return builder;
}

vi.mock('../../src/lib/supabaseClient', () => ({ supabase: { from } }));
vi.mock('../../src/storage/personStorage', () => ({
  requireUserId: vi.fn().mockResolvedValue('user-1'),
  toContactRowId: (userId: string, id: string) => `${userId}:${id}`,
}));

import { markMessageCheckSaved, saveMessageCheck } from '../../src/storage/flowLogStorage';

const person: any = { id: 'contact-1', name: '田中さん', goal: '情報交換', nextAction: '近況確認' };
const analysis: any = {
  extracted: [],
  temperature: { label: '中', reason: '返信あり' },
  judgement: '関係構築を優先',
  replyDraft: 'ありがとうございます。',
  nextQuestion: '',
  cardUpdate: '返信あり',
  nextAction: '軽く返信する',
  feedbackGood: '押していない',
  feedbackImprove: 'なし',
};

describe('message check commit marker', () => {
  beforeEach(() => { state.calls.length = 0; });

  it('creates the analysis as unsaved until all contact enrichment succeeds', async () => {
    await saveMessageCheck({ person, checkType: '受信文チェック', text: 'ありがとうございます', analysis });
    const insert = state.calls.find((call) => call.table === 'message_checks' && call.operation === 'insert');
    expect(insert?.payload?.saved_to_contact).toBe(false);
  });

  it('marks the exact signed-in row saved only as the final commit step', async () => {
    await markMessageCheckSaved('message-1');
    const update = state.calls.find((call) => call.table === 'message_checks' && call.operation === 'update');
    expect(update?.payload).toEqual({ saved_to_contact: true });
    expect(update?.filters).toContainEqual(['eq', 'user_id', 'user-1']);
    expect(update?.filters).toContainEqual(['eq', 'saved_to_contact', false]);
  });
});
