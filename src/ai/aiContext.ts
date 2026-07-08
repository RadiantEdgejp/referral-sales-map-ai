import { supabase } from '../lib/supabaseClient';
import { getOpenGaps } from '../storage/dataGapStorage';
import { getInteractionTimeline, type TimelineEntry } from '../storage/interactionLedger';
import { requireUserId, toContactRowId } from '../storage/personStorage';
import { getUpdateHistories, type UpdateHistoryEntry } from '../storage/updateHistoryStorage';
import { REACTION_LABELS } from '../logic/relationshipScore';
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
const HISTORY_LIMIT = 8;
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

  const [interactions, afterMemos, temperatureHistory, openTasks, openGaps, scoreHistory] = await Promise.all([
    getInteractionTimeline(person.id, INTERACTION_LIMIT),
    fetchAfterMemoSummaries(userId, contactId),
    fetchTemperatureHistory(userId, contactId),
    fetchOpenTasks(userId, contactId),
    getOpenGaps(person.id),
    getUpdateHistories(person.id, HISTORY_LIMIT),
  ]);

  return {
    contactId: person.id,
    contactName: person.name,
    interactions,
    afterMemoSummaries: afterMemos,
    temperatureHistory,
    openTasks,
    openGaps,
    scoreHistory,
  };
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatInteraction(entry: TimelineEntry): string {
  const reaction = entry.reaction ? `→反応:${REACTION_LABELS[entry.reaction]}` : '';
  const summary = entry.summary ? ` ${entry.summary.slice(0, 80)}` : '';
  return `- ${formatDate(entry.happenedAt)} ${entry.actionLabel}${reaction}${summary}`;
}

function formatGap(gap: { title: string; reason: string }): string {
  return `- ${gap.title}（${gap.reason}）`;
}

function formatHistory(entry: UpdateHistoryEntry): string {
  const fields = entry.changes.map((change) => `${change.label}${change.delta > 0 ? '+' : ''}${change.delta}`).join('・');
  return `- ${formatDate(entry.createdAt)} ${fields || 'スコア変動'}：${entry.summary.slice(0, 60)}`;
}

/**
 * AIContextをプロンプト注入用の日本語テキストへ整形する（上限つき）。
 * 蓄積が無い項目は「まだ記録なし」と明示し、AIに捏造の余地を与えない。
 */
export function formatAIContextForPrompt(context?: ContactAIContext): string {
  if (!context) {
    return '';
  }

  const sections: string[] = [];

  sections.push(
    context.interactions.length > 0
      ? `直近の行動と相手の反応（新しい順）:\n${context.interactions.map(formatInteraction).join('\n')}`
      : '直近の行動と相手の反応: まだ記録なし',
  );

  if (context.afterMemoSummaries.length > 0) {
    sections.push(
      `過去の面談メモ要約（新しい順）:\n${context.afterMemoSummaries
        .map((memo) => `- ${formatDate(memo.createdAt)} ${memo.summary.slice(0, 120)}${memo.nextAction ? `（次: ${memo.nextAction.slice(0, 40)}）` : ''}`)
        .join('\n')}`,
    );
  }

  if (context.temperatureHistory.length > 0) {
    sections.push(
      `メッセージの温度感履歴（新しい順）:\n${context.temperatureHistory
        .map((item) => `- ${formatDate(item.createdAt)} 温度感:${item.temperature} ${item.judgement.slice(0, 60)}`)
        .join('\n')}`,
    );
  }

  if (context.openTasks.length > 0) {
    sections.push(`未完了タスク:\n${context.openTasks.map((task) => `- ${task.title}（期限 ${formatDate(task.dueDate)}）`).join('\n')}`);
  }

  sections.push(
    context.openGaps.length > 0
      ? `まだ確認できていない重要事項（質問はこれを埋めることを優先する）:\n${context.openGaps.map(formatGap).join('\n')}`
      : 'まだ確認できていない重要事項: なし（基本質問でよい）',
  );

  if (context.scoreHistory.length > 0) {
    sections.push(`関係性スコアの変動履歴:\n${context.scoreHistory.map(formatHistory).join('\n')}`);
  }

  return `【この人物の蓄積データ（Supabase実データ。捏造禁止。ここに無い事実を作らない）】\n${sections.join('\n\n')}`;
}
