import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../src/screens/PersonDetailScreen.tsx', import.meta.url), 'utf8');

assert.match(source, /getPersonHistorySummary\(route\.params\.personId\)/, '人物詳細が正規履歴集計を取得していない');
assert.match(source, /historySummary\?\.latestNextStep/, '人物詳細の次の一手が正規履歴の値を優先していない');
for (const field of [
  'afterMemoCount',
  'messageCheckCount',
  'updateHistoryCount',
  'interactionCount',
  'salesRouteCount',
  'unresolvedGapCount',
]) {
  assert.match(source, new RegExp(`historySummary\\.${field}`), `${field}が人物詳細に表示されていない`);
}
assert.doesNotMatch(source, /setHistorySummary\(\{/, '画面独自の履歴件数を作っている');
assert.match(source, /履歴を再読込/, '履歴集計だけ失敗した場合の再試行導線がない');

console.log('Issue #24 person detail integration verified');
