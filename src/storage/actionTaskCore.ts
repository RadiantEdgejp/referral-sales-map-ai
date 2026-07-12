export type PersistedActionTask = {
  id: string;
  personId: string;
  salesRouteId: string;
  calendarEventId: string;
  title: string;
  actionType: string;
  priority: string;
  reason: string;
  todayGoal: string;
  nextStep: string;
  targetScreen: string;
  dueDate: string;
  status: string;
  createdFrom: string;
};

const WORKFLOW_COMPLETION_TYPES = new Set(['pre_meeting', 'after_memo']);

export function requiresWorkflowSave(task: Pick<PersistedActionTask, 'actionType'>): boolean {
  return WORKFLOW_COMPLETION_TYPES.has(task.actionType);
}

export type ActionTaskClient = { from: (table: string) => any };

type ActionTaskRow = {
  id: string; contact_id: string; sales_route_id: string | null; calendar_event_id: string | null;
  title: string; action_type: string; priority: string; reason: string; today_goal: string; next_step: string;
  target_screen: string; due_date: string; status: string; created_from: string;
};

function personId(userId: string, rowId: string) {
  const prefix = `${userId}:`;
  return rowId.startsWith(prefix) ? rowId.slice(prefix.length) : rowId;
}

function mapTask(userId: string, row: ActionTaskRow): PersistedActionTask | null {
  if (!row.sales_route_id || !row.calendar_event_id) return null;
  return { id: row.id, personId: personId(userId, row.contact_id), salesRouteId: row.sales_route_id, calendarEventId: row.calendar_event_id,
    title: row.title, actionType: row.action_type, priority: row.priority, reason: row.reason, todayGoal: row.today_goal,
    nextStep: row.next_step, targetScreen: row.target_screen, dueDate: row.due_date, status: row.status, createdFrom: row.created_from };
}

export async function getOpenActionTasksWithClient(
  client: ActionTaskClient,
  userId: string,
  now = new Date(),
): Promise<PersistedActionTask[]> {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const { data, error } = await client.from('action_tasks')
    .select('id,contact_id,sales_route_id,calendar_event_id,title,action_type,priority,reason,today_goal,next_step,target_screen,due_date,status,created_from')
    .eq('user_id', userId)
    .in('status', ['open', 'pending'])
    .lte('due_date', endOfToday.toISOString())
    .order('due_date', { ascending: true });
  if (error) throw new Error(`今日やることの取得に失敗しました: ${error.message}`);
  return ((data ?? []) as ActionTaskRow[]).map((row) => mapTask(userId, row)).filter((task): task is PersistedActionTask => task !== null);
}

export async function completeActionTaskWithClient(client: ActionTaskClient, userId: string, taskId: string): Promise<void> {
  const { data, error } = await client.from('action_tasks').update({ status: 'completed' }).eq('id', taskId).eq('user_id', userId)
    .in('status', ['open', 'pending'])
    .not('action_type', 'in', '("pre_meeting","after_memo")')
    .select('id').single();
  if (error || !data) {
    throw new Error(`今日やることの完了に失敗しました: ${error?.message ?? '予定前ナビ・後メモは画面内で保存してください'}`);
  }
}

export async function postponeActionTaskWithClient(client: ActionTaskClient, userId: string, taskId: string, nextDueDate: Date): Promise<void> {
  const { data, error } = await client.from('action_tasks').update({ due_date: nextDueDate.toISOString(), status: 'open' }).eq('id', taskId)
    .eq('user_id', userId).in('status', ['open', 'pending']).select('id').single();
  if (error || !data) throw new Error(`今日やることの延期に失敗しました: ${error?.message ?? '対象がありません'}`);
}

export async function getCalendarEventsWithClient(client: ActionTaskClient, userId: string) {
  const { data, error } = await client.from('calendar_events').select('id,contact_id,sales_route_id,title,start_at,end_at,purpose,status')
    .eq('user_id', userId).order('start_at', { ascending: true });
  if (error) throw new Error(`予定の取得に失敗しました: ${error.message}`);
  return ((data ?? []) as Array<Record<string, string | null>>).filter((row) => row.sales_route_id).map((row) => ({
    id: row.id!, personId: personId(userId, row.contact_id!), salesRouteId: row.sales_route_id!, title: row.title!,
    startAt: row.start_at!, endAt: row.end_at!, purpose: row.purpose ?? '', status: row.status ?? '',
  }));
}

export async function getAfterMemoHandoffForEventWithClient(client: ActionTaskClient, userId: string, calendarEventId: string): Promise<{
  preMeetingNavRowId: string;
  questions: string[];
}> {
  const { data, error } = await client.from('pre_meeting_navs').select('id,main_questions').eq('user_id', userId)
    .eq('calendar_event_id', calendarEventId).order('created_at', { ascending: false }).limit(1).single();
  if (error || !data) throw new Error(`後メモに引き継ぐ予定前ナビの取得に失敗しました: ${error?.message ?? '予定前ナビがありません'}`);
  const questions = Array.isArray(data.main_questions) ? data.main_questions.filter((value: unknown): value is string => typeof value === 'string') : [];
  if (questions.length === 0) throw new Error('保存済みの予定前ナビに質問がありません。');
  return { preMeetingNavRowId: data.id as string, questions };
}
