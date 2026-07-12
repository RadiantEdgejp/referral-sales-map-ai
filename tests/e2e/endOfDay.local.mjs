import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
if (!url || !anonKey) {
  throw new Error('SUPABASE_TEST_URL and SUPABASE_TEST_ANON_KEY are required');
}

const client = createClient(url, anonKey, { auth: { persistSession: false } });
const token = randomUUID();
const email = `end-of-day-${token}@example.com`;
const password = `End-${token}!aA1`;
const signUp = await client.auth.signUp({ email, password });
assert.equal(signUp.error, null, signUp.error?.message);
assert.ok(signUp.data.session, 'local test user did not receive a session');
const userId = signUp.data.user.id;
const id = (value) => `${userId}:${value}-${token}`;

const now = new Date();
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const eventStart = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
const eventEnd = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
const tomorrow = new Date(now);
tomorrow.setDate(tomorrow.getDate() + 1);
tomorrow.setHours(9, 0, 0, 0);

const contactId = id('contact');
const routeId = id('route');
const eventId = id('event');
const taskId = id('task');
const memoId = id('memo');
const messageId = id('message');
const gapId = id('gap');

for (const result of [
  await client.from('contacts').insert({
    id: contactId,
    user_id: userId,
    name: '終業後テスト人物',
    industry: '採用支援',
    relationship: '紹介',
    current_goal: '情報交換',
    next_step: '事例共有',
    notes: 'Issue #21 local E2E',
    next_contact_date: null,
  }),
  await client.from('sales_routes').insert({
    id: routeId,
    user_id: userId,
    contact_id: contactId,
    route_type: 'customer',
    title: '情報交換ルート',
    goal: '課題確認',
    next_step: '事例共有',
  }),
  await client.from('calendar_events').insert({
    id: eventId,
    user_id: userId,
    contact_id: contactId,
    sales_route_id: routeId,
    title: '情報交換',
    event_type: 'meeting',
    start_at: eventStart,
    end_at: eventEnd,
    status: 'completed',
  }),
  await client.from('action_tasks').insert({
    id: taskId,
    user_id: userId,
    contact_id: contactId,
    sales_route_id: routeId,
    calendar_event_id: eventId,
    title: '事例を共有する',
    action_type: 'follow_up',
    target_screen: 'message_check',
    due_date: now.toISOString(),
    status: 'open',
    created_from: 'after_memo',
  }),
  await client.from('after_memos').insert({
    id: memoId,
    user_id: userId,
    contact_id: contactId,
    sales_route_id: routeId,
    calendar_event_id: eventId,
    summary: '整理済みだが未保存',
    saved_to_contact: false,
  }),
  await client.from('message_checks').insert({
    id: messageId,
    user_id: userId,
    contact_id: contactId,
    sales_route_id: routeId,
    check_type: 'reply',
    input_text: 'ありがとうございます',
    saved_to_contact: false,
  }),
  await client.from('data_gaps').insert({
    id: gapId,
    user_id: userId,
    contact_id: contactId,
    sales_route_id: routeId,
    gap_type: 'next_contact_date',
    title: '次回連絡日未設定',
    target_screen: 'after_memo',
    status: 'open',
  }),
]) {
  assert.equal(result.error, null, result.error?.message);
}

const before = await Promise.all([
  client.from('action_tasks').select('id').eq('id', taskId).eq('status', 'open'),
  client.from('calendar_events').select('id,after_memo_id').eq('id', eventId),
  client.from('after_memos').select('id').eq('id', memoId).eq('saved_to_contact', false),
  client.from('message_checks').select('id').eq('id', messageId).eq('saved_to_contact', false),
  client.from('data_gaps').select('id').eq('id', gapId).eq('status', 'open'),
]);
for (const result of before) assert.equal(result.error, null, result.error?.message);
assert.ok(before.every((result) => result.data.length === 1), 'real unfinished state was not queryable');

const carried = await client
  .from('action_tasks')
  .update({ due_date: tomorrow.toISOString(), status: 'open', created_from: 'end_of_day' })
  .eq('id', taskId)
  .select('id,due_date,status,created_from')
  .single();
assert.equal(carried.error, null, carried.error?.message);
assert.equal(carried.data.id, taskId);

const carryLogId = id('carry-log');
const carryLog = await client.from('interaction_logs').insert({
  id: carryLogId,
  user_id: userId,
  contact_id: contactId,
  sales_route_id: routeId,
  type: 'task_carried_over',
  title: '事例共有を明日に回した',
  summary: `期限を${tomorrow.toISOString()}へ変更`,
  source_type: 'action_task',
  source_id: taskId,
  happened_at: now.toISOString(),
});
assert.equal(carryLog.error, null, carryLog.error?.message);

const checkId = id('end-of-day');
const check = await client.from('end_of_day_checks').insert({
  id: checkId,
  user_id: userId,
  date: today,
  completed_tasks: [],
  incomplete_tasks: [{ id: taskId, title: '事例を共有する' }],
  completed_events: [{ id: eventId, title: '情報交換' }],
  unresolved_items: [
    { id: eventId, type: '後メモ未入力' },
    { id: memoId, type: '後メモ未保存' },
    { id: messageId, type: '文面確認未保存' },
  ],
  data_gap_ids: [gapId],
  feedback: '未処理を明日へ引き継ぐ',
  tomorrow_theme: '記録漏れを回収する',
  tomorrow_tasks: [taskId],
  status: 'completed',
});
assert.equal(check.error, null, check.error?.message);

await client.auth.signOut();
const signIn = await client.auth.signInWithPassword({ email, password });
assert.equal(signIn.error, null, signIn.error?.message);
const [restoredTask, restoredCheck, restoredLog] = await Promise.all([
  client.from('action_tasks').select('id,due_date,status,created_from').eq('id', taskId).single(),
  client.from('end_of_day_checks').select('id,tomorrow_tasks,status').eq('id', checkId).single(),
  client.from('interaction_logs').select('id,source_id').eq('id', carryLogId).single(),
]);
for (const result of [restoredTask, restoredCheck, restoredLog]) assert.equal(result.error, null, result.error?.message);
assert.equal(restoredTask.data.created_from, 'end_of_day');
assert.equal(new Date(restoredTask.data.due_date).getTime(), tomorrow.getTime());
assert.deepEqual(restoredCheck.data.tomorrow_tasks, [taskId]);
assert.equal(restoredLog.data.source_id, taskId);

const other = createClient(url, anonKey, { auth: { persistSession: false } });
const otherToken = randomUUID();
const otherSignUp = await other.auth.signUp({
  email: `end-of-day-other-${otherToken}@example.com`,
  password: `Other-${otherToken}!aA1`,
});
assert.equal(otherSignUp.error, null, otherSignUp.error?.message);
assert.ok(otherSignUp.data.session);
const invisible = await Promise.all([
  other.from('action_tasks').select('id').eq('id', taskId),
  other.from('end_of_day_checks').select('id').eq('id', checkId),
  other.from('interaction_logs').select('id').eq('id', carryLogId),
]);
for (const result of invisible) {
  assert.equal(result.error, null, result.error?.message);
  assert.equal(result.data.length, 0, 'another user could read Issue #21 data');
}

console.log(
  JSON.stringify(
    {
      realStateSources: ['action_tasks', 'calendar_events', 'after_memos', 'message_checks', 'data_gaps'],
      carriedTaskId: taskId,
      reloadRestored: true,
      endOfDayCheckId: checkId,
      interactionLogId: carryLogId,
      rlsIsolationVerified: true,
    },
    null,
    2,
  ),
);
