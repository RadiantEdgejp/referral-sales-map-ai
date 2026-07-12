import { supabase } from '../lib/supabaseClient';
import { requireUserId } from './personStorage';

const COMPLETED_STATUSES = new Set(['completed', 'complete', 'done', '完了']);
const CANCELLED_STATUSES = new Set(['cancelled', 'canceled', '不要', '中止']);

export type EndOfDayTask = {
  id: string;
  contactId: string | null;
  salesRouteId: string | null;
  calendarEventId: string | null;
  title: string;
  actionType: string;
  dueDate: string;
  status: string;
  createdFrom: string;
  updatedAt: string;
};

export type EndOfDayEvent = {
  id: string;
  contactId: string;
  salesRouteId: string | null;
  title: string;
  startAt: string;
  endAt: string;
  status: string;
  afterMemoId: string | null;
};

export type EndOfDayAfterMemo = {
  id: string;
  contactId: string;
  salesRouteId: string | null;
  calendarEventId: string | null;
  summary: string;
  savedToContact: boolean;
  createdAt: string;
};

export type EndOfDayGap = {
  id: string;
  contactId: string | null;
  title: string;
  gapType: string;
  severity: string;
  targetScreen: string;
};

export type EndOfDayMessageDraft = {
  id: string;
  contactId: string;
  checkType: string;
  createdAt: string;
};

export type EndOfDayContactGap = {
  id: string;
  name: string;
};

export type EndOfDayReconciliation = {
  date: string;
  contactNames: Record<string, string>;
  completedTasks: EndOfDayTask[];
  incompleteTasks: EndOfDayTask[];
  completedEvents: EndOfDayEvent[];
  savedAfterMemos: EndOfDayAfterMemo[];
  eventsMissingAfterMemo: EndOfDayEvent[];
  unsavedAfterMemos: EndOfDayAfterMemo[];
  unsavedMessageChecks: EndOfDayMessageDraft[];
  contactsMissingNextContact: EndOfDayContactGap[];
  unresolvedDataGaps: EndOfDayGap[];
  carriedTaskIds: string[];
};

type TaskRow = {
  id: string;
  contact_id: string | null;
  sales_route_id: string | null;
  calendar_event_id: string | null;
  title: string;
  action_type: string;
  due_date: string;
  status: string;
  created_from: string;
  updated_at: string;
};

type CarryTaskRow = Omit<TaskRow, 'updated_at'>;

type EndOfDayCheckRow = {
  id: string;
  user_id: string;
  date: string;
  completed_tasks: unknown[];
  incomplete_tasks: unknown[];
  completed_events: unknown[];
  unresolved_items: unknown[];
  contact_updates: unknown[];
  data_gap_ids: string[];
  feedback: string;
  tomorrow_theme: string;
  tomorrow_tasks: string[];
  status: string;
};

type InteractionLogRow = {
  id: string;
  user_id: string;
  contact_id: string | null;
  sales_route_id: string | null;
  type: string;
  title: string;
  summary: string;
  source_type: string;
  source_id: string | null;
  happened_at: string;
};

export type EndOfDayPersistence = {
  readTasks(userId: string, taskIds: string[]): Promise<CarryTaskRow[]>;
  updateTasks(
    userId: string,
    taskIds: string[],
    patch: Pick<CarryTaskRow, 'due_date' | 'status' | 'created_from'>,
  ): Promise<Array<Pick<CarryTaskRow, 'id' | 'contact_id' | 'sales_route_id' | 'title'>>>;
  restoreTask(userId: string, task: CarryTaskRow): Promise<void>;
  insertInteractionLogs(rows: InteractionLogRow[]): Promise<void>;
  upsertInteractionLogs(rows: InteractionLogRow[]): Promise<void>;
  readEndOfDayCheck(userId: string, rowId: string): Promise<EndOfDayCheckRow | null>;
  upsertEndOfDayCheck(row: EndOfDayCheckRow): Promise<void>;
  deleteEndOfDayCheck(userId: string, rowId: string): Promise<void>;
};

function localDayBounds(now: Date) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { start: start.toISOString(), end: end.toISOString(), date };
}

function toTask(row: TaskRow): EndOfDayTask {
  return {
    id: row.id,
    contactId: row.contact_id,
    salesRouteId: row.sales_route_id,
    calendarEventId: row.calendar_event_id,
    title: row.title,
    actionType: row.action_type,
    dueDate: row.due_date,
    status: row.status,
    createdFrom: row.created_from,
    updatedAt: row.updated_at,
  };
}

function isCompleted(status: string) {
  return COMPLETED_STATUSES.has(status.toLowerCase());
}

function isCancelled(status: string) {
  return CANCELLED_STATUSES.has(status.toLowerCase());
}

export function mergeCarriedTaskIds(saved: unknown, logRows: Array<{ source_id: string | null }>): string[] {
  const savedIds = Array.isArray(saved) ? saved.filter((value): value is string => typeof value === 'string') : [];
  const loggedIds = logRows
    .map((row) => row.source_id)
    .filter((value): value is string => typeof value === 'string' && value.length > 0);
  return [...new Set([...savedIds, ...loggedIds])];
}

export async function loadEndOfDayReconciliation(now = new Date()): Promise<EndOfDayReconciliation> {
  const userId = await requireUserId();
  const { start, end, date } = localDayBounds(now);

  const [contactsResult, tasksResult, eventsResult, afterMemosResult, messageChecksResult, gapsResult, checkResult, carryLogsResult] = await Promise.all([
    supabase.from('contacts').select('id,name,next_contact_date').eq('user_id', userId).is('archived_at', null),
    supabase
      .from('action_tasks')
      .select('id,contact_id,sales_route_id,calendar_event_id,title,action_type,due_date,status,created_from,updated_at')
      .eq('user_id', userId)
      .lte('due_date', end)
      .order('due_date', { ascending: true }),
    supabase
      .from('calendar_events')
      .select('id,contact_id,sales_route_id,title,start_at,end_at,status,after_memo_id')
      .eq('user_id', userId)
      .gte('start_at', start)
      .lte('start_at', end)
      .order('start_at', { ascending: true }),
    supabase
      .from('after_memos')
      .select('id,contact_id,sales_route_id,calendar_event_id,summary,saved_to_contact,created_at')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true }),
    supabase
      .from('message_checks')
      .select('id,contact_id,check_type,created_at,saved_to_contact')
      .eq('user_id', userId)
      .eq('saved_to_contact', false)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true }),
    supabase
      .from('data_gaps')
      .select('id,contact_id,gap_type,title,severity,target_screen,status')
      .eq('user_id', userId)
      .eq('status', 'open')
      .order('created_at', { ascending: true }),
    supabase
      .from('end_of_day_checks')
      .select('tomorrow_tasks')
      .eq('user_id', userId)
      .eq('date', date)
      .maybeSingle(),
    supabase
      .from('interaction_logs')
      .select('source_id')
      .eq('user_id', userId)
      .eq('type', 'task_carried_over')
      .gte('happened_at', start)
      .lte('happened_at', end),
  ]);

  const failures = [
    ['contacts', contactsResult.error],
    ['action_tasks', tasksResult.error],
    ['calendar_events', eventsResult.error],
    ['after_memos', afterMemosResult.error],
    ['message_checks', messageChecksResult.error],
    ['data_gaps', gapsResult.error],
    ['end_of_day_checks', checkResult.error],
    ['interaction_logs', carryLogsResult.error],
  ].filter(([, error]) => error) as Array<[string, { message: string }]>;
  if (failures.length > 0) {
    throw new Error(`終業後チェックの取得に失敗しました（${failures.map(([table, error]) => `${table}: ${error.message}`).join(' / ')}）`);
  }

  const contactNames = Object.fromEntries(
    ((contactsResult.data ?? []) as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]),
  );
  const tasks = ((tasksResult.data ?? []) as TaskRow[]).map(toTask);
  const events = ((eventsResult.data ?? []) as Array<{
    id: string;
    contact_id: string;
    sales_route_id: string | null;
    title: string;
    start_at: string;
    end_at: string;
    status: string;
    after_memo_id: string | null;
  }>).map((row) => ({
    id: row.id,
    contactId: row.contact_id,
    salesRouteId: row.sales_route_id,
    title: row.title,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    afterMemoId: row.after_memo_id,
  }));
  const afterMemos = ((afterMemosResult.data ?? []) as Array<{
    id: string;
    contact_id: string;
    sales_route_id: string | null;
    calendar_event_id: string | null;
    summary: string;
    saved_to_contact: boolean;
    created_at: string;
  }>).map((row) => ({
    id: row.id,
    contactId: row.contact_id,
    salesRouteId: row.sales_route_id,
    calendarEventId: row.calendar_event_id,
    summary: row.summary,
    savedToContact: row.saved_to_contact,
    createdAt: row.created_at,
  }));
  const nowTime = now.getTime();
  const savedMemoIds = new Set(afterMemos.filter((memo) => memo.savedToContact).map((memo) => memo.id));
  const savedMemoEventIds = new Set(
    afterMemos.filter((memo) => memo.savedToContact && memo.calendarEventId).map((memo) => memo.calendarEventId as string),
  );

  return {
    date,
    contactNames,
    completedTasks: tasks.filter((task) => isCompleted(task.status) && task.updatedAt >= start && task.updatedAt <= end),
    incompleteTasks: tasks.filter((task) => !isCompleted(task.status) && !isCancelled(task.status)),
    completedEvents: events.filter(
      (event) => new Date(event.endAt).getTime() <= nowTime && !isCancelled(event.status),
    ),
    savedAfterMemos: afterMemos.filter((memo) => memo.savedToContact),
    eventsMissingAfterMemo: events.filter(
      (event) =>
        new Date(event.endAt).getTime() <= nowTime &&
        !isCancelled(event.status) &&
        !savedMemoEventIds.has(event.id) &&
        (!event.afterMemoId || !savedMemoIds.has(event.afterMemoId)),
    ),
    unsavedAfterMemos: afterMemos.filter((memo) => !memo.savedToContact),
    unsavedMessageChecks: ((messageChecksResult.data ?? []) as Array<{
      id: string;
      contact_id: string;
      check_type: string;
      created_at: string;
    }>).map((row) => ({ id: row.id, contactId: row.contact_id, checkType: row.check_type, createdAt: row.created_at })),
    contactsMissingNextContact: ((contactsResult.data ?? []) as Array<{
      id: string;
      name: string;
      next_contact_date: string | null;
    }>)
      .filter((row) => !row.next_contact_date)
      .map((row) => ({ id: row.id, name: row.name })),
    unresolvedDataGaps: ((gapsResult.data ?? []) as Array<{
      id: string;
      contact_id: string | null;
      gap_type: string;
      title: string;
      severity: string;
      target_screen: string;
    }>).map((row) => ({
      id: row.id,
      contactId: row.contact_id,
      gapType: row.gap_type,
      title: row.title,
      severity: row.severity,
      targetScreen: row.target_screen,
    })),
    carriedTaskIds: mergeCarriedTaskIds(
      (checkResult.data as { tomorrow_tasks?: unknown } | null)?.tomorrow_tasks,
      (carryLogsResult.data ?? []) as Array<{ source_id: string | null }>,
    ),
  };
}

function tomorrowAtNine(now: Date) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}

const persistence: EndOfDayPersistence = {
  async readTasks(userId, taskIds) {
    const { data, error } = await supabase
      .from('action_tasks')
      .select('id,contact_id,sales_route_id,calendar_event_id,title,action_type,due_date,status,created_from')
      .eq('user_id', userId)
      .in('id', taskIds);
    if (error) throw new Error(`明日に回すタスクの取得に失敗しました: ${error.message}`);
    return (data ?? []) as CarryTaskRow[];
  },
  async updateTasks(userId, taskIds, patch) {
    const { data, error } = await supabase
      .from('action_tasks')
      .update(patch)
      .eq('user_id', userId)
      .in('id', taskIds)
      .select('id,contact_id,sales_route_id,title');
    if (error) throw new Error(`タスクを明日に回せませんでした: ${error.message}`);
    return (data ?? []) as Array<Pick<CarryTaskRow, 'id' | 'contact_id' | 'sales_route_id' | 'title'>>;
  },
  async restoreTask(userId, task) {
    const { error } = await supabase
      .from('action_tasks')
      .update({ due_date: task.due_date, status: task.status, created_from: task.created_from })
      .eq('user_id', userId)
      .eq('id', task.id);
    if (error) throw new Error(error.message);
  },
  async insertInteractionLogs(rows) {
    const { error } = await supabase.from('interaction_logs').insert(rows);
    if (error) throw new Error(error.message);
  },
  async upsertInteractionLogs(rows) {
    const { error } = await supabase.from('interaction_logs').upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  },
  async readEndOfDayCheck(userId, rowId) {
    const { data, error } = await supabase
      .from('end_of_day_checks')
      .select('id,user_id,date,completed_tasks,incomplete_tasks,completed_events,unresolved_items,contact_updates,data_gap_ids,feedback,tomorrow_theme,tomorrow_tasks,status')
      .eq('user_id', userId)
      .eq('id', rowId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as EndOfDayCheckRow | null) ?? null;
  },
  async upsertEndOfDayCheck(row) {
    const { error } = await supabase.from('end_of_day_checks').upsert(row, { onConflict: 'id' });
    if (error) throw new Error(error.message);
  },
  async deleteEndOfDayCheck(userId, rowId) {
    const { error } = await supabase.from('end_of_day_checks').delete().eq('user_id', userId).eq('id', rowId);
    if (error) throw new Error(error.message);
  },
};

export async function carryActionTasksToTomorrowWithClient(
  client: EndOfDayPersistence,
  userId: string,
  taskIds: string[],
  now = new Date(),
): Promise<string[]> {
  const uniqueIds = [...new Set(taskIds)];
  if (uniqueIds.length === 0) return [];
  const originalRows = await client.readTasks(userId, uniqueIds);
  if (originalRows.length !== uniqueIds.length) {
    throw new Error('明日に回す対象の一部が見つからないため、更新を中止しました。');
  }
  if (originalRows.some((task) => isCompleted(task.status) || isCancelled(task.status))) {
    throw new Error('完了または中止済みのタスクは明日に回せません。');
  }

  const dueDate = tomorrowAtNine(now);
  const updatedRows = await client.updateTasks(userId, uniqueIds, {
    due_date: dueDate,
    status: 'open',
    created_from: 'end_of_day',
  });
  if (updatedRows.length !== uniqueIds.length) {
    await rollbackTasks(client, userId, originalRows, '更新件数が一致しません');
    throw new Error('一部のタスクを更新できなかったため、変更を取り消しました。');
  }

  const logRows = updatedRows.map((task) => ({
    id: `${userId}:carry-${task.id}-${now.getTime()}`,
    user_id: userId,
    contact_id: task.contact_id,
    sales_route_id: task.sales_route_id,
    type: 'task_carried_over',
    title: `「${task.title}」を明日に回した`,
    summary: `未完了の営業アクションを${dueDate}へ変更しました。`,
    source_type: 'action_task',
    source_id: task.id,
    happened_at: now.toISOString(),
  }));
  try {
    await client.insertInteractionLogs(logRows);
  } catch (error) {
    await rollbackTasks(client, userId, originalRows, error instanceof Error ? error.message : '操作履歴保存エラー');
    throw new Error(`操作履歴の保存に失敗したため、タスク更新を取り消しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }

  return updatedRows.map((row) => row.id);
}

async function rollbackTasks(
  client: EndOfDayPersistence,
  userId: string,
  originalRows: CarryTaskRow[],
  cause: string,
) {
  const results = await Promise.allSettled(originalRows.map((task) => client.restoreTask(userId, task)));
  const failed = results.filter((result) => result.status === 'rejected');
  if (failed.length > 0) {
    throw new Error(`タスク更新後の復元に失敗しました（${failed.length}件）。原因: ${cause}`);
  }
}

export async function carryActionTasksToTomorrow(taskIds: string[], now = new Date()): Promise<string[]> {
  const userId = await requireUserId();
  return carryActionTasksToTomorrowWithClient(persistence, userId, taskIds, now);
}

function buildEndOfDayRow(
  userId: string,
  reconciliation: EndOfDayReconciliation,
  tomorrowTaskIds: string[],
  feedback: string,
): EndOfDayCheckRow {
  return {
    id: `${userId}:eod-${reconciliation.date}`,
    user_id: userId,
    date: reconciliation.date,
    completed_tasks: reconciliation.completedTasks.map((task) => ({ id: task.id, title: task.title })),
    incomplete_tasks: reconciliation.incompleteTasks.map((task) => ({ id: task.id, title: task.title })),
    completed_events: reconciliation.completedEvents.map((event) => ({ id: event.id, title: event.title })),
    unresolved_items: [
      ...reconciliation.eventsMissingAfterMemo.map((event) => ({ id: event.id, type: '後メモ未入力', title: event.title })),
      ...reconciliation.unsavedAfterMemos.map((memo) => ({ id: memo.id, type: '後メモ未保存' })),
      ...reconciliation.unsavedMessageChecks.map((check) => ({ id: check.id, type: '文面確認未保存' })),
      ...reconciliation.contactsMissingNextContact.map((contact) => ({
        id: contact.id,
        type: '次回連絡日未設定',
        title: contact.name,
      })),
    ],
    contact_updates: [],
    data_gap_ids: reconciliation.unresolvedDataGaps.map((gap) => gap.id),
    feedback,
    tomorrow_theme: '未完了の営業行動と記録漏れを先に回収する',
    tomorrow_tasks: tomorrowTaskIds,
    status: 'completed',
  };
}

export async function completeEndOfDayCheckWithClient(
  client: EndOfDayPersistence,
  userId: string,
  reconciliation: EndOfDayReconciliation,
  tomorrowTaskIds: string[],
  feedback: string,
  now = new Date(),
): Promise<string> {
  const row = buildEndOfDayRow(userId, reconciliation, tomorrowTaskIds, feedback);
  const previous = await client.readEndOfDayCheck(userId, row.id);
  await client.upsertEndOfDayCheck(row);

  try {
    await client.upsertInteractionLogs([
      {
        id: `${userId}:eod-log-${reconciliation.date}`,
        user_id: userId,
        contact_id: null,
        sales_route_id: null,
        type: 'end_of_day_completed',
        title: '終業後チェックを完了',
        summary: `未完了${reconciliation.incompleteTasks.length}件、後メモ未入力${reconciliation.eventsMissingAfterMemo.length}件、明日へ${tomorrowTaskIds.length}件を確認しました。`,
        source_type: 'end_of_day_check',
        source_id: row.id,
        happened_at: now.toISOString(),
      },
    ]);
  } catch (error) {
    try {
      if (previous) await client.upsertEndOfDayCheck(previous);
      else await client.deleteEndOfDayCheck(userId, row.id);
    } catch (rollbackError) {
      throw new Error(
        `操作履歴の保存に失敗し、終業後チェックの復元にも失敗しました: ${rollbackError instanceof Error ? rollbackError.message : '不明なエラー'}`,
      );
    }
    throw new Error(`操作履歴の保存に失敗したため、終業後チェックを取り消しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
  }

  return row.id;
}

export async function completeEndOfDayCheck(
  reconciliation: EndOfDayReconciliation,
  tomorrowTaskIds: string[],
  feedback: string,
  now = new Date(),
): Promise<string> {
  const userId = await requireUserId();
  return completeEndOfDayCheckWithClient(persistence, userId, reconciliation, tomorrowTaskIds, feedback, now);
}
