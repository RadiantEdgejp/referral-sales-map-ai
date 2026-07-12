import type { Person } from '../types/person';
import { createScheduledSalesFlow } from './salesFlowStorage';

export type AutoFollowUpInput = {
  person: Person;
  dueDate: Date;
  reason: string;
};

export type AutoFollowUpResult = {
  actionTaskId: string;
  afterMemoTaskId: string;
  reminderId: string;
  interactionLogId: string;
  salesRouteId: string;
  calendarEventId: string;
};

export const FOLLOW_UP_ACTION_TYPE = 'follow_up';
export const FOLLOW_UP_CREATED_FROM = 'auto_next_contact_rule';

/**
 * Persist an automatically scheduled follow-up as a complete linked flow.
 * The database RPC creates SalesRoute, CalendarEvent, both ActionTasks,
 * Reminder and InteractionLog atomically and updates Contact.next_contact_date.
 */
export async function createAutoFollowUp(input: AutoFollowUpInput): Promise<AutoFollowUpResult> {
  const { person, dueDate, reason } = input;
  const endAt = new Date(dueDate.getTime() + 30 * 60 * 1000);
  const nextStep = person.nextAction || '次回連絡の内容を決めて連絡する';
  const honorificName = person.name.endsWith('さん') ? person.name : `${person.name}さん`;

  const flow = await createScheduledSalesFlow({
    person,
    title: `${honorificName}へフォローアップ連絡`,
    eventType: FOLLOW_UP_ACTION_TYPE,
    startAt: dueDate,
    endAt,
    purpose: reason,
    routeType: 'follow_up',
    routeTitle: `${honorificName}とのフォローアップ`,
    routeGoal: person.goal || '関係を前に進める',
    routeNextStep: nextStep,
    meetingMethod: 'message',
    memo: reason,
    createdBy: FOLLOW_UP_CREATED_FROM,
    reminderAt: dueDate,
  });

  return {
    actionTaskId: flow.preMeetingTaskId,
    afterMemoTaskId: flow.afterMemoTaskId,
    reminderId: flow.reminderId,
    interactionLogId: flow.interactionLogId,
    salesRouteId: flow.salesRouteId,
    calendarEventId: flow.calendarEventId,
  };
}
