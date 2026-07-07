import type { Person } from '../types/person';
import { formatDateTime } from '../utils/date';
import { formatTime, getDueState, priorityScore } from './personPriority';

export type TodayAction = {
  id: string;
  priority: string;
  personName: string;
  personId: string;
  actionType: string;
  shortReason: string;
  todayTodo: string;
  purpose: string;
  question: string;
  message: string;
};

const PRIORITY_LABELS = ['最優先', '重要', '次点'];

export function createTodayActions(people: Person[]): TodayAction[] {
  const ranked = [...people].sort((a, b) => priorityScore(b) - priorityScore(a)).slice(0, 3);

  return ranked.map((person, index) => {
    const due = getDueState(person);
    const actionType =
      due === 'today' ? '今日連絡' : due === 'overdue' ? '連絡遅れ' : due === 'upcoming' ? '準備' : '連絡日未設定';
    const shortReason =
      due === 'today'
        ? `今日${formatTime(person.nextContactAt)}が次回連絡のタイミングです`
        : due === 'overdue'
          ? `次回連絡日（${formatDateTime(person.nextContactAt)}）を過ぎています。関係が冷える前に接触する`
          : due === 'upcoming'
            ? `次回連絡日は${formatDateTime(person.nextContactAt)}。今日は準備を進める`
            : '次回連絡日が未設定です。放置を防ぐため今日決める';

    return {
      id: `action-${person.id}`,
      priority: PRIORITY_LABELS[index] ?? '次点',
      personName: person.name,
      personId: person.id,
      actionType,
      shortReason,
      todayTodo: person.nextAction || person.openingTalk || '次アクションを決める',
      purpose: person.goal,
      question: person.nextQuestion,
      message: person.lineMessage,
    };
  });
}
