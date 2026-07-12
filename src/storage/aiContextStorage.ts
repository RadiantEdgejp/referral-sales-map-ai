import { supabase } from '../lib/supabaseClient';

export type AiContextRows = {
  salesRoutes: Record<string, unknown>[];
  calendarEvents: Record<string, unknown>[];
  preMeetingNavs: Record<string, unknown>[];
  afterMemos: Record<string, unknown>[];
  messageChecks: Record<string, unknown>[];
  interactionLogs: Record<string, unknown>[];
  updateHistories: Record<string, unknown>[];
  dataGaps: Record<string, unknown>[];
  actionTasks: Record<string, unknown>[];
};

export type AiContextQueryOptions = {
  salesRouteId?: string;
  calendarEventId?: string;
};

async function readRows(
  table: string,
  userId: string,
  contactId: string,
  columns: string,
  orderColumn: string,
  limit: number,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .order(orderColumn, { ascending: false })
    .limit(limit);
  if (error) throw new Error(`${table}のAI参照データ取得に失敗しました: ${error.message}`);
  return (data ?? []) as unknown as Record<string, unknown>[];
}

async function readMatchingRows(
  table: string,
  userId: string,
  contactId: string,
  columns: string,
  column: string,
  value: string,
  orderColumn: string,
  limit = 3,
): Promise<Record<string, unknown>[]> {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq('user_id', userId)
    .eq('contact_id', contactId)
    .eq(column, value)
    .order(orderColumn, { ascending: false })
    .limit(limit);
  if (error) throw new Error(`${table}の対象AI参照データ取得に失敗しました: ${error.message}`);
  return (data ?? []) as unknown as Record<string, unknown>[];
}

function prependUnique(primary: Record<string, unknown>[], rest: Record<string, unknown>[]) {
  const ids = new Set(primary.map((row) => row.id));
  return [...primary, ...rest.filter((row) => !ids.has(row.id))];
}

export async function getAiContextRows(
  userId: string,
  contactId: string,
  options: AiContextQueryOptions = {},
): Promise<AiContextRows> {
  const [salesRoutes, calendarEvents, preMeetingNavs, afterMemos, messageChecks, interactionLogs, updateHistories, dataGaps, actionTasks] =
    await Promise.all([
      readRows('sales_routes', userId, contactId, 'id,route_type,goal,current_stage,next_step,priority,status,reason,confidence,updated_at', 'updated_at', 3),
      readRows('calendar_events', userId, contactId, 'id,sales_route_id,title,event_type,start_at,end_at,purpose,meeting_method,status,updated_at', 'start_at', 5),
      readRows('pre_meeting_navs', userId, contactId, 'id,sales_route_id,calendar_event_id,purpose,goal_today,main_questions,items_to_record_after,status,updated_at', 'updated_at', 3),
      readRows('after_memos', userId, contactId, 'id,sales_route_id,calendar_event_id,summary,extracted_info,temperature,interest_direction,next_progress,next_action,next_questions,saved_to_contact,created_at', 'created_at', 3),
      readRows('message_checks', userId, contactId, 'id,sales_route_id,check_type,extracted_info,temperature,judgement,reply_policy,reply_text,next_action,feedback,saved_to_contact,created_at', 'created_at', 5),
      readRows('interaction_logs', userId, contactId, 'id,type,title,summary,source_type,happened_at', 'happened_at', 10),
      readRows('update_histories', userId, contactId, 'id,source_type,summary,updated_fields,created_at', 'created_at', 5),
      readRows('data_gaps', userId, contactId, 'id,sales_route_id,gap_type,title,reason,severity,target_screen,status,created_at', 'created_at', 10),
      readRows('action_tasks', userId, contactId, 'id,title,due_date,status,updated_at', 'updated_at', 5),
    ]);

  let targetRoutes: Record<string, unknown>[] = [];
  let targetEvents: Record<string, unknown>[] = [];
  let targetNavs: Record<string, unknown>[] = [];
  if (options.salesRouteId) {
    targetRoutes = await readMatchingRows('sales_routes', userId, contactId, 'id,route_type,goal,current_stage,next_step,priority,status,reason,confidence,updated_at', 'id', options.salesRouteId, 'updated_at', 1);
  }
  if (options.calendarEventId) {
    [targetEvents, targetNavs] = await Promise.all([
      readMatchingRows('calendar_events', userId, contactId, 'id,sales_route_id,title,event_type,start_at,end_at,purpose,meeting_method,status,updated_at', 'id', options.calendarEventId, 'start_at', 1),
      readMatchingRows('pre_meeting_navs', userId, contactId, 'id,sales_route_id,calendar_event_id,purpose,goal_today,main_questions,items_to_record_after,status,updated_at', 'calendar_event_id', options.calendarEventId, 'updated_at', 1),
    ]);
  }

  const allRoutes = prependUnique(targetRoutes, salesRoutes);
  const allEvents = prependUnique(targetEvents, calendarEvents);
  const allNavs = prependUnique(targetNavs, preMeetingNavs);
  const routeMatches = (row: Record<string, unknown>) => !options.salesRouteId || row.id === options.salesRouteId || row.sales_route_id === options.salesRouteId;
  const eventMatches = (row: Record<string, unknown>) => !options.calendarEventId || row.id === options.calendarEventId || row.calendar_event_id === options.calendarEventId;

  return {
    salesRoutes: allRoutes.filter(routeMatches),
    calendarEvents: allEvents.filter(routeMatches).filter(eventMatches),
    preMeetingNavs: allNavs.filter(routeMatches).filter(eventMatches),
    afterMemos: afterMemos.filter(routeMatches).filter(eventMatches),
    messageChecks: messageChecks.filter(routeMatches),
    interactionLogs,
    updateHistories,
    dataGaps: dataGaps.filter(routeMatches).filter((row) => row.status !== 'resolved'),
    actionTasks: actionTasks.filter((row) => row.status !== 'completed'),
  };
}
