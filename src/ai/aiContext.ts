import { supabase } from '../lib/supabaseClient';
import { getOpenGaps } from '../storage/dataGapStorage';
import { getInteractionTimeline } from '../storage/interactionLedger';
import { requireUserId, toContactRowId } from '../storage/personStorage';
import type { Person } from '../types/person';
import type { ContactAIContext } from './types';

/**
 * AIContextビルダー（CLAUDE.md 6章）。
 *
 * 指定人物について、Supabaseに蓄積された実データを集約し、
 * すべてのLLM呼び出し（予定前ナビ・後メモ整理・文面確認・営業コーチ・人物分析）
 * のプロンプトへ注入できる形にする。
 *
 * 厳守事項:
 * - すべてのクエリを user_id ＋ contact_id（名前空間付き行ID）で絞る。
 *   別 contact_id の文脈を混入させない（CLAUDE.md 6章の禁止事項）。
 * - 呼び出し直前にSupabaseから読む（古いローカル状態を使わない）。
 * - 取得に失敗した場合はエラーを投げる。中途半端な文脈でAIを走らせない。
 */

const INTERACTION_LIMIT = 15;
const AFTER_MEMO_LIMIT = 3;
const MESSAGE_CHECK_LIMIT = 5;
const TASK_LIMIT = 5;

async function fetchAfterMemoSummaries(userId: string, contactId: string) {
  const { data, error } = await supabase
    .from('after_memos')
    .select('summary,next_action,created_at')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(AFTER_MEMO_LIMIT);
  if (error) {
    throw new Error(`後メモ履歴の取得に失敗しました: ${error.message}`);
  }
  return ((data ?? []) as Array<{ summary: string; next_action: string; created_at: string }>).map((row) => ({
    createdAt: row.created_at,
    summary: row.summary,
    nextAction: row.next_action,
  }));
}

async function fetchTemperatureHistory(userId: string, contactId: string) {
  const { data, error } = await supabase
    .from('message_checks')
    .select('temperature,judgement,created_at')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_CHECK_LIMIT);
  if (error) {
    throw new Error(`文面確認履歴の取得に失敗しました: ${error.message}`);
  }
  return ((data ?? []) as Array<{ temperature: string; judgement: string; created_at: string }>).map((row) => ({
    createdAt: row.created_at,
    temperature: row.temperature,
    judgement: row.judgement,
  }));
}

async function fetchOpenTasks(userId: string, contactId: string) {
  const { data, error } = await supabase
    .from('action_tasks')
    .select('title,due_date,status')
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .eq('status', 'open')
    .order('due_date', { ascending: true })
    .limit(TASK_LIMIT);
  if (error) {
    throw new Error(`未完了タスクの取得に失敗しました: ${error.message}`);
  }
  return ((data ?? []) as Array<{ title: string; due_date: string; status: string }>).map((row) => ({
    title: row.title,
    dueDate: row.due_date,
  }));
}

/**
 * 指定人物のAIContextをSupabase実データから構築する。
 * 全LLM呼び出しは、生成直前にこれを呼んで input.context に渡すこと。
 */
export async function buildContactAIContext(person: Person): Promise<ContactAIContext> {
  const userId = await requireUserId();
  const contactId = toContactRowId(userId, person.id);

  const [interactions, afterMemos, temperatureHistory, openTasks, openGaps] = await Promise.all([
    getInteractionTimeline(person.id, INTERACTION_LIMIT),
    fetchAfterMemoSummaries(userId, contactId),
    fetchTemperatureHistory(userId, contactId),
    fetchOpenTasks(userId, contactId),
    getOpenGaps(person.id),
  ]);

  return {
    contactId: person.id,
    contactName: person.name,
    interactions,
    afterMemoSummaries: afterMemos,
    temperatureHistory,
    openTasks,
    openGaps,
  };
}

export { formatAIContextForPrompt } from './contextFormatter';
