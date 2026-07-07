import type { AfterMemoAiSuggestion } from '../types/aiAnalysis';
import type { Person, PersonAnalysis } from '../types/person';

export type LlmProviderName = 'ollama' | 'mock';

export type LlmErrorKind = 'network' | 'timeout' | 'invalid_output' | 'config';

/**
 * AI呼び出しの失敗を表すエラー。
 * UI側はこのエラーを受けたら「DBへの書き込みを行わず」エラー表示だけを行う。
 */
export class LlmError extends Error {
  readonly kind: LlmErrorKind;

  constructor(kind: LlmErrorKind, message: string) {
    super(message);
    this.name = 'LlmError';
    this.kind = kind;
  }
}

/**
 * Adapterの戻り値。どのプロバイダが生成したかを常に持ち回り、
 * Mockへのフォールバック時はUI側で「モック分析」であることを明示できるようにする。
 */
export type LlmResult<T> = {
  data: T;
  provider: LlmProviderName;
  usedFallback: boolean;
};

export type PersonAnalysisInput = {
  memo: string;
};

export type PreMeetingNavInput = {
  person?: Person;
  actionType: string;
  memo?: string;
};

export type PreMeetingNavigation = {
  purpose: string;
  destination: string;
  policy: string;
  opening: string;
  questions: string[];
  deepQuestions: string[];
  ngActions: string[];
  sellOrAsk: string;
  referralTiming: string;
  recordItems: string[];
  evidence: string[];
  coachPrompt: string;
};

export type AfterMemoSuggestionInput = {
  person?: Person;
  answers: Record<string, string>;
  talkMemo: string;
  allInfoMemo: string;
  nextTodo: string;
};

export type MessageCheckInput = {
  person?: Person;
  checkType: string;
  text: string;
};

export type LineCheckAnalysis = {
  judgement: string;
  temperature: { label: string; reason: string };
  extracted: Array<{ label: string; value: string }>;
  nextQuestion: string;
  questionPurpose: string;
  replyDraft: string;
  cardUpdate: string;
  categoryUpdate: string;
  nextAction: string;
  nextContact: string;
  caution: string;
  feedbackGood: string;
  feedbackImprove: string;
  coachPrompt: string;
};

export type CoachChatInput = {
  problem: string;
  person?: Person;
};

export type CoachAnswer = {
  conclusion: string;
  reason: string;
  evidence: string;
  translation: string;
  nextAction: string;
};

/**
 * UI/logic層が依存してよい唯一のAIインターフェース。
 * プロバイダ実装（Ollama等）をUIコンポーネントから直接importしてはならない。
 */
export type LlmAdapter = {
  readonly name: LlmProviderName;
  analyzePerson(input: PersonAnalysisInput): Promise<PersonAnalysis>;
  createPreMeetingNav(input: PreMeetingNavInput): Promise<PreMeetingNavigation>;
  analyzeAfterMemo(input: AfterMemoSuggestionInput): Promise<AfterMemoAiSuggestion>;
  analyzeMessageCheck(input: MessageCheckInput): Promise<LineCheckAnalysis>;
  coachChat(input: CoachChatInput): Promise<CoachAnswer>;
};
