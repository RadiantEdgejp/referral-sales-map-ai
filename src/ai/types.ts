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

/**
 * CLAUDE.md 6章のAIContext。src/ai/aiContext.ts の buildContactAIContext が
 * Supabase実データから構築し、全LLM呼び出しのプロンプトへ注入する。
 * 別 contact_id のcontextを渡してはならない。
 */
export type ContactAIContext = {
  contactId: string;
  contactName: string;
  /** 行動→反応の台帳（interaction_logs、新しい順） */
  interactions: Array<{
    rowId: string;
    action: string;
    actionLabel: string;
    reaction?: 'positive' | 'neutral' | 'no_response' | 'rejected';
    title: string;
    summary: string;
    sourceType: string;
    happenedAt: string;
  }>;
  /** after_memos の要約（新しい順） */
  afterMemoSummaries: Array<{ createdAt: string; summary: string; nextAction: string }>;
  /** message_checks の温度感履歴（新しい順） */
  temperatureHistory: Array<{ createdAt: string; temperature: string; judgement: string }>;
  /** 未完了 action_tasks */
  openTasks: Array<{ title: string; dueDate: string }>;
  /** 未解決 data_gaps（質問生成の根拠） */
  openGaps: Array<{ gapType: string; title: string; reason: string; createdAt: string }>;
  /** update_histories（スコア変動の根拠履歴） */
  scoreHistory: Array<{
    rowId: string;
    summary: string;
    sourceType: string;
    createdAt: string;
    changes: Array<{ field: string; label: string; old: number; new: number; delta: number }>;
  }>;
};

export type PersonAnalysisInput = {
  memo: string;
};

export type PreMeetingNavInput = {
  person?: Person;
  actionType: string;
  memo?: string;
  /** 蓄積データ（buildContactAIContextで構築。personと同一contactのもの） */
  context?: ContactAIContext;
};

export type PreMeetingNavigation = {
  purpose: string;
  destination: string;
  policy: string;
  opening: string;
  questions: string[];
  /** 各質問の根拠（questionsと同じ並び。例:「決裁フローが未確認」） */
  questionReasons: string[];
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
  /** 蓄積データ（buildContactAIContextで構築。personと同一contactのもの） */
  context?: ContactAIContext;
};

export type MessageCheckInput = {
  person?: Person;
  checkType: string;
  text: string;
  /** 蓄積データ（buildContactAIContextで構築。personと同一contactのもの） */
  context?: ContactAIContext;
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
  /**
   * 直近の会話履歴（古い順）。マルチターンの文脈維持に使う（CLAUDE.md 5.7）。
   * 省略時は単発相談として扱う（後方互換）。
   */
  history?: Array<{ question: string; answer: string }>;
  /** 蓄積データ（buildContactAIContextで構築。personと同一contactのもの） */
  context?: ContactAIContext;
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
