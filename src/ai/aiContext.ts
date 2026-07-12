import { getAiContextRows, type AiContextQueryOptions, type AiContextRows } from '../storage/aiContextStorage';
import { requireUserId, toContactRowId } from '../storage/personStorage';
import type { Person } from '../types/person';
import type { ContactAIContext } from './types';

const MAX_ITEM_LENGTH = 180;
const MAX_GROUNDING_ITEMS = 12;

const text = (value: unknown, max = MAX_ITEM_LENGTH): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const list = (value: unknown, maxItems = 8): string[] =>
  Array.isArray(value) ? value.map((item) => text(item)).filter(Boolean).slice(0, maxItems) : [];
const objectFacts = (value: unknown): string[] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([key, raw]) => {
      if (Array.isArray(raw)) return raw.map((item) => `${key}: ${text(item)}`);
      const rendered = text(raw);
      return rendered ? [`${key}: ${rendered}`] : [];
    })
    .filter(Boolean)
    .slice(0, 8);
};
const unique = (values: string[], max = MAX_GROUNDING_ITEMS): string[] =>
  [...new Set(values.map((value) => text(value)).filter(Boolean))].slice(0, max);
const date = (value: unknown): string => text(value, 40);
const number = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0);

export function assembleContactAIContext(
  person: Person,
  rows: AiContextRows,
  now = new Date().toISOString(),
): ContactAIContext {
  const route = rows.salesRoutes[0];
  const event = rows.calendarEvents[0];
  const nav = rows.preMeetingNavs.find((row) => !event || row.calendar_event_id === event.id) ?? rows.preMeetingNavs[0];

  const afterMemoSummaries = rows.afterMemos.map((row) => ({
    createdAt: date(row.created_at),
    summary: text(row.summary),
    extractedInfo: objectFacts(row.extracted_info),
    temperature: text(row.temperature, 40),
    interestDirection: text(row.interest_direction),
    nextProgress: text(row.next_progress),
    nextAction: text(row.next_action),
    nextQuestions: list(row.next_questions, 3),
  }));
  const temperatureHistory = rows.messageChecks.map((row) => ({
    createdAt: date(row.created_at),
    checkType: text(row.check_type, 40),
    extractedInfo: objectFacts(row.extracted_info),
    temperature: text(row.temperature, 40),
    judgement: text(row.judgement),
    replyPolicy: text(row.reply_policy),
    replyTextSummary: text(row.reply_text, 100),
    nextAction: text(row.next_action),
    feedback: text(row.feedback),
  }));
  const openGaps = rows.dataGaps.map((row) => ({
    gapType: text(row.gap_type, 60),
    title: text(row.title),
    reason: text(row.reason),
    severity: text(row.severity, 40),
    targetScreen: text(row.target_screen, 60),
    createdAt: date(row.created_at),
  }));

  const confirmedFacts = unique([
    ...afterMemoSummaries.flatMap((memo) => memo.extractedInfo),
    ...temperatureHistory.flatMap((check) => check.extractedInfo),
    ...rows.interactionLogs.map((row) => text(row.summary)).filter(Boolean),
  ]);
  const hypotheses = unique([
    person.goal ? `現在の営業仮説: ${person.goal}` : '',
    route?.reason ? `営業ルートの仮説: ${text(route.reason)}` : '',
    ...person.categories.map((category) => `分類候補: ${category}`),
  ]);
  const unknowns = unique([
    ...openGaps.map((gap) => `${gap.title}: ${gap.reason}`),
    ...afterMemoSummaries.flatMap((memo) => memo.nextQuestions),
  ]);
  const cautions = unique([
    person.cautions,
    ...temperatureHistory
      .filter((check) => /低|断|忙|保留|消極|negative|low/i.test(`${check.temperature} ${check.judgement}`))
      .map((check) => `直近の文面は低温度または保留傾向: ${check.judgement}`),
    ...openGaps.filter((gap) => gap.severity === 'high').map((gap) => `重要な抜け漏れ: ${gap.title}`),
  ]);

  return {
    contactId: person.id,
    contactName: person.name,
    generatedAt: now,
    contact: {
      industry: text(person.industry),
      relationship: text(person.relationship),
      company: text(person.company) || undefined,
      role: text(person.role) || undefined,
      currentGoal: text(person.goal),
      currentStatus: route ? text(route.current_stage) : '',
      currentHypothesis: text(person.goal),
      nextStep: text(person.nextAction),
      requiredActions: person.roadmap.map((item) => text(item)).filter(Boolean).slice(0, 6),
      notes: text(person.rawMemo, 300),
      classification: person.categories.slice(0, 5),
      tags: [],
      lastContactDate: rows.interactionLogs[0] ? date(rows.interactionLogs[0].happened_at) : undefined,
      nextContactDate: person.nextContactAt,
    },
    salesRoute: route
      ? {
          id: text(route.id, 100), routeType: text(route.route_type, 60), goal: text(route.goal),
          currentStage: text(route.current_stage), nextStep: text(route.next_step), priority: text(route.priority, 40),
          status: text(route.status, 40), reason: text(route.reason), confidence: number(route.confidence),
        }
      : undefined,
    calendarEvent: event
      ? {
          id: text(event.id, 100), title: text(event.title), eventType: text(event.event_type, 60),
          startAt: date(event.start_at), endAt: date(event.end_at), purpose: text(event.purpose),
          meetingMethod: text(event.meeting_method, 60), status: text(event.status, 40),
        }
      : undefined,
    preMeetingNav: nav
      ? {
          id: text(nav.id, 100), purpose: text(nav.purpose), goalToday: text(nav.goal_today),
          mainQuestions: list(nav.main_questions, 3), itemsToRecordAfter: list(nav.items_to_record_after, 6),
          status: text(nav.status, 40),
        }
      : undefined,
    confirmedFacts,
    hypotheses,
    unknowns,
    cautions,
    interactions: rows.interactionLogs.map((row) => ({
      rowId: text(row.id, 100), action: text(row.type, 60), actionLabel: text(row.title),
      title: text(row.title), summary: text(row.summary), sourceType: text(row.source_type, 60), happenedAt: date(row.happened_at),
    })),
    afterMemoSummaries,
    temperatureHistory,
    updateHistories: rows.updateHistories.map((row) => ({
      createdAt: date(row.created_at), sourceType: text(row.source_type, 60), summary: text(row.summary),
      updatedFields: list(row.updated_fields, 8),
    })),
    openTasks: rows.actionTasks.map((row) => ({ title: text(row.title), dueDate: date(row.due_date) })),
    openGaps,
  };
}

export async function buildContactAIContext(
  person: Person,
  options: AiContextQueryOptions = {},
): Promise<ContactAIContext> {
  const userId = await requireUserId();
  const contactId = toContactRowId(userId, person.id);
  const rows = await getAiContextRows(userId, contactId, options);
  return assembleContactAIContext(person, rows);
}

export const buildAiContext = buildContactAIContext;
export async function buildAiContextForRoute(person: Person, salesRouteId: string) {
  return buildContactAIContext(person, { salesRouteId });
}
export async function buildAiContextForEvent(person: Person, salesRouteId: string, calendarEventId: string) {
  return buildContactAIContext(person, { salesRouteId, calendarEventId });
}

export { formatAIContextForPrompt } from './contextFormatter';
