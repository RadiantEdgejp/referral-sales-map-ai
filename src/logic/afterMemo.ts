import type { AfterMemoAiSuggestion } from '../types/aiAnalysis';
import type { Person } from '../types/person';

export function createAfterMemoQuestions(person?: Person) {
  const industry = person?.industry ?? '相手の業界';

  return [
    `最近、${industry}では集客・採用・固定費のどこが一番重いですか？`,
    '周りの経営者さんも、同じような悩みを持っていますか？',
    '今後どんな人と繋がれると助かりそうですか？',
  ];
}

export function createAfterMemoSuggestion({
  person,
  answers,
  talkMemo,
  allInfoMemo,
  nextTodo,
}: {
  person?: Person;
  answers: Record<string, string>;
  talkMemo: string;
  allInfoMemo: string;
  nextTodo: string;
}): AfterMemoAiSuggestion {
  const name = person?.name ?? 'この人';
  const sourceText = [Object.values(answers).join('\n'), talkMemo, allInfoMemo, nextTodo].join('\n');
  const inferredPain = inferPain(sourceText);
  const inferredTemperature = inferTemperature(sourceText);
  const inferredNextTiming = inferNextTiming(sourceText, inferredTemperature);
  const hasReferralSignal = /紹介|知人|経営者|人脈|つな|繋|周り|サロン|不動産|士業/.test(sourceText);
  const hasDecisionSignal = /決裁|社長|オーナー|代表|予算|いつまで|期限|来月|今月/.test(sourceText);
  const categoryUpdate =
    inferredTemperature === '高' || hasReferralSignal
      ? '紹介元候補 / 情報源候補を強める。顧客候補は会話内容を見て保留。'
      : '情報源候補を維持。紹介依頼は急がず、関係構築を優先。';
  const goal = hasReferralSignal
    ? '相互紹介の可能性を見ながら、情報交換を継続する。'
    : `${person?.industry ?? '相手業界'}の課題理解を深め、次回連絡で関係を温める。`;
  const nextAction = nextTodo || `${inferredNextTiming}に、会話で出た課題に関する情報を1つ送る。`;
  const nextQuestion = inferredPain
    ? `${inferredPain}について、周りでも同じ悩みが出ているか確認する。`
    : '周りの経営者にも同じ悩みがあるか確認する。';

  return {
    categoryUpdate,
    goal,
    nextAction,
    nextContact: inferredNextTiming,
    feedback: `${name}との会話は、売り込みよりも課題確認を優先する段階です。AI推定の温度感は「${inferredTemperature}」。${hasDecisionSignal ? '決裁者・期限・予算の話が出ているため、次回は具体条件を確認できます。' : '決裁者・期限・予算はまだ薄いので、次回は聞き漏れを埋めるのが安全です。'}`,
    nextQuestion,
    lineMessage: `${name}さん、今日はありがとうございました。お話に出ていた${inferredPain || '課題'}の件、こちらでも少し参考になりそうな情報を探してみます。また共有します。`,
    accumulation: [
      inferredPain ? `AI抽出課題：${inferredPain}` : 'AI抽出課題：未確定',
      `AI推定温度感：${inferredTemperature}`,
      `紹介可能性：${hasReferralSignal ? 'ありそう' : '未確定'}`,
      `決裁・期限・予算情報：${hasDecisionSignal ? '一部あり' : '未確認'}`,
      `次回連絡：${inferredNextTiming}`,
    ].join('\n'),
  };
}

function inferPain(text: string) {
  if (/採用|人材|スタッフ|定着/.test(text)) return '採用・人材定着';
  if (/集客|客|広告|SNS|紹介/.test(text)) return '集客・見込み客獲得';
  if (/固定費|コスト|経費|家賃|保険/.test(text)) return '固定費・コスト';
  if (/資金|売上|利益|単価/.test(text)) return '売上・資金繰り';
  if (/人脈|つな|繋|紹介/.test(text)) return '人脈・紹介先';
  return '';
}

function inferTemperature(text: string) {
  if (/ぜひ|お願い|紹介して|会いたい|詳しく|前向き|興味/.test(text)) return '高';
  if (/検討|また|情報|参考|聞きたい|困って/.test(text)) return '中';
  if (/忙しい|今は|不要|断|興味ない|難しい/.test(text)) return '低';
  return '中';
}

function inferNextTiming(text: string, temperature: string) {
  if (/明日|至急|急ぎ|すぐ/.test(text)) return '明日 9:00';
  if (/来週|一週間|1週間/.test(text)) return '1週間後 9:00';
  if (temperature === '高') return '明日 9:00';
  if (temperature === '低') return '1週間後 9:00';
  return '3日後 9:00';
}
