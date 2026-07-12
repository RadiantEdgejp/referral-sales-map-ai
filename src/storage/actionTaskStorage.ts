import { supabase } from '../lib/supabaseClient';
import {
  completeActionTaskWithClient,
  getCalendarEventsWithClient,
  getAfterMemoHandoffForEventWithClient,
  getOpenActionTasksWithClient,
  postponeActionTaskWithClient,
  type ActionTaskClient,
  type PersistedActionTask,
} from './actionTaskCore';
import { requireUserId } from './personStorage';

export type { PersistedActionTask } from './actionTaskCore';

export async function getOpenActionTasks(): Promise<PersistedActionTask[]> {
  return getOpenActionTasksWithClient(supabase as unknown as ActionTaskClient, await requireUserId());
}

export async function completeActionTask(taskId: string): Promise<void> {
  return completeActionTaskWithClient(supabase as unknown as ActionTaskClient, await requireUserId(), taskId);
}

export async function postponeActionTask(taskId: string, nextDueDate: Date): Promise<void> {
  return postponeActionTaskWithClient(supabase as unknown as ActionTaskClient, await requireUserId(), taskId, nextDueDate);
}

export async function getCalendarEvents() {
  return getCalendarEventsWithClient(supabase as unknown as ActionTaskClient, await requireUserId());
}

export async function getAfterMemoHandoffForEvent(calendarEventId: string): Promise<{
  preMeetingNavRowId: string;
  questions: string[];
}> {
  return getAfterMemoHandoffForEventWithClient(supabase as unknown as ActionTaskClient, await requireUserId(), calendarEventId);
}
