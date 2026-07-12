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
const email = `core-flow-${token}@example.com`;
const password = `Core-${token}!aA1`;

const signUp = await client.auth.signUp({ email, password });
assert.equal(signUp.error, null, signUp.error?.message);
assert.ok(signUp.data.user?.id, 'test user was not created');
assert.ok(signUp.data.session, 'local test user did not receive a session');
const userId = signUp.data.user.id;

const id = (value) => `${userId}:${value}-${token}`;
const contactId = id('contact');
const contactInsert = await client.from('contacts').insert({
  id: contactId,
  user_id: userId,
  name: '中核連動テスト',
  industry: '採用支援',
  relationship: '紹介',
  current_goal: '採用課題を確認する',
  next_step: '予定を準備する',
  notes: 'Issue #19 local E2E',
});
assert.equal(contactInsert.error, null, contactInsert.error?.message);

function flowArgs(prefix, override = {}) {
  return {
    p_contact_id: contactId,
    p_sales_route_id: id(`${prefix}-route`),
    p_calendar_event_id: id(`${prefix}-event`),
    p_pre_meeting_task_id: id(`${prefix}-pre-task`),
    p_after_memo_task_id: id(`${prefix}-after-task`),
    p_reminder_id: id(`${prefix}-reminder`),
    p_interaction_log_id: id(`${prefix}-log`),
    p_route_type: 'customer',
    p_route_title: '採用課題確認ルート',
    p_route_goal: '採用課題を確認する',
    p_route_next_step: '予定前ナビを作る',
    p_event_title: '採用課題ヒアリング',
    p_event_type: 'meeting',
    p_start_at: '2026-07-15T04:00:00.000Z',
    p_end_at: '2026-07-15T04:30:00.000Z',
    p_location: null,
    p_meeting_method: 'online',
    p_purpose: '採用課題を確認する',
    p_memo: null,
    p_created_by: 'e2e',
    p_reminder_at: '2026-07-15T03:30:00.000Z',
    ...override,
  };
}

const validArgs = flowArgs('valid');
const created = await client.rpc('create_scheduled_sales_flow', validArgs);
assert.equal(created.error, null, created.error?.message);
assert.equal(created.data.contactId, contactId);
assert.equal(created.data.salesRouteId, validArgs.p_sales_route_id);
assert.equal(created.data.calendarEventId, validArgs.p_calendar_event_id);

const [routes, events, tasks, reminders, logs, contact] = await Promise.all([
  client.from('sales_routes').select('id,contact_id').eq('id', validArgs.p_sales_route_id),
  client.from('calendar_events').select('id,contact_id,sales_route_id').eq('id', validArgs.p_calendar_event_id),
  client.from('action_tasks').select('id,contact_id,sales_route_id,calendar_event_id,status,action_type').eq('calendar_event_id', validArgs.p_calendar_event_id),
  client.from('reminders').select('id,contact_id,sales_route_id,calendar_event_id,action_task_id').eq('id', validArgs.p_reminder_id),
  client.from('interaction_logs').select('id,contact_id,sales_route_id,source_id').eq('id', validArgs.p_interaction_log_id),
  client.from('contacts').select('id,next_contact_date,next_step').eq('id', contactId).single(),
]);
for (const result of [routes, events, tasks, reminders, logs, contact]) {
  assert.equal(result.error, null, result.error?.message);
}
assert.equal(routes.data.length, 1);
assert.equal(events.data[0].sales_route_id, validArgs.p_sales_route_id);
assert.equal(tasks.data.length, 2);
assert.ok(tasks.data.every((row) => row.contact_id === contactId));
assert.ok(tasks.data.every((row) => row.sales_route_id === validArgs.p_sales_route_id));
assert.ok(tasks.data.every((row) => row.calendar_event_id === validArgs.p_calendar_event_id));
assert.equal(reminders.data[0].calendar_event_id, validArgs.p_calendar_event_id);
assert.equal(logs.data[0].sales_route_id, validArgs.p_sales_route_id);
assert.equal(new Date(contact.data.next_contact_date).getTime(), new Date(validArgs.p_start_at).getTime());

const navId = id('nav');
const navSave = await client.rpc('save_linked_pre_meeting_nav', {
  p_nav_id: navId,
  p_contact_id: contactId,
  p_sales_route_id: validArgs.p_sales_route_id,
  p_calendar_event_id: validArgs.p_calendar_event_id,
  p_payload: {
    actionType: 'meeting',
    memo: '',
    purpose: '採用課題を確認する',
    goalToday: '優先課題を一つ確認する',
    conversationPolicy: '聞くことを優先する',
    openingTopic: '最近の採用状況',
    mainQuestions: ['採用で最も困っていることは何ですか？'],
    followUpQuestions: [],
    ngActions: ['課題を決めつけない'],
    shouldSellOrListen: '聞く',
    referralRequestTiming: 'まだ依頼しない',
    itemsToRecordAfter: ['確認できた課題'],
    scientificReason: ['認知負荷を下げる'],
  },
});
assert.equal(navSave.error, null, navSave.error?.message);

const afterMemoId = id('after-memo');
const afterSave = await client.rpc('save_linked_after_memo', {
  p_after_memo_id: afterMemoId,
  p_pre_meeting_nav_id: navId,
  p_contact_id: contactId,
  p_sales_route_id: validArgs.p_sales_route_id,
  p_calendar_event_id: validArgs.p_calendar_event_id,
  p_payload: {
    questionAnswers: [{ question: '採用で最も困っていることは何ですか？', answer: '定着' }],
    freeMemo: '経験者を2名採用したいが時期は未定',
    extractedInfo: { hiring: '2名、経験者重視、時期未定' },
    summary: '経験者2名の採用を検討。定着が課題で時期は未定。',
    updateProposal: '確認済み事実を追加',
    classificationUpdate: {},
    goalUpdate: '採用課題の優先度を確認する',
    nextAction: '定着事例を共有する',
    feedback: '時期未定のため商談化を急がない',
    nextQuestions: ['採用時期を決める条件は何ですか？'],
  },
});
assert.equal(afterSave.error, null, afterSave.error?.message);

const linkedState = await Promise.all([
  client.from('calendar_events').select('pre_meeting_nav_id,after_memo_id,status').eq('id', validArgs.p_calendar_event_id).single(),
  client.from('action_tasks').select('action_type,status').eq('calendar_event_id', validArgs.p_calendar_event_id),
  client.from('sales_routes').select('next_step,current_stage').eq('id', validArgs.p_sales_route_id).single(),
  client.from('contacts').select('next_step').eq('id', contactId).single(),
]);
for (const result of linkedState) assert.equal(result.error, null, result.error?.message);
assert.deepEqual(linkedState[0].data, { pre_meeting_nav_id: navId, after_memo_id: afterMemoId, status: 'completed' });
assert.ok(linkedState[1].data.every((row) => row.status === 'completed'));
assert.equal(linkedState[2].data.next_step, '定着事例を共有する');
assert.equal(linkedState[3].data.next_step, '定着事例を共有する');

const failedArgs = flowArgs('rollback');
failedArgs.p_after_memo_task_id = failedArgs.p_pre_meeting_task_id;
const failed = await client.rpc('create_scheduled_sales_flow', failedArgs);
assert.ok(failed.error, 'forced duplicate task ID should fail');
const rollbackCheck = await Promise.all([
  client.from('sales_routes').select('id').eq('id', failedArgs.p_sales_route_id),
  client.from('calendar_events').select('id').eq('id', failedArgs.p_calendar_event_id),
  client.from('action_tasks').select('id').eq('calendar_event_id', failedArgs.p_calendar_event_id),
]);
assert.ok(rollbackCheck.every((result) => !result.error && result.data.length === 0));

await client.auth.signOut();
const signIn = await client.auth.signInWithPassword({ email, password });
assert.equal(signIn.error, null, signIn.error?.message);
const restored = await client
  .from('calendar_events')
  .select('id,sales_route_id,pre_meeting_nav_id,after_memo_id,status')
  .eq('id', validArgs.p_calendar_event_id)
  .single();
assert.equal(restored.error, null, restored.error?.message);
assert.equal(restored.data.sales_route_id, validArgs.p_sales_route_id);
assert.equal(restored.data.pre_meeting_nav_id, navId);
assert.equal(restored.data.after_memo_id, afterMemoId);
assert.equal(restored.data.status, 'completed');

const otherClient = createClient(url, anonKey, { auth: { persistSession: false } });
const otherToken = randomUUID();
const otherSignUp = await otherClient.auth.signUp({
  email: `core-flow-other-${otherToken}@example.com`,
  password: `Other-${otherToken}!aA1`,
});
assert.equal(otherSignUp.error, null, otherSignUp.error?.message);
assert.ok(otherSignUp.data.session, 'second local test user did not receive a session');
const invisible = await otherClient
  .from('calendar_events')
  .select('id')
  .eq('id', validArgs.p_calendar_event_id);
assert.equal(invisible.error, null, invisible.error?.message);
assert.equal(invisible.data.length, 0, 'another user could read the event');
const foreignWrite = await otherClient.rpc('create_scheduled_sales_flow', flowArgs('foreign'));
assert.ok(foreignWrite.error, 'another user could create a flow for the first user contact');

console.log(JSON.stringify({
  createdIds: created.data,
  linkedTaskCount: tasks.data.length,
  rollbackPreservedCounts: true,
  reLoginRestored: true,
  rlsIsolationVerified: true,
}, null, 2));
