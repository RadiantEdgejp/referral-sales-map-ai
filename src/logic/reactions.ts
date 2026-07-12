/**
 * 相手の反応（リアクション）の種別と、それに基づく決定的ルール。
 *
 * 反応は「行動→反応の台帳（interaction_logs）」に記録され、
 * 次回連絡日の間隔を決める根拠になる。数値スコアには変換しない
 * （恣意的な点数化は根拠が弱いため廃止した。関係の進み具合は
 * 行動と反応のタイムライン・分類・未確認事項で表現する）。
 */

export type ReactionKind = 'positive' | 'neutral' | 'no_response' | 'rejected';

export const REACTION_LABELS: Record<ReactionKind, string> = {
  positive: '好反応',
  neutral: '普通',
  no_response: '反応なし',
  rejected: '断られた',
};

/** リアクション種別ごとの次回連絡日ルール（好反応→短め、反応なし→長め） */
export const REACTION_NEXT_CONTACT_DAYS: Record<ReactionKind, number> = {
  positive: 1,
  neutral: 3,
  no_response: 7,
  rejected: 14,
};

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
