import type { Person } from '../types/person';

export type SalesFlowIds = {
  contactId: string;
  salesRouteId: string;
  calendarEventId: string;
  preMeetingTaskId: string;
  afterMemoTaskId: string;
  reminderId: string;
  interactionLogId: string;
};

export type CreateScheduledSalesFlowInput = {
  person: Person;
  title: string;
  eventType: string;
  startAt: Date;
  endAt: Date;
  purpose: string;
  routeType?: string;
  routeTitle?: string;
  routeGoal?: string;
  routeNextStep?: string;
  location?: string;
  meetingMethod?: string;
  memo?: string;
  createdBy?: string;
  reminderAt?: Date;
};

export type SalesFlowRpcClient = {
  rpc: (
    functionName: string,
    args: Record<string, string | null>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type RpcFlowResult = Partial<SalesFlowIds>;

function namespacedId(userId: string, clientId: string): string {
  return `${userId}:${clientId}`;
}

function newClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function assertDateOrder(startAt: Date, endAt: Date): void {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
    throw new Error('予定の開始日時または終了日時が不正です。');
  }
  if (endAt.getTime() <= startAt.getTime()) {
    throw new Error('予定の終了日時は開始日時より後にしてください。');
  }
}

function assertFlowIds(value: RpcFlowResult): asserts value is SalesFlowIds {
  const required: Array<keyof SalesFlowIds> = [
    'contactId',
    'salesRouteId',
    'calendarEventId',
    'preMeetingTaskId',
    'afterMemoTaskId',
    'reminderId',
    'interactionLogId',
  ];
  const missing = required.filter((key) => typeof value[key] !== 'string' || value[key]?.length === 0);
  if (missing.length > 0) {
    throw new Error(`予定フローの保存結果にIDが不足しています: ${missing.join(', ')}`);
  }
}

export function buildScheduledSalesFlowRpcArgs(
  userId: string,
  input: CreateScheduledSalesFlowInput,
): Record<string, string | null> {
  assertDateOrder(input.startAt, input.endAt);
  const token = newClientId(input.person.id);
  const rowId = (suffix: string) => namespacedId(userId, `${token}-${suffix}`);

  return {
    p_contact_id: namespacedId(userId, input.person.id),
    p_sales_route_id: rowId('route'),
    p_calendar_event_id: rowId('event'),
    p_pre_meeting_task_id: rowId('pre-task'),
    p_after_memo_task_id: rowId('after-task'),
    p_reminder_id: rowId('reminder'),
    p_interaction_log_id: rowId('log'),
    p_route_type: input.routeType ?? 'relationship_development',
    p_route_title: input.routeTitle ?? `${input.person.name}との営業ルート`,
    p_route_goal: input.routeGoal ?? input.person.goal,
    p_route_next_step: input.routeNextStep ?? input.person.nextAction,
    p_event_title: input.title,
    p_event_type: input.eventType,
    p_start_at: input.startAt.toISOString(),
    p_end_at: input.endAt.toISOString(),
    p_location: input.location ?? null,
    p_meeting_method: input.meetingMethod ?? '',
    p_purpose: input.purpose,
    p_memo: input.memo ?? null,
    p_created_by: input.createdBy ?? 'user',
    p_reminder_at: input.reminderAt?.toISOString() ?? null,
  };
}

export async function createScheduledSalesFlowWithClient(
  client: SalesFlowRpcClient,
  userId: string,
  input: CreateScheduledSalesFlowInput,
): Promise<SalesFlowIds> {
  const args = buildScheduledSalesFlowRpcArgs(userId, input);
  const { data, error } = await client.rpc('create_scheduled_sales_flow', args);
  if (error) {
    throw new Error(`予定フローの保存に失敗しました: ${error.message}`);
  }
  const result = (data ?? {}) as RpcFlowResult;
  assertFlowIds(result);
  return result;
}
