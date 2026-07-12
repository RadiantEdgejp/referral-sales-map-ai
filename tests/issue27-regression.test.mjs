import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('end-of-day after-memo actions carry the exact person and event into Home', async () => {
  const pane = await source('src/screens/home/EndOfDayPane.tsx');
  const home = await source('src/screens/HomeScreen.tsx');
  assert.match(pane, /personId: event\.contactId/);
  assert.match(pane, /calendarEventId: event\.id/);
  assert.match(home, /getAfterMemoHandoffForEvent\(target\.calendarEventId\)/);
  assert.match(home, /personId: target\.personId/);
});

test('workflow tasks cannot expose the generic completion action', async () => {
  const pane = await source('src/screens/home/HomePane.tsx');
  const storage = await source('src/storage/actionTaskCore.ts');
  assert.match(pane, /!requiresWorkflowSave\(task\)/);
  assert.match(storage, /pre_meeting/);
  assert.match(storage, /after_memo/);
  assert.match(storage, /\.not\('action_type', 'in'/);
});

test('home presents persisted loading errors and refresh performs a real reload', async () => {
  const home = await source('src/screens/HomeScreen.tsx');
  const pane = await source('src/screens/home/HomePane.tsx');
  assert.match(home, /setDataError\(message\)/);
  assert.match(home, /void loadData\(\)\s*\.then/);
  assert.match(pane, /営業データを読み込めませんでした/);
  assert.match(pane, /再試行/);
});

test('notification sheets wait for persistence and expose failures', async () => {
  for (const path of ['src/screens/home/PeoplePane.tsx', 'src/screens/home/LineCheckPane.tsx']) {
    const text = await source(path);
    assert.match(text, /保存中\.\.\./);
    assert.match(text, /通知設定に失敗しました/);
    assert.match(text, /setNotificationOpen\(false\)|setNotifyPerson\(null\)/);
  }
});

test('message checks use saved_to_contact as the final commit marker', async () => {
  const storage = await source('src/storage/flowLogStorage.ts');
  const pane = await source('src/screens/home/LineCheckPane.tsx');
  assert.match(storage, /saved_to_contact: false/);
  assert.match(storage, /export async function markMessageCheckSaved/);
  assert.ok(pane.indexOf('markMessageCheckSaved(messageCheckRowId)') > pane.indexOf('addOpenGaps('));
});
