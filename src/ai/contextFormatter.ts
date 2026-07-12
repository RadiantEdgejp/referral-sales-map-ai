import type { ContactAIContext } from './types';

const bullet = (items: string[]) => items.length ? items.map((item) => `- ${item}`).join('\n') : '- なし';
const compact = (value: string, max = 140) => value.replace(/\s+/g, ' ').trim().slice(0, max);

export function formatAIContextForPrompt(context?: ContactAIContext): string {
  if (!context) return '';

  const sections = [
    `【現在の人物情報】\n業種: ${context.contact.industry}\n関係性: ${context.contact.relationship}\n現在のゴール: ${context.contact.currentGoal}\n次の一手: ${context.contact.nextStep}`,
    `【確認済みの事実】\n${bullet(context.confirmedFacts)}`,
    `【仮説（断定禁止）】\n${bullet(context.hypotheses)}`,
    `【未確認事項（次に確認する候補）】\n${bullet(context.unknowns)}`,
    `【営業上の注意】\n${bullet(context.cautions)}`,
  ];
  if (context.salesRoute) {
    sections.push(`【営業ルート】\n種別: ${context.salesRoute.routeType}\n段階: ${context.salesRoute.currentStage}\nゴール: ${context.salesRoute.goal}\n次の一手: ${context.salesRoute.nextStep}`);
  }
  if (context.calendarEvent) {
    sections.push(`【対象予定】\n${context.calendarEvent.title} / ${context.calendarEvent.startAt}\n目的: ${context.calendarEvent.purpose}\n状態: ${context.calendarEvent.status}`);
  }
  if (context.preMeetingNav) {
    sections.push(`【保存済み予定前ナビ】\n目的: ${context.preMeetingNav.purpose}\n質問:\n${bullet(context.preMeetingNav.mainQuestions)}`);
  }
  if (context.afterMemoSummaries.length) {
    sections.push(`【直近の後メモ（新しい順）】\n${context.afterMemoSummaries.map((memo) => `- ${memo.createdAt}: ${compact(memo.summary)} / 次: ${compact(memo.nextAction, 80)}`).join('\n')}`);
  }
  if (context.temperatureHistory.length) {
    sections.push(`【直近の文面確認（新しい順）】\n${context.temperatureHistory.map((item) => `- ${item.createdAt}: 温度感=${item.temperature}; 判断=${compact(item.judgement, 100)}; 次=${compact(item.nextAction, 80)}`).join('\n')}`);
  }
  if (context.interactions.length) {
    sections.push(`【直近の操作・接触履歴（新しい順）】\n${context.interactions.map((item) => `- ${item.happenedAt}: ${item.title}; ${compact(item.summary, 100)}`).join('\n')}`);
  }
  if (context.updateHistories.length) {
    sections.push(`【直近の更新履歴】\n${context.updateHistories.map((item) => `- ${item.createdAt}: ${compact(item.summary, 100)}`).join('\n')}`);
  }
  if (context.openGaps.length) {
    sections.push(`【未解決の抜け漏れ】\n${context.openGaps.map((gap) => `- [${gap.severity}] ${gap.title}: ${compact(gap.reason, 100)}`).join('\n')}`);
  }

  return `以下は同一人物についてSupabaseに保存済みのAI参照コンテキストです。新しい履歴を優先してください。確認済み事実と仮説を混同せず、未確認事項は断定せず質問候補として扱ってください。\n\n${sections.join('\n\n')}`;
}
