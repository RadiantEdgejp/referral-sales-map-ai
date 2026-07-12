import { supabase } from '../lib/supabaseClient';
import type { GapType } from '../logic/dataGaps';
import { isGapType } from '../logic/dataGaps';
import type { Person } from '../types/person';
import { requireUserId, toContactRowId } from './personStorage';

/**
 * data_gaps（未確認の重要事項）の永続化層。
 *
 * 設計メモ:
 * - 行IDは `<user_id>:<personId>-gap-<gapType>` の決定的ID。
 *   同じ人物×同じギャップ種別は常に1行になり、二重生成しない。
 * - 一度 resolved になったギャップは upsert で勝手に open に戻さない
 *   （再オープンは将来の明示操作に限る）。
 * - Supabase書き込み失敗時はエラーを投げる（CLAUDE.md 4.2）。
 */

function gapRowId(userId: string, personId: string, gapType: GapType): string {
  return toContactRowId(userId, `${personId}-gap-${gapType}`);
}

export type OpenGap = {
  gapType: GapType;
  title: string;
  reason: string;
  createdAt: string;
};

/** 指定人物の未解決ギャップ（status=open）を返す */
export async function getOpenGaps(personId: string): Promise<OpenGap[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('data_gaps')
    .select('gap_type,title,reason,created_at')
    .eq('user_id', userId)
    .eq('contact_id', toContactRowId(userId, personId))
    .eq('status', 'open')
    .order('created_at', { ascending: true });
  if (error) {
    throw new Error(`未確認事項の取得に失敗しました: ${error.message}`);
  }

  return ((data ?? []) as Array<{ gap_type: string; title: string; reason: string; created_at: string }>)
    .filter((row) => isGapType(row.gap_type))
    .map((row) => ({
      gapType: row.gap_type as GapType,
      title: row.title,
      reason: row.reason,
      createdAt: row.created_at,
    }));
}

/**
 * 未確認ギャップを追加する。既に行が存在する種別（open/resolved問わず）は
 * スキップし、新規の種別だけ INSERT する。
 */
export async function addOpenGaps(
  person: Person,
  gaps: Array<{ gapType: GapType; title: string; reason: string }>,
): Promise<number> {
  if (gaps.length === 0) return 0;
  const userId = await requireUserId();
  const contactId = toContactRowId(userId, person.id);
  const candidateIds = gaps.map((gap) => gapRowId(userId, person.id, gap.gapType));

  const { data: existing, error: fetchError } = await supabase
    .from('data_gaps')
    .select('id')
    .in('id', candidateIds);
  if (fetchError) {
    throw new Error(`未確認事項の照会に失敗しました: ${fetchError.message}`);
  }
  const existingIds = new Set(((existing ?? []) as Array<{ id: string }>).map((row) => row.id));

  const rows = gaps
    .filter((gap) => !existingIds.has(gapRowId(userId, person.id, gap.gapType)))
    .map((gap) => ({
      id: gapRowId(userId, person.id, gap.gapType),
      user_id: userId,
      contact_id: contactId,
      sales_route_id: null,
      gap_type: gap.gapType,
      title: gap.title,
      reason: gap.reason,
      severity: 'medium',
      target_screen: 'PersonDetail',
      status: 'open',
    }));
  if (rows.length === 0) return 0;

  const { error } = await supabase.from('data_gaps').insert(rows);
  if (error) {
    throw new Error(`未確認事項の保存に失敗しました: ${error.message}`);
  }
  return rows.length;
}

/** 確認できた種別のギャップを resolved に更新する（open のものだけ） */
export async function resolveGaps(person: Person, gapTypes: GapType[]): Promise<number> {
  if (gapTypes.length === 0) return 0;
  const userId = await requireUserId();
  const ids = gapTypes.map((gapType) => gapRowId(userId, person.id, gapType));

  const { data, error } = await supabase
    .from('data_gaps')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .in('id', ids)
    .eq('status', 'open')
    .select('id');
  if (error) {
    throw new Error(`未確認事項の解決記録に失敗しました: ${error.message}`);
  }
  return (data ?? []).length;
}
