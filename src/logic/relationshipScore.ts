import type { Person } from '../types/person';

/**
 * 根拠つきスコア（grounded score）の決定的ルール。
 *
 * スコア（temperatureScore 等）は「記録されたイベント」経由でのみ変動させる。
 * - リアクション種別ごとのデルタは、この表で固定（AIの気分で動かない）。
 * - AI抽出シグナル（後メモ/文面確認の温度感）による補正は 'ai_signal'
 *   スケールで幅を制限する（ユーザーが直接選んだ反応より小さい）。
 * - すべての変動は 0..100 にクリップし、update_histories に
 *   「旧値・新値・デルタ・理由・根拠イベントID」として記録される
 *   （src/logic/groundedEvents.ts / src/storage/updateHistoryStorage.ts）。
 */

export type ReactionKind = 'positive' | 'neutral' | 'no_response' | 'rejected';

/** direct = ユーザーがリアクションを直接選択 / ai_signal = AI抽出温度感による補正 */
export type DeltaScale = 'direct' | 'ai_signal';

export type ScoreField =
  | 'temperatureScore'
  | 'customerPotential'
  | 'referrerPotential'
  | 'referralTargetPotential'
  | 'informationValue'
  | 'futurePotential';

export const SCORE_FIELD_LABELS: Record<ScoreField, string> = {
  temperatureScore: '温度感',
  customerPotential: '顧客可能性',
  referrerPotential: '紹介元可能性',
  referralTargetPotential: '紹介先可能性',
  informationValue: '情報源価値',
  futurePotential: '将来候補度',
};

export const REACTION_LABELS: Record<ReactionKind, string> = {
  positive: '好反応',
  neutral: '普通',
  no_response: '反応なし',
  rejected: '断られた',
};

const DIRECT_DELTAS: Record<ReactionKind, Partial<Record<ScoreField, number>>> = {
  positive: { temperatureScore: 8, referrerPotential: 4 },
  neutral: { temperatureScore: 2 },
  no_response: { temperatureScore: -3 },
  rejected: { temperatureScore: -15, customerPotential: -10 },
};

const AI_SIGNAL_DELTAS: Record<ReactionKind, Partial<Record<ScoreField, number>>> = {
  positive: { temperatureScore: 5, referrerPotential: 2 },
  neutral: { temperatureScore: 1 },
  no_response: { temperatureScore: -2 },
  rejected: { temperatureScore: -8, customerPotential: -5 },
};

/** リアクション種別ごとの次回連絡日ルール（好反応→短め、反応なし→長め） */
export const REACTION_NEXT_CONTACT_DAYS: Record<ReactionKind, number> = {
  positive: 1,
  neutral: 3,
  no_response: 7,
  rejected: 14,
};

export type ScoreChange = {
  field: ScoreField;
  label: string;
  oldValue: number;
  newValue: number;
  delta: number;
};

function clip(value: number): number {
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * リアクション種別に応じた決定的なスコアデルタを適用する。
 * 変動が0のフィールドは changes に含めない（履歴を汚さない）。
 */
export function applyReactionDeltas(
  person: Person,
  reaction: ReactionKind,
  scale: DeltaScale,
): { next: Person; changes: ScoreChange[] } {
  const table = scale === 'direct' ? DIRECT_DELTAS : AI_SIGNAL_DELTAS;
  const deltas = table[reaction];
  const next: Person = { ...person };
  const changes: ScoreChange[] = [];

  (Object.entries(deltas) as Array<[ScoreField, number]>).forEach(([field, delta]) => {
    const oldValue = person[field];
    const newValue = clip(oldValue + delta);
    if (newValue !== oldValue) {
      next[field] = newValue;
      changes.push({
        field,
        label: SCORE_FIELD_LABELS[field],
        oldValue,
        newValue,
        delta: newValue - oldValue,
      });
    }
  });

  return { next, changes };
}

/** AIの温度感ラベル（文面確認の temperature.label 等）をリアクション種別へ写像する */
export function reactionFromTemperatureLabel(label: string): ReactionKind {
  if (/断/.test(label)) return 'rejected';
  if (/高/.test(label)) return 'positive';
  if (/低/.test(label)) return 'no_response';
  return 'neutral';
}

/**
 * 後メモの入力テキスト（回答・会話メモ）から温度感リアクションを推定する。
 * ユーザー入力の言葉のみを根拠にする決定的規則（AI不要・捏造なし）。
 */
export function inferReactionFromText(text: string): ReactionKind {
  if (/断られ|お断り|断り|不要と|興味ない|もう連絡しないで/.test(text)) return 'rejected';
  if (/ぜひ|前向き|お願いしたい|紹介して|会いたい|詳しく聞きたい|進めたい|乗り気/.test(text)) return 'positive';
  if (/返信なし|未読|反応なし|音沙汰|既読スルー/.test(text)) return 'no_response';
  return 'neutral';
}

/** スコア変動の通知文（Alert等に表示する要約） */
export function formatScoreChanges(changes: ScoreChange[]): string {
  if (changes.length === 0) {
    return 'スコア変動なし';
  }
  return changes
    .map((change) => `${change.label} ${change.oldValue}→${change.newValue}（${change.delta > 0 ? '+' : ''}${change.delta}）`)
    .join(' / ');
}
