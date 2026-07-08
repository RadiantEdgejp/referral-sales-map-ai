import type { Person } from '../types/person';

/**
 * data_gaps 駆動の「まだ確認できていない重要事項」の統制語彙と決定的な抽出規則。
 *
 * - GapType は data_gaps.gap_type に保存する固定語彙。
 * - deriveGapSignals は「会話テキストに確認済みの言葉が出たか」だけで
 *   resolved / open を判定する（AIの捏造でギャップを閉じない）。
 * - AI（後メモ整理）が unresolvedGaps を返した場合は、この語彙に
 *   合致するものだけをマージする（normalizeAiGaps）。
 */

export const GAP_TYPES = ['decision_maker', 'budget', 'timing', 'referral_intent', 'pain_detail'] as const;
export type GapType = (typeof GAP_TYPES)[number];

export type GapDefinition = {
  title: string;
  reason: string;
  /** 予定前ナビのフォールバック質問（gapを埋める質問） */
  question: (person?: Person) => string;
  /** このシグナルが出たら「確認済み」とみなす */
  resolvedPattern: RegExp;
};

export const GAP_DEFINITIONS: Record<GapType, GapDefinition> = {
  decision_maker: {
    title: '決裁者・決裁フロー',
    reason: '誰が最終決定するか（決裁フロー）が未確認',
    question: () => 'こういった件は、最終的にはどなたが決められるんですか？',
    resolvedPattern: /決裁|社長が決め|代表が決め|オーナーが決め|自分が決め|私が決め|決定権/,
  },
  budget: {
    title: '予算感',
    reason: 'かけられる予算感・コスト感が未確認',
    question: () => '今こういうことに、どのくらい費用をかけているんですか？',
    resolvedPattern: /予算|金額|月額|年間.{0,4}万|万円|コスト感|費用感/,
  },
  timing: {
    title: '導入・検討時期',
    reason: 'いつまでに動きたいか（時期・期限）が未確認',
    question: () => 'その件って、いつ頃までに何とかしたい感じですか？',
    resolvedPattern: /来月|今月|年内|年度|期限|いつまで|四半期|来年|時期は/,
  },
  referral_intent: {
    title: '紹介意欲・周辺人脈',
    reason: '周りに同じ課題の人がいるか・紹介意欲があるかが未確認',
    question: (person) => `周りの${person?.industry ?? '経営者'}の方にも、同じ悩みの方はいますか？`,
    resolvedPattern: /紹介するよ|紹介でき|紹介したい|繋げ|つなげ|周りにいる|知り合いにいる/,
  },
  pain_detail: {
    title: '課題の具体度',
    reason: '課題が具体的にどこまで深刻か（数字・影響）が未確認',
    question: () => 'その課題って、具体的にはどのあたりが一番効いていますか？',
    resolvedPattern: /離職率|売上.{0,4}(減|落)|[0-9０-９]+(人|件|%|％|割)|赤字|利益率/,
  },
};

export function isGapType(value: string): value is GapType {
  return (GAP_TYPES as readonly string[]).includes(value);
}

export type GapSignals = {
  /** テキストに確認済みシグナルが出た項目（resolved にしてよい） */
  resolved: GapType[];
  /** まだ確認できていない項目（open として蓄積する） */
  stillOpen: GapType[];
};

/**
 * 会話テキストからギャップの確認済み/未確認を決定的に判定する。
 * テキストが空（実質会話記録なし）の場合は何も生成しない。
 */
export function deriveGapSignals(text: string): GapSignals {
  const normalized = text.trim();
  if (!normalized) {
    return { resolved: [], stillOpen: [] };
  }

  const resolved: GapType[] = [];
  const stillOpen: GapType[] = [];
  GAP_TYPES.forEach((gapType) => {
    if (GAP_DEFINITIONS[gapType].resolvedPattern.test(normalized)) {
      resolved.push(gapType);
    } else {
      stillOpen.push(gapType);
    }
  });
  return { resolved, stillOpen };
}

export type AiGapSuggestion = {
  gapType: string;
  title?: string;
  reason?: string;
};

/**
 * AI出力の unresolvedGaps を統制語彙へ正規化する。
 * 未知の gap_type は捨てる（自由記述でテーブルを汚さない）。
 */
export function normalizeAiGaps(raw: AiGapSuggestion[] | undefined): Array<{ gapType: GapType; title: string; reason: string }> {
  if (!raw) return [];
  const seen = new Set<GapType>();
  const result: Array<{ gapType: GapType; title: string; reason: string }> = [];
  raw.forEach((item) => {
    if (!isGapType(item.gapType) || seen.has(item.gapType)) return;
    seen.add(item.gapType);
    const definition = GAP_DEFINITIONS[item.gapType];
    result.push({
      gapType: item.gapType,
      title: definition.title,
      reason: item.reason?.trim() || definition.reason,
    });
  });
  return result;
}

/**
 * ギャップが1つも無い場合の既定質問（関係段階に応じたフォールバック）。
 * 予定前ナビは gaps が空のときのみこれを使い、その旨をUIに表示する。
 */
export function buildFallbackQuestions(person?: Person): Array<{ question: string; reason: string }> {
  const industry = person?.industry ?? '相手の業界';
  return [
    {
      question: `最近、${industry}では集客・採用・固定費のどこが一番重いですか？`,
      reason: '未解決の確認事項なし。関係段階に応じた基本質問',
    },
    {
      question: '周りの経営者さんも、同じような悩みを持っていますか？',
      reason: '未解決の確認事項なし。紹介元価値を測る基本質問',
    },
    {
      question: '今後どんな人と繋がれると助かりそうですか？',
      reason: '未解決の確認事項なし。紹介先ニーズを測る基本質問',
    },
  ];
}
