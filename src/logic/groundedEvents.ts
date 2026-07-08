import { recordInteraction, type LedgerAction } from '../storage/interactionLedger';
import { updatePerson } from '../storage/personStorage';
import { saveUpdateHistory } from '../storage/updateHistoryStorage';
import type { Person } from '../types/person';
import {
  applyReactionDeltas,
  formatScoreChanges,
  REACTION_LABELS,
  type DeltaScale,
  type ReactionKind,
  type ScoreChange,
} from './relationshipScore';

/**
 * 「行動→反応→スコア変動→履歴」を1本のイベントとして確定させるオーケストレーション。
 *
 * 順序（意図的）:
 * 1. interaction_logs に行動＋反応イベントを記録（これが根拠の起点）
 * 2. 決定的デルタ規則でスコアを更新（contacts.scores）
 * 3. update_histories に 旧値/新値/デルタ/理由/根拠イベントID を記録
 *
 * 途中で失敗した場合はエラーを投げる（部分確定は呼び出し側に通知される）。
 * スコアは必ずこの経路（＝記録されたイベント）経由でのみ変動させること。
 */

export type ReactionEventInput = {
  person: Person;
  action: LedgerAction;
  reaction: ReactionKind;
  /** イベントの見出し（例: 優先行動「◯◯」を完了） */
  title: string;
  /** 反応の一言メモ・AI抽出要点など人間可読の本文 */
  summary: string;
  /** 根拠行の種類（'action_task' | 'after_memo' | 'message_check' 等） */
  sourceType: string;
  /** 根拠行のID（after_memos.id 等） */
  sourceId?: string;
  /** direct=ユーザーが反応を直接選択 / ai_signal=AI抽出温度感による補正 */
  scale: DeltaScale;
};

export type ReactionEventResult = {
  saved: Person;
  ledgerRowId: string;
  changes: ScoreChange[];
  /** Alert等に出す変動要約（例: 温度感 55→63（+8）） */
  changeSummary: string;
};

export async function recordReactionEvent(input: ReactionEventInput): Promise<ReactionEventResult> {
  const reactionLabel = REACTION_LABELS[input.reaction];

  // 1. 台帳イベント（行動＋反応）
  const ledgerRowId = await recordInteraction({
    person: input.person,
    action: input.action,
    reaction: input.reaction,
    title: input.title,
    summary: input.summary,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
  });

  // 2. 決定的デルタ規則によるスコア更新
  const { next, changes } = applyReactionDeltas(input.person, input.reaction, input.scale);
  let saved = input.person;
  if (changes.length > 0) {
    saved = await updatePerson(next);

    // 3. 根拠つき変更履歴
    await saveUpdateHistory({
      person: saved,
      sourceType: 'interaction_log',
      sourceId: ledgerRowId,
      summary: `反応「${reactionLabel}」（${input.title}）に基づく規則適用: ${formatScoreChanges(changes)}`,
      changes,
    });
  }

  return {
    saved,
    ledgerRowId,
    changes,
    changeSummary: formatScoreChanges(changes),
  };
}
