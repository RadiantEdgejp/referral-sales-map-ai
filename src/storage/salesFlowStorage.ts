import { supabase } from '../lib/supabaseClient';
import { requireUserId, toContactRowId } from './personStorage';
import {
  createScheduledSalesFlowWithClient,
  type CreateScheduledSalesFlowInput,
  type SalesFlowIds,
  type SalesFlowRpcClient,
} from './salesFlowCore';

export {
  buildScheduledSalesFlowRpcArgs,
  createScheduledSalesFlowWithClient,
} from './salesFlowCore';
export type { CreateScheduledSalesFlowInput, SalesFlowIds, SalesFlowRpcClient } from './salesFlowCore';

export type LinkedFlowContext = {
  contactId: string;
  salesRouteId: string;
  calendarEventId: string;
  preMeetingTaskId?: string;
  afterMemoTaskId?: string;
};

/**
 * Creates the route, event, two workflow tasks, reminder, interaction log and
 * Contact update through one Postgres function call. A database exception
 * rolls the whole function back, so callers never receive a partially-created
 * flow.
 */
export async function createScheduledSalesFlow(
  input: CreateScheduledSalesFlowInput,
): Promise<SalesFlowIds> {
  const userId = await requireUserId();
  return createScheduledSalesFlowWithClient(supabase as unknown as SalesFlowRpcClient, userId, input);
}

async function getTaskIds(calendarEventId: string): Promise<Pick<LinkedFlowContext, 'preMeetingTaskId' | 'afterMemoTaskId'>> {
  const { data, error } = await supabase
    .from('action_tasks')
    .select('id,action_type')
    .eq('calendar_event_id', calendarEventId)
    .in('action_type', ['pre_meeting', 'after_memo']);
  if (error) {
    throw new Error(`予定タスクの取得に失敗しました: ${error.message}`);
  }

  const rows = (data ?? []) as Array<{ id: string; action_type: string }>;
  return {
    preMeetingTaskId: rows.find((row) => row.action_type === 'pre_meeting')?.id,
    afterMemoTaskId: rows.find((row) => row.action_type === 'after_memo')?.id,
  };
}

/** Resolve one persisted route/event chain. It never fabricates missing IDs. */
export async function resolveLinkedFlow(input: {
  personId: string;
  salesRouteId?: string;
  calendarEventId?: string;
  preMeetingNavId?: string;
}): Promise<LinkedFlowContext> {
  const userId = await requireUserId();
  const contactId = toContactRowId(userId, input.personId);

  if (input.preMeetingNavId) {
    const { data, error } = await supabase
      .from('pre_meeting_navs')
      .select('contact_id,sales_route_id,calendar_event_id')
      .eq('id', input.preMeetingNavId)
      .eq('contact_id', contactId)
      .single();
    if (error) {
      throw new Error(`予定前ナビの連動情報を取得できませんでした: ${error.message}`);
    }
    const row = data as { contact_id: string; sales_route_id: string | null; calendar_event_id: string | null };
    if (!row.sales_route_id || !row.calendar_event_id) {
      throw new Error('予定前ナビに営業ルートまたは予定が紐づいていません。');
    }
    const taskIds = await getTaskIds(row.calendar_event_id);
    return {
      contactId: row.contact_id,
      salesRouteId: row.sales_route_id,
      calendarEventId: row.calendar_event_id,
      ...taskIds,
    };
  }

  let query = supabase
    .from('calendar_events')
    .select('id,contact_id,sales_route_id')
    .eq('contact_id', contactId)
    .not('sales_route_id', 'is', null);

  if (input.calendarEventId) {
    query = query.eq('id', input.calendarEventId);
  } else {
    query = query.order('start_at', { ascending: false }).limit(1);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`予定の連動情報を取得できませんでした: ${error.message}`);
  }
  const row = ((data ?? []) as Array<{ id: string; contact_id: string; sales_route_id: string | null }>)[0];
  if (!row?.sales_route_id) {
    throw new Error('この人物には営業ルートと紐づいた予定がありません。先に予定を保存してください。');
  }
  if (input.salesRouteId && row.sales_route_id !== input.salesRouteId) {
    throw new Error('選択された予定と営業ルートが一致しません。');
  }

  const taskIds = await getTaskIds(row.id);
  return {
    contactId: row.contact_id,
    salesRouteId: row.sales_route_id,
    calendarEventId: row.id,
    ...taskIds,
  };
}

/** Used by reload/E2E checks and by UI integration without local shadow data. */
export async function getScheduledSalesFlow(calendarEventId: string): Promise<LinkedFlowContext> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('calendar_events')
    .select('id,contact_id,sales_route_id')
    .eq('id', calendarEventId)
    .eq('user_id', userId)
    .single();
  if (error) {
    throw new Error(`保存済み予定の復元に失敗しました: ${error.message}`);
  }
  const row = data as { id: string; contact_id: string; sales_route_id: string | null };
  if (!row.sales_route_id) {
    throw new Error('保存済み予定に営業ルートが紐づいていません。');
  }
  return {
    contactId: row.contact_id,
    salesRouteId: row.sales_route_id,
    calendarEventId: row.id,
    ...(await getTaskIds(row.id)),
  };
}
