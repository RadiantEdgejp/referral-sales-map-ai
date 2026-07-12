import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('予定フォームは単一RPCのcreateScheduledSalesFlowを実行する', async () => {
  const source = await read('src/screens/home/ScheduleModal.tsx');
  assert.match(source, /await createScheduledSalesFlow\(\{/);
  assert.match(source, /onSaved\(selected, flow, openPreMeeting\)/);
  assert.doesNotMatch(source, /\.from\(['"]calendar_events/);
});

test('HomeはContactから擬似タスクを生成せずaction_tasksを取得する', async () => {
  const home = await read('src/screens/HomeScreen.tsx');
  assert.match(home, /getOpenActionTasks\(\)/);
  assert.doesNotMatch(home, /createTodayActions/);
  assert.match(home, /tasks=\{tasks\}/);
});

test('完了と延期はActionTaskの永続化関数を通る', async () => {
  const pane = await read('src/screens/home/HomePane.tsx');
  assert.match(pane, /await completeActionTask\(task\.id\)/);
  assert.match(pane, /await postponeActionTask\(task\.id, tomorrow\)/);
});

test('作成済みevent/route IDを予定前ナビと後メモへ引き継ぐ', async () => {
  const home = await read('src/screens/HomeScreen.tsx');
  const pre = await read('src/screens/home/PreMeetingPane.tsx');
  const after = await read('src/screens/home/AfterMemoPane.tsx');
  assert.match(home, /salesRouteId=\{flowContext\?\.salesRouteId\}/);
  assert.match(home, /calendarEventId=\{flowContext\?\.calendarEventId\}/);
  assert.match(pre, /savePreMeetingNav\(\{ person: selectedPerson, actionType, memo, nav, salesRouteId, calendarEventId \}\)/);
  assert.match(after, /salesRouteId: activeHandoff\?\.salesRouteId/);
  assert.match(after, /calendarEventId: activeHandoff\?\.calendarEventId/);
  assert.match(home, /getAfterMemoHandoffForEvent\(task\.calendarEventId\)/);
});
