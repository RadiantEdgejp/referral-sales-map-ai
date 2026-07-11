import type { AfterMemoAiSuggestion } from '../types/aiAnalysis';
import type { AfterMemoSuggestionInput, LineCheckAnalysis, MessageCheckInput, PreMeetingNavigation, PreMeetingNavInput } from './types';
import type { AiGrounding } from './groundingTypes';
export type { AiGrounding } from './groundingTypes';

export class AiSafetyError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`AI整理結果が入力内容と矛盾しています。${issues.join(' ')}`);
    this.name = 'AiSafetyError';
    this.issues = issues;
  }
}

const REFUSAL_PATTERNS = [
  /今は(?:必要|不要|難し)/,
  /忙し/,
  /また(?:タイミング|機会|必要になったら)/,
  /今回は(?:見送|遠慮)/,
  /結構です/,
  /お断り/,
];

const PUSHY_ACTION_PATTERNS = [/深掘り/, /提案/, /商談/, /紹介を?依頼/, /質問(?:する|を送る)/, /アポ/, /日程.*確定/];
const PUSHY_REFUSAL_REPLY_PATTERNS = [/改めて.{0,12}(?:相談|連絡|お話)/, /機会をいただ/, /お時間をいただ/, /ご都合.{0,8}(?:伺|教)/];
const COMPLETED_ACTION_PATTERNS = [
  /(?:情報交換|面談|商談|会話|打ち合わせ|ミーティング|予定).{0,8}(?:実施|行う|会う|開始)/,
  /(?:LINE|メール|DM).{0,8}(?:送る|送信)/,
];

function compact(value: string): string {
  return value.replace(/[\s　。、，．・「」『』（）()]/g, '').toLowerCase();
}

function nonEmptyItems(items: string[] | undefined): string[] {
  return (items ?? []).filter((item) => typeof item === 'string' && item.trim().length > 0);
}

function groundingIssues(grounding: AiGrounding | undefined): string[] {
  if (!grounding) return ['事実・仮説・未確認事項の根拠整理がありません。'];
  const issues: string[] = [];
  if (!Array.isArray(grounding.confirmedFacts)) issues.push('確認済み事実が配列ではありません。');
  if (!Array.isArray(grounding.hypotheses)) issues.push('仮説が配列ではありません。');
  if (!Array.isArray(grounding.unknowns)) issues.push('未確認事項が配列ではありません。');
  if (!Array.isArray(grounding.cautions)) issues.push('注意事項が配列ではありません。');
  if ([grounding.confirmedFacts, grounding.hypotheses, grounding.unknowns, grounding.cautions].flat().some((item) => /[{}]/.test(item))) {
    issues.push('根拠整理に壊れたJSON断片が混入しています。');
  }
  return issues;
}

function hasPastExplicitDate(value: string, now: Date): boolean {
  const matches = value.matchAll(/(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})/g);
  for (const match of matches) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999);
    if (!Number.isNaN(date.getTime()) && date.getTime() < now.getTime()) return true;
  }
  return false;
}

function userEvidence(input: AfterMemoSuggestionInput): string[] {
  return [
    ...Object.values(input.answers),
    input.talkMemo,
    input.allInfoMemo,
    input.nextTodo,
  ]
    .flatMap((value) => value.split(/[\n、。・]/))
    .map((value) => value.trim())
    .filter((value) => compact(value).length >= 3);
}

function mentionsEvidence(output: string, evidence: string[]): boolean {
  const normalizedOutput = compact(output);
  return evidence.some((item) => {
    const normalizedItem = compact(item);
    if (normalizedItem.length < 3) return false;
    if (
      normalizedOutput.includes(normalizedItem)
      || normalizedItem.includes(normalizedOutput)
      || normalizedOutput.includes(normalizedItem.slice(0, Math.min(6, normalizedItem.length)))
    ) {
      return true;
    }
    const quantities = normalizedOutput.match(/\d+(?:名|人|件|円|万|月|日)/g) ?? [];
    if (quantities.some((quantity) => normalizedItem.includes(quantity))) return true;
    const pairs = Array.from({ length: Math.max(0, normalizedItem.length - 1) }, (_, index) => normalizedItem.slice(index, index + 2));
    return pairs.length > 0 && pairs.filter((pair) => normalizedOutput.includes(pair)).length / pairs.length >= 0.5;
  });
}

export function assertPreMeetingSafe(input: PreMeetingNavInput, nav: PreMeetingNavigation): void {
  const issues = groundingIssues(nav.grounding);
  const person = input.person;
  if (!nav.purpose.trim()) issues.push('今日の目的が空です。');
  if (nonEmptyItems(nav.questions).length < 1 || nonEmptyItems(nav.questions).length > 3) {
    issues.push('聞く質問は1〜3問に絞る必要があります。');
  }
  if (nonEmptyItems(nav.ngActions).length === 0) issues.push('具体的なNG行動がありません。');
  if (person && nav.grounding?.confirmedFacts.some((fact) => !mentionsEvidence(fact, [person.name, person.company ?? '', person.role ?? '', person.industry, person.relationship, person.rawMemo, person.additionalMemo ?? '', input.memo ?? '']))) {
    issues.push('確認済み事実に入力・蓄積データで裏付けられない内容があります。');
  }
  if (issues.length > 0) throw new AiSafetyError(issues);
}

export function assertAfterMemoSafe(input: AfterMemoSuggestionInput, suggestion: AfterMemoAiSuggestion, now = new Date()): void {
  const issues = groundingIssues(suggestion.grounding);
  const evidence = userEvidence(input);
  const completedAction = COMPLETED_ACTION_PATTERNS.some((pattern) => pattern.test(suggestion.nextAction));

  if (evidence.length === 0) issues.push('会話後の回答またはメモが入力されていません。');
  if (input.nextTodo.trim() && compact(suggestion.nextAction) !== compact(input.nextTodo)) {
    issues.push('ユーザーが指定した次アクションよりAI案が優先されています。');
  }
  if (completedAction) issues.push('完了済みの会話・予定・送信を次アクションへ戻しています。');
  if (hasPastExplicitDate(suggestion.nextAction, now)) issues.push('次アクションに過去日時が含まれています。');
  const sourceText = evidence.join('\n');
  if (/温度感[：:]?(?:高|ホット)/.test(`${suggestion.accumulation}\n${suggestion.feedback}`) && !/(?:前向き|興味|ぜひ|詳しく|お願い|検討したい)/.test(sourceText)) {
    issues.push('会話後入力に前向きな根拠がないのに温度感を高く評価しています。');
  }
  if (evidence.length > 0 && !mentionsEvidence(suggestion.accumulation, evidence)) {
    issues.push('蓄積内容が会話後の回答や自由メモを根拠にしていません。');
  }
  if (suggestion.grounding?.confirmedFacts.some((fact) => !mentionsEvidence(fact, evidence))) {
    issues.push('確認済み事実に会話後入力で裏付けられない内容があります。');
  }
  if (/(?:紹介元候補|紹介先候補)/.test(suggestion.categoryUpdate) && !/(?:紹介|知人|人脈|つな|繋)/.test(sourceText)) {
    issues.push('会話後入力に紹介の根拠がないのに紹介分類を追加しています。');
  }
  if (/(?:可能性が高い|確実|成約見込みが高い)/.test(`${suggestion.categoryUpdate}\n${suggestion.feedback}`) && !/(?:前向き|興味|ぜひ|詳しく|お願い|検討したい)/.test(sourceText)) {
    issues.push('会話後入力に根拠のない強い確度を付けています。');
  }
  if (issues.length > 0) throw new AiSafetyError(issues);
}

export function isRefusalMessage(input: MessageCheckInput): boolean {
  return REFUSAL_PATTERNS.some((pattern) => pattern.test(input.text));
}

export function assertMessageCheckSafe(input: MessageCheckInput, analysis: LineCheckAnalysis): void {
  const issues = groundingIssues(analysis.grounding);
  if (isRefusalMessage(input) && (input.checkType === '受信文チェック' || input.checkType === '断り返信')) {
    if (PUSHY_ACTION_PATTERNS.some((pattern) => pattern.test(`${analysis.nextAction}\n${analysis.nextQuestion}`))) {
      issues.push('断り・保留の相手に追加質問や提案を続けています。');
    }
    if (!/^(?:なし|追加質問なし|質問しない)/.test(analysis.nextQuestion.trim()) && /[？?]|(?:ですか|ますか)/.test(analysis.nextQuestion)) {
      issues.push('断り・保留の相手に追加質問を作っています。');
    }
    if (/明日|本日|今日|すぐ|即日/.test(analysis.nextContact)) {
      issues.push('断り・保留の相手へ早すぎる再接触を提案しています。');
    }
    if (/今は.*(?:忙しい|必要ない)|またタイミング/.test(analysis.replyDraft)) {
      issues.push('相手の発言を送信者側の返信として取り違えています。');
    }
    if (PUSHY_REFUSAL_REPLY_PATTERNS.some((pattern) => pattern.test(`${analysis.judgement}\n${analysis.replyDraft}`))) {
      issues.push('断り・保留への返信文で再接触を求めています。');
    }
  }
  if (COMPLETED_ACTION_PATTERNS.some((pattern) => pattern.test(analysis.nextAction))) {
    issues.push('完了済みの会話・送信を次アクションへ戻しています。');
  }
  const contextEvidence = input.context
    ? [
        ...input.context.afterMemoSummaries.map((item) => item.summary),
        ...input.context.interactions.map((item) => item.summary),
      ]
    : [];
  if (analysis.grounding?.confirmedFacts.some((fact) => !mentionsEvidence(fact, [input.text, input.person?.name ?? '', input.person?.industry ?? '', input.person?.relationship ?? '', input.person?.rawMemo ?? '', input.person?.additionalMemo ?? '', ...contextEvidence]))) {
    issues.push('確認済み事実に対象文面で裏付けられない内容があります。');
  }
  if (issues.length > 0) throw new AiSafetyError(issues);
}
