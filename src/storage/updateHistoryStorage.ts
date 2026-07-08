import { supabase } from '../lib/supabaseClient';
import type { ScoreChange } from '../logic/relationshipScore';
import type { Person } from '../types/person';
import { requireUserId, toContactRowId } from './personStorage';

/**
 * update_histories への「根拠つき変更履歴」の永続化層。
 *
 * スコア変動は必ずここを通して記録する:
 * - updated_fields（jsonb）に [{field, label, old, new, delta}] を保存
 * - summary に理由文（何が起きたから何点動いたか）
 * - source_type / source_id に根拠イベント（interaction_logs の行ID等）
 *
 * これにより「スコアの根拠」画面で、いつ・何が起きて・何点動いたかを
 * 遡って提示できる。
 */

function newClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export type SaveUpdateHistoryInput = {
  person: Person;
  /** 根拠イベントの種類（例: 'interaction_log'） */
  sourceType: string;
  /** 根拠イベントの行ID（interaction_logs.id 等） */
  sourceId?: string;
  /** 理由文（人間可読） */
  summary: string;
  changes: ScoreChange[];
};

export async function saveUpdateHistory(input: SaveUpdateHistoryInput): Promise<string> {
  const userId = await requireUserId();
  const rowId = toContactRowId(userId, newClientId(`${input.person.id}-hist`));

  const { error } = await supabase.from('update_histories').insert({
    id: rowId,
    user_id: userId,
    contact_id: toContactRowId(userId, input.person.id),
    sales_route_id: null,
    source_type: input.sourceType,
    source_id: input.sourceId ?? null,
    summary: input.summary,
    updated_fields: input.changes.map((change) => ({
      field: change.field,
      label: change.label,
      old: change.oldValue,
      new: change.newValue,
      delta: change.delta,
    })),
  });
  if (error) {
    throw new Error(`変更履歴の保存に失敗しました: ${error.message}`);
  }

  return rowId;
}

export type UpdateHistoryEntry = {
  rowId: string;
  summary: string;
  sourceType: string;
  sourceId?: string;
  createdAt: string;
  changes: Array<{ field: string; label: string; old: number; new: number; delta: number }>;
};

/** 指定人物のスコア変動履歴を新しい順に返す */
export async function getUpdateHistories(personId: string, limit = 30): Promise<UpdateHistoryEntry[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('update_histories')
    .select('id,summary,source_type,source_id,updated_fields,created_at')
    .eq('user_id', userId)
    .eq('contact_id', toContactRowId(userId, personId))
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(`変更履歴の取得に失敗しました: ${error.message}`);
  }

  return ((data ?? []) as Array<{
    id: string;
    summary: string;
    source_type: string;
    source_id: string | null;
    updated_fields: Array<{ field: string; label: string; old: number; new: number; delta: number }> | null;
    created_at: string;
  }>).map((row) => ({
    rowId: row.id,
    summary: row.summary,
    sourceType: row.source_type,
    sourceId: row.source_id ?? undefined,
    createdAt: row.created_at,
    changes: Array.isArray(row.updated_fields) ? row.updated_fields : [],
  }));
}
