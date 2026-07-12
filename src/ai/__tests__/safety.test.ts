import assert from 'node:assert/strict';
import test from 'node:test';
import { generateForReview, persistReviewedResult } from '../reviewWorkflow.ts';
import { AiSafetyError, assertAfterMemoSafe, assertMessageCheckSafe, assertPreMeetingSafe } from '../safety.ts';
import type { AfterMemoAiSuggestion } from '../../types/aiAnalysis.ts';
import type { LineCheckAnalysis, PreMeetingNavigation } from '../types.ts';

const grounding = {
  confirmedFacts: ['営業担当は2名で経験者を重視している'],
  hypotheses: ['採用支援の情報が役立つ可能性'],
  unknowns: ['採用時期'],
  cautions: ['採用時期は未定なので商談化を急がない'],
};

function afterSuggestion(overrides: Partial<AfterMemoAiSuggestion> = {}): AfterMemoAiSuggestion {
  return {
    categoryUpdate: '情報源候補を維持する',
    goal: '採用課題の優先度を確認する',
    nextAction: '経験者採用の事例を共有する',
    nextContact: '1週間後 9:00',
    feedback: '採用時期は未定なので商談化を急がない。',
    nextQuestion: '定着で最も困る場面はどこですか？',
    lineMessage: '本日はありがとうございました。参考になる事例を整理して共有します。',
    accumulation: '営業担当は2名。経験者重視。定着が課題。採用時期は未定。',
    grounding,
    ...overrides,
  };
}

function lineAnalysis(overrides: Partial<LineCheckAnalysis> = {}): LineCheckAnalysis {
  return {
    judgement: '短く受け止め、こちらからは追わない。',
    temperature: { label: '低い', reason: '忙しく、再接触の希望が明確ではない。' },
    extracted: [{ label: '状況', value: '現在は忙しい' }],
    nextQuestion: '追加質問なし',
    questionPurpose: '相手の負担を増やさない。',
    replyDraft: '承知しました。ご返信ありがとうございます。また必要なタイミングがあれば、いつでもお声がけください。',
    cardUpdate: '現在は忙しく保留。',
    categoryUpdate: '現状維持。',
    nextAction: '返信後はこちらから追わず、相手からの連絡を待つ。',
    nextContact: '1か月後を目安に状況確認を検討',
    caution: '追加質問をしない。',
    feedbackGood: '相手の意思を尊重している。',
    feedbackImprove: '短く終える。',
    coachPrompt: '引き際を確認したい。',
    grounding: {
      confirmedFacts: ['今は忙しい'],
      hypotheses: ['将来再開できる可能性'],
      unknowns: ['再開時期'],
      cautions: ['深追いしない'],
    },
    ...overrides,
  };
}

test('生成成功だけでは永続化処理を呼ばない', async () => {
  let writes = 0;
  const nav = { purpose: '課題確認' };
  const result = await generateForReview(async () => nav, () => undefined);
  assert.equal(result, nav);
  assert.equal(writes, 0);
  await persistReviewedResult(result, () => undefined, async () => {
    writes += 1;
  });
  assert.equal(writes, 1);
});

test('生成失敗とJSON不正では永続化処理を呼ばない', async () => {
  let writes = 0;
  await assert.rejects(
    generateForReview(async () => JSON.parse('{broken'), () => undefined),
    SyntaxError,
  );
  assert.equal(writes, 0);
  await assert.rejects(
    generateForReview(async () => { throw new Error('network'); }, () => undefined),
    /network/,
  );
  assert.equal(writes, 0);
});

test('予定前ナビは根拠整理がなければ保存されない', async () => {
  let writes = 0;
  const nav = {
    purpose: '採用課題を確認する', destination: '課題の優先度を知る', policy: '聞く', opening: '近況確認',
    questions: ['最近の採用状況はいかがですか？'], questionReasons: ['未確認'], deepQuestions: [],
    ngActions: ['商品説明を始めない'], sellOrAsk: '聞く', referralTiming: 'まだ早い', recordItems: ['課題'],
    evidence: ['認知負荷を下げる'], coachPrompt: '相談',
  } satisfies PreMeetingNavigation;
  await assert.rejects(
    persistReviewedResult(nav, (result) => assertPreMeetingSafe({ actionType: '情報交換前' }, result), async () => { writes += 1; }),
    AiSafetyError,
  );
  assert.equal(writes, 0);
});

test('後メモの固定回帰ケースは事例共有を保存できる', async () => {
  const input = {
    answers: { '採用人数は？': '営業2名', '重視する経験は？': '経験者重視' },
    talkMemo: '定着が課題',
    allInfoMemo: '採用時期未定',
    nextTodo: '経験者採用の事例を共有する',
  };
  let writes = 0;
  const result = afterSuggestion();
  await persistReviewedResult(result, (value) => assertAfterMemoSafe(input, value), async () => { writes += 1; });
  assert.equal(writes, 1);
  assert.match(result.accumulation, /営業担当は2名|営業2名/);
  assert.equal(result.nextAction, input.nextTodo);
});

test('完了済み行動・過去日時・後メモと矛盾する結果はDB差分ゼロ', async () => {
  const input = {
    answers: { '採用人数は？': '営業2名' },
    talkMemo: '経験者重視で定着が課題',
    allInfoMemo: '採用時期未定',
    nextTodo: '経験者採用の事例を共有する',
  };
  let writes = 0;
  const invalid = afterSuggestion({
    nextAction: '2020-01-01に情報交換を実施する',
    accumulation: '予定前ナビに沿って面談する。',
  });
  await assert.rejects(
    persistReviewedResult(invalid, (value) => assertAfterMemoSafe(input, value, new Date('2026-07-12')), async () => { writes += 1; }),
    AiSafetyError,
  );
  assert.equal(writes, 0);
});

test('会話後入力に根拠のない紹介分類はDB差分ゼロ', async () => {
  const input = {
    answers: { '採用人数は？': '営業2名' },
    talkMemo: '経験者重視で定着が課題',
    allInfoMemo: '採用時期未定',
    nextTodo: '経験者採用の事例を共有する',
  };
  let writes = 0;
  const invalid = afterSuggestion({ categoryUpdate: '紹介先候補へ変更する。可能性が高い。' });
  await assert.rejects(
    persistReviewedResult(invalid, (value) => assertAfterMemoSafe(input, value), async () => { writes += 1; }),
    AiSafetyError,
  );
  assert.equal(writes, 0);
});

test('断り文への深追いと話者取り違えはDB差分ゼロ', async () => {
  const input = { checkType: '受信文チェック', text: 'ありがとうございます。今は忙しいので、またタイミングが合えばお願いします。' };
  let writes = 0;
  const invalid = lineAnalysis({
    nextQuestion: '採用課題について詳しく教えてもらえますか？',
    nextAction: '明日、課題を深掘りする質問を送る。',
    nextContact: '明日 9:00',
    replyDraft: 'ありがとうございます。今は忙しいので、またタイミングが合えばお願いします。',
  });
  await assert.rejects(
    persistReviewedResult(invalid, (value) => assertMessageCheckSafe(input, value), async () => { writes += 1; }),
    AiSafetyError,
  );
  assert.equal(writes, 0);
});

test('断り文へ引く回答は保存境界を通過する', async () => {
  const input = { checkType: '受信文チェック', text: 'ありがとうございます。今は忙しいので、またタイミングが合えばお願いします。' };
  let writes = 0;
  await persistReviewedResult(lineAnalysis(), (value) => assertMessageCheckSafe(input, value), async () => { writes += 1; });
  assert.equal(writes, 1);
});

test('断り文で再相談の機会を求める返信はDB差分ゼロ', async () => {
  const input = { checkType: '受信文チェック', text: 'ありがとうございます。今は忙しいので、またタイミングが合えばお願いします。' };
  let writes = 0;
  const invalid = lineAnalysis({ replyDraft: 'ありがとうございます。改めてご相談の機会をいただければ幸いです。' });
  await assert.rejects(
    persistReviewedResult(invalid, (value) => assertMessageCheckSafe(input, value), async () => { writes += 1; }),
    AiSafetyError,
  );
  assert.equal(writes, 0);
});
