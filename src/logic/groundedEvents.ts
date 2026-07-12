import { recordInteraction, type LedgerAction } from '../storage/interactionLedger';
import { updatePerson } from '../storage/personStorage';
import type { Person } from '../types/person';
import type { ReactionKind } from './reactions';

/**
 * 「行動→反応」を1本のイベントとして確定させるオーケストレーション。
 *
 * 順序（意図的）:
 * 1. interaction_logs に行動＋反応イベントを記録（これが根拠の起点）
 * 2. 人物側の変更（メモ追記など）を永続化する
 *
 * 反応は数値スコアに変換しない。関係の進み具合は、行動と反応の
 * タイムライン・分類・未確認事項で表現する（恣意的な点数化は廃止）。
 * 途中で失敗した場合はエラーを投げる（部分確定は呼び出し側に通知される）。
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
};

export type ReactionEventResult = {
  saved: Person;
  ledgerRowId: string;
};

export async function recordReactionEvent(input: ReactionEventInput): Promise<ReactionEventResult> {
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

  // 2. 人物側の変更（メモ追記など）を永続化する
  const saved = await updatePerson(input.person);

  return { saved, ledgerRowId };
}
