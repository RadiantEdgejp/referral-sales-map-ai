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
    const result = createPreMeetingNavigation(input.person, input.actionType, input.context);
    return {
      ...result,
      grounding: {
        confirmedFacts: [input.person?.rawMemo, input.memo].filter((item): item is string => Boolean(item?.trim())),
        hypotheses: input.person?.categories.map((category) => `${category}としての可能性`) ?? [],
        unknowns: input.context?.openGaps.map((gap) => gap.title) ?? [],
        cautions: [input.person?.cautions].filter((item): item is string => Boolean(item?.trim())),
      },
    };
  },

  async analyzeAfterMemo(input) {
    const result = createAfterMemoSuggestion(input);
    const confirmedFacts = [...Object.values(input.answers), input.talkMemo, input.allInfoMemo].filter((item) => item.trim());
    return {
      ...result,
      accumulation: [result.accumulation, ...confirmedFacts.map((fact) => `確認済み：${fact}`)].join('\n'),
      grounding: {
        confirmedFacts,
        hypotheses: [],
        unknowns: result.unresolvedGaps?.map((gap) => gap.reason ?? gap.gapType) ?? [],
        cautions: [input.person?.cautions].filter((item): item is string => Boolean(item?.trim())),
      },
    };
  },

  async analyzeMessageCheck(input) {
    const result = createLineCheckAnalysis(input.person, input.checkType as LineCheckType, input.text);
    return {
      ...result,
      grounding: {
        confirmedFacts: [input.text],
        hypotheses: [],
        unknowns: result.extracted.filter((item) => item.value === '未確認').map((item) => item.label),
        cautions: [result.caution],
      },
    };
  },

  async coachChat(input) {
    return createCoachMockAnswer(input.problem);
  },
};
