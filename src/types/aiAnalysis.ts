import type { PersonCategory } from './person';
import type { AiGrounding } from '../ai/groundingTypes';

export type AiConfidence = 'low' | 'medium' | 'high';

export type SalesTemperature = 'cold' | 'warm' | 'hot' | 'referral_ready';

export type RelationshipStage =
  | 'new_contact'
  | 'first_contact_done'
  | 'information_exchange'
  | 'relationship_building'
  | 'proposal_ready'
  | 'referral_request_ready'
  | 'follow_up'
  | 'dormant';

export type SalesRouteType =
  | 'customer_route'
  | 'referrer_route'
  | 'referral_target_route'
  | 'information_source_route'
  | 'future_candidate_route';

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';

export type QuestionAnswer = {
  question: string;
  answer: string;
};

export type AfterMemoAiInput = {
  personId: string;
  personSnapshot: {
    name: string;
    industry: string;
    relationship: string;
    categories: PersonCategory[];
    currentGoal: string;
    currentNextAction: string;
    cautions: string;
    pastMemoSummary?: string;
    lineCheckSummary?: string;
  };
  preMeetingPlan: {
    actionType: string;
    purpose: string;
    destination: string;
    plannedQuestions: string[];
    recordItems: string[];
  };
  afterMemoInput: {
    questionAnswers: QuestionAnswer[];
    rawConversationMemo: string;
    allCapturedInfo: string;
    userNextActionHypothesis: string;
    lineTranscriptOrDraft?: string;
  };
  createdAt: string;
};

export type ExtractedSalesData = {
  conversationSummary: string;
  customerSituation: string[];
  painPoints: string[];
  impliedProblems: string[];
  desiredOutcomes: string[];
  decisionMakers: string[];
  stakeholders: string[];
  budgetSignals: string[];
  timingSignals: string[];
  referralSignals: string[];
  canIntroduceToUser: string[];
  wantsIntroductionsTo: string[];
  objectionsOrConcerns: string[];
  trustSignals: string[];
  riskFlags: string[];
  missingInformation: string[];
};

export type QualificationAnalysis = {
  temperature: SalesTemperature;
  relationshipStage: RelationshipStage;
  routeTypes: SalesRouteType[];
  referralRequestReadiness: {
    canAskNow: boolean;
    reason: string;
    riskLevel: RiskLevel;
  };
  confidence: AiConfidence;
};

export type PersonCardUpdateProposal = {
  categories: PersonCategory[];
  goal: string;
  nextAction: string;
  nextQuestion: string;
  nextContactAt: string;
  cautions: string;
  memoToAppend: string;
};

export type SalesCoachFeedback = {
  conclusion: string;
  reason: string;
  scientificBasis: string[];
  fieldTranslation: string;
  nextBehavior: string;
};

export type AfterMemoAiOutput = {
  extracted: ExtractedSalesData;
  qualification: QualificationAnalysis;
  personCardUpdate: PersonCardUpdateProposal;
  feedback: SalesCoachFeedback;
  nextActions: Array<{
    label: string;
    purpose: string;
    dueAt: string;
    priority: 'low' | 'medium' | 'high';
  }>;
  lineDraft: string;
  notification: {
    shouldSchedule: boolean;
    scheduledAt?: string;
    title?: string;
    body?: string;
  };
  audit: {
    usedSignals: string[];
    assumptions: string[];
    missingInputs: string[];
    confidence: AiConfidence;
  };
};

export type AfterMemoAiSuggestion = {
  categoryUpdate: string;
  goal: string;
  nextAction: string;
  nextContact: string;
  feedback: string;
  nextQuestion: string;
  lineMessage: string;
  accumulation: string;
  structured?: AfterMemoAiOutput;
  /**
   * AIが抽出した「まだ確認できていない重要事項」。
   * gapType は src/logic/dataGaps.ts の統制語彙に正規化されてから
   * data_gaps へ保存される（未知の値は捨てる）。
   */
  unresolvedGaps?: Array<{ gapType: string; reason?: string }>;
  /** AIが「今回の会話で確認できた」と判断した gapType（統制語彙） */
  resolvedGapTypes?: string[];
  grounding?: AiGrounding;
};
