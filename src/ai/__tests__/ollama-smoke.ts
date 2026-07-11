import { performance } from 'node:perf_hooks';
import { ollamaProvider } from '../providers/ollamaProvider';
import { assertAfterMemoSafe, assertMessageCheckSafe, assertPreMeetingSafe } from '../safety';
import type { Person } from '../../types/person';

const person: Person = {
  id: 'safety-smoke-yamamoto',
  name: '山本さん',
  industry: '整体院経営',
  relationship: '知人から紹介',
  categories: ['顧客候補', '将来候補'],
  openingTalk: '店舗経営の近況を聞く',
  nextQuestion: '採用面で今困っていることはありますか？',
  goal: '経営課題を確認する',
  roadmap: [],
  nextAction: '情報交換を実施する',
  lineMessage: '',
  emailMessage: '',
  cautions: '売り込みを急がない',
  recommendedNextContactAt: new Date().toISOString(),
  rawMemo: '営業担当は2名を採用したい。経験者を重視している。定着が課題。採用時期は未定。',
  createdAt: new Date().toISOString(),
};

async function run<T>(name: string, execute: () => Promise<T>, validate: (value: T) => void) {
  const started = performance.now();
  let result: T | undefined;
  try {
    result = await execute();
    validate(result);
    console.log(JSON.stringify({ name, ok: true, elapsedMs: Math.round(performance.now() - started), result }, null, 2));
  } catch (error) {
    console.log(JSON.stringify({
      name,
      ok: false,
      elapsedMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
      result,
    }, null, 2));
    process.exitCode = 1;
  }
}

async function main() {
  const selected = process.argv[2] ?? 'all';
  const preInput = { person, actionType: '情報交換前', memo: '採用状況を聞きたい。紹介依頼はしない。' };
  if (selected === 'all' || selected === 'preMeeting') {
    await run('preMeeting', () => ollamaProvider.createPreMeetingNav(preInput), (result) => assertPreMeetingSafe(preInput, result));
  }

  const afterInput = {
    person,
    answers: { '採用人数は？': '営業2名', '採用で重視することは？': '経験者重視' },
    talkMemo: '定着が課題',
    allInfoMemo: '採用時期未定',
    nextTodo: '経験者採用の事例を共有する',
  };
  if (selected === 'all' || selected === 'afterMemo') {
    await run('afterMemo', () => ollamaProvider.analyzeAfterMemo(afterInput), (result) => assertAfterMemoSafe(afterInput, result));
  }

  const messageInput = {
    person,
    checkType: '受信文チェック',
    text: 'ありがとうございます。ちょっと今は忙しいので、またタイミングが合えばお願いします。',
  };
  if (selected === 'all' || selected === 'messageRefusal') {
    await run('messageRefusal', () => ollamaProvider.analyzeMessageCheck(messageInput), (result) => assertMessageCheckSafe(messageInput, result));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
