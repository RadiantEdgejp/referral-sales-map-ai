import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_TEST_URL;
const anonKey = process.env.SUPABASE_TEST_ANON_KEY;
if (!url || !anonKey) throw new Error('SUPABASE_TEST_URL and SUPABASE_TEST_ANON_KEY are required');
process.env.EXPO_PUBLIC_SUPABASE_URL = url;
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = anonKey;

const token = randomUUID();
const email = `issue19-ui-${token}@example.com`;
const password = `Issue19-${token}!aA1`;
const authClient = createClient(url, anonKey, { auth: { persistSession: false } });
const signUp = await authClient.auth.signUp({ email, password });
assert.equal(signUp.error, null, signUp.error?.message);
assert.ok(signUp.data.session);
const userId = signUp.data.user.id;

const supabase = authClient;

const person = {
  id: `contact-${token}`,
  name: '田中さん', industry: '美容サロン経営', relationship: '交流会', categories: [],
  openingTalk: '', nextQuestion: '', goal: '情報交換', roadmap: [], nextAction: '採用課題を聞く',
  lineMessage: '', emailMessage: '', cautions: '', recommendedNextContactAt: '', rawMemo: '', createdAt: new Date().toISOString(),
};
const contactId = `${userId}:${person.id}`;
const contactInsert = await supabase.from('contacts').insert({
  id: contactId, user_id: userId, name: person.name, industry: person.industry,
  relationship: person.relationship, current_goal: person.goal, next_step: person.nextAction, notes: person.rawMemo,
});
assert.equal(contactInsert.error, null, contactInsert.error?.message);

const { createScheduledSalesFlowWithClient } = await import('../../src/storage/salesFlowCore.ts');
const { getOpenActionTasksWithClient, getCalendarEventsWithClient, getAfterMemoHandoffForEventWithClient, completeActionTaskWithClient, postponeActionTaskWithClient } = await import('../../src/storage/actionTaskCore.ts');
const flow = await createScheduledSalesFlowWithClient(supabase, userId, {
  person, title: '情報交換', eventType: 'meeting', startAt: new Date('2026-07-15T04:00:00.000Z'),
  endAt: new Date('2026-07-15T04:30:00.000Z'), purpose: '採用課題を確認する', meetingMethod: 'online',
});
const beforeTasks = await getOpenActionTasksWithClient(supabase, userId);
const linked = beforeTasks.filter((task) => task.calendarEventId === flow.calendarEventId);
assert.equal(linked.length, 2);
assert.ok(linked.every((task) => task.salesRouteId === flow.salesRouteId));
const preTask = linked.find((task) => task.actionType === 'pre_meeting');
const afterTask = linked.find((task) => task.actionType === 'after_memo');
assert.ok(preTask && afterTask);

const navId = `${userId}:nav-${token}`;
const navSave = await supabase.rpc('save_linked_pre_meeting_nav', {
  p_nav_id: navId, p_contact_id: contactId, p_sales_route_id: flow.salesRouteId, p_calendar_event_id: flow.calendarEventId,
  p_payload: { actionType: 'meeting', memo: '', purpose: '採用課題を確認する', goalToday: '現状を一つ確認する',
    conversationPolicy: '聞くことを優先する', openingTopic: '最近の採用状況', mainQuestions: ['採用で今いちばん困っていることは何ですか？'],
    followUpQuestions: [], ngActions: ['売り込まない'], shouldSellOrListen: '聞く', referralRequestTiming: 'まだ依頼しない',
    itemsToRecordAfter: ['確認できた課題'], scientificReason: ['認知負荷を下げる'] },
});
assert.equal(navSave.error, null, navSave.error?.message);
const handoff = await getAfterMemoHandoffForEventWithClient(supabase, userId, flow.calendarEventId);
assert.deepEqual(handoff, { preMeetingNavRowId: navId, questions: ['採用で今いちばん困っていることは何ですか？'] });

await postponeActionTaskWithClient(supabase, userId, afterTask.id, new Date('2026-07-16T00:00:00.000Z'));
const persisted = await supabase.from('action_tasks').select('id,status,due_date').in('id', [preTask.id, afterTask.id]);
assert.equal(persisted.error, null, persisted.error?.message);
assert.equal(persisted.data.find((row) => row.id === preTask.id).status, 'completed');
assert.equal(persisted.data.find((row) => row.id === afterTask.id).due_date, '2026-07-16T00:00:00+00:00');

await supabase.auth.signOut();
const signIn = await supabase.auth.signInWithPassword({ email, password });
assert.equal(signIn.error, null, signIn.error?.message);
const restoredEvents = await getCalendarEventsWithClient(supabase, userId);
const restoredTasks = await getOpenActionTasksWithClient(supabase, userId);
assert.ok(restoredEvents.some((event) => event.id === flow.calendarEventId && event.salesRouteId === flow.salesRouteId));
assert.ok(restoredTasks.some((task) => task.id === afterTask.id && task.calendarEventId === flow.calendarEventId));
assert.ok(!restoredTasks.some((task) => task.id === preTask.id));

console.log(JSON.stringify({
  calendarEventId: flow.calendarEventId,
  salesRouteId: flow.salesRouteId,
  createdTaskCount: linked.length,
  completedTaskPersisted: true,
  afterMemoQuestionsRestored: true,
  postponedTaskPersisted: true,
  reloadRestoredEvent: true,
  reloadRestoredOpenTask: true,
}, null, 2));
