import { REACTION_LABELS } from '../logic/reactions';
import type { ContactAIContext } from './types';

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatInteraction(entry: ContactAIContext['interactions'][number]): string {
  const reaction = entry.reaction ? `→反応:${REACTION_LABELS[entry.reaction]}` : '';
  const summary = entry.summary ? ` ${entry.summary.slice(0, 80)}` : '';
  return `- ${formatDate(entry.happenedAt)} ${entry.actionLabel}${reaction}${summary}`;
}

function formatGap(gap: { title: string; reason: string }): string {
  return `- ${gap.title}（${gap.reason}）`;
}

/** AIContextをプロンプト注入用の上限付きテキストへ整形する。 */
export function formatAIContextForPrompt(context?: ContactAIContext): string {
  if (!context) return '';

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
  return `【この人物の蓄積データ（Supabase実データ。捏造禁止。ここに無い事実を作らない）】\n${sections.join('\n\n')}`;
}
