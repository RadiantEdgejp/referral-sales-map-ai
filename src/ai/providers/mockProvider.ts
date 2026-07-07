import { createCoachMockAnswer, createMockAnalysis } from '../../data/mockAnalysis';
import { createAfterMemoSuggestion } from '../../logic/afterMemo';
import { createLineCheckAnalysis, type LineCheckType } from '../../logic/lineCheck';
import { createPreMeetingNavigation } from '../../logic/preMeetingNav';
import type { LlmAdapter } from '../types';

/**
 * 既存のヒューリスティック関数をLlmAdapterインターフェースの下に退避したプロバイダ。
 * Ollama未接続時のフォールバックや開発用に使う。ネットワークを使わないため失敗しない。
 */
export const mockProvider: LlmAdapter = {
  name: 'mock',

  async analyzePerson(input) {
    return createMockAnalysis(input.memo);
  },

  async createPreMeetingNav(input) {
    return createPreMeetingNavigation(input.person, input.actionType);
  },

  async analyzeAfterMemo(input) {
    return createAfterMemoSuggestion(input);
  },

  async analyzeMessageCheck(input) {
    return createLineCheckAnalysis(input.person, input.checkType as LineCheckType, input.text);
  },

  async coachChat(input) {
    return createCoachMockAnswer(input.problem);
  },
};
