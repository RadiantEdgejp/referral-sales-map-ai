import { getAiContextRows } from './aiContextStorage';
import { requireUserId, toContactRowId } from './personStorage';

export type PersonHistorySummary = {
  afterMemoCount: number;
  messageCheckCount: number;
  interactionCount: number;
  updateHistoryCount: number;
  unresolvedGapCount: number;
  salesRouteCount: number;
  latestNextStep: string;
  latestActivityAt?: string;
};

export function summarizePersonHistoryRows(rows: Awaited<ReturnType<typeof getAiContextRows>>): PersonHistorySummary {
  const latestDates = [
    ...rows.afterMemos.map((row) => row.created_at),
    ...rows.messageChecks.map((row) => row.created_at),
    ...rows.interactionLogs.map((row) => row.happened_at),
    ...rows.updateHistories.map((row) => row.created_at),
  ]
    .filter((value): value is string => typeof value === 'string')
    .sort((a, b) => Date.parse(b) - Date.parse(a));
  return {
    afterMemoCount: rows.afterMemos.filter((row) => row.saved_to_contact !== false).length,
    messageCheckCount: rows.messageChecks.filter((row) => row.saved_to_contact !== false).length,
    interactionCount: rows.interactionLogs.length,
    updateHistoryCount: rows.updateHistories.length,
    unresolvedGapCount: rows.dataGaps.length,
    salesRouteCount: rows.salesRoutes.length,
    latestNextStep: typeof rows.salesRoutes[0]?.next_step === 'string' ? rows.salesRoutes[0].next_step : '',
    latestActivityAt: latestDates[0],
  };
}

export async function getPersonHistorySummary(personId: string): Promise<PersonHistorySummary> {
  const userId = await requireUserId();
  const rows = await getAiContextRows(userId, toContactRowId(userId, personId));
  return summarizePersonHistoryRows(rows);
}
