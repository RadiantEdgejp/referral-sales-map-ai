import { supabase } from '../lib/supabaseClient';
import type { CoachAnswer, LineCheckAnalysis, PreMeetingNavigation } from '../ai/types';
import type { AfterMemoAiSuggestion } from '../types/aiAnalysis';
import type { Person } from '../types/person';
import { requireUserId, toContactRowId } from './personStorage';
import { resolveLinkedFlow } from './salesFlowStorage';

function newClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function resolveSalesRouteId(person: Person, explicitId?: string): Promise<string> {
  const userId = await requireUserId();
  const contactId = toContactRowId(userId, person.id);
  let query = supabase
    .from('sales_routes')
    .select('id')
    .eq('contact_id', contactId)
    .eq('status', 'active');
  query = explicitId
    ? query.eq('id', explicitId)
    : query.order('updated_at', { ascending: false }).limit(1);
  const { data, error } = await query;
  if (error) {
    throw new Error(`営業ルートの取得に失敗しました: ${error.message}`);
  }
  const row = ((data ?? []) as Array<{ id: string }>)[0];
  if (row) {
    return row.id;
  }

  const defaultRouteId = toContactRowId(userId, `${person.id}-default-route`);
  const { data: createdRouteId, error: createError } = await supabase.rpc('ensure_contact_sales_route', {
    p_contact_id: contactId,
    p_sales_route_id: defaultRouteId,
    p_title: `${person.name}との営業ルート`,
    p_goal: person.goal,
    p_next_step: person.nextAction,
  });
  if (createError) {
    throw new Error(`営業ルートの作成に失敗しました: ${createError.message}`);
  }
  if (createdRouteId !== defaultRouteId) {
    throw new Error('営業ルートの作成結果が一致しません。');
  }
  return defaultRouteId;
}

export type SavedPreMeetingNav = {
  rowId: string;
  salesRouteId: string;
  calendarEventId: string;
  completedTaskId: string;
};

export async function savePreMeetingNav(input: {
  person: Person;
  actionType: string;
  memo: string;
  nav: PreMeetingNavigation;
  salesRouteId?: string;
  calendarEventId?: string;
}): Promise<SavedPreMeetingNav> {
  const { person, actionType, memo, nav } = input;
  const userId = await requireUserId();
  const rowId = toContactRowId(userId, newClientId(`${person.id}-nav`));
  const flow = await resolveLinkedFlow({
    personId: person.id,
    salesRouteId: input.salesRouteId,
    calendarEventId: input.calendarEventId,
  });

  const { data, error } = await supabase.rpc('save_linked_pre_meeting_nav', {
    p_nav_id: rowId,
    p_contact_id: flow.contactId,
    p_sales_route_id: flow.salesRouteId,
    p_calendar_event_id: flow.calendarEventId,
    p_payload: {
      actionType,
      memo,
      purpose: nav.purpose,
      goalToday: nav.destination,
      conversationPolicy: nav.policy,
      openingTopic: nav.opening,
      mainQuestions: nav.questions,
      followUpQuestions: nav.deepQuestions,
      ngActions: nav.ngActions,
      shouldSellOrListen: nav.sellOrAsk,
      referralRequestTiming: nav.referralTiming,
      itemsToRecordAfter: nav.recordItems,
      scientificReason: nav.evidence,
    },
  });
  if (error) {
    throw new Error(`予定前ナビの保存に失敗しました: ${error.message}`);
  }
  const result = (data ?? {}) as { completedTaskId?: string };
  if (!result.completedTaskId) {
    throw new Error('予定前ナビの保存結果に完了タスクIDがありません。');
  }

  return {
    rowId,
    salesRouteId: flow.salesRouteId,
    calendarEventId: flow.calendarEventId,
    completedTaskId: result.completedTaskId,
  };
}

export async function saveAfterMemo(input: {
  person: Person;
  questions: string[];
  answers: Record<string, string>;
  talkMemo: string;
  allInfoMemo: string;
  nextTodo: string;
  suggestion: AfterMemoAiSuggestion;
  preMeetingNavRowId?: string;
  salesRouteId?: string;
  calendarEventId?: string;
}): Promise<string> {
  const { person, questions, answers, talkMemo, allInfoMemo, nextTodo, suggestion, preMeetingNavRowId } = input;
  if (!preMeetingNavRowId) {
    throw new Error('後メモを保存するには、保存済みの予定前ナビが必要です。');
  }

  const userId = await requireUserId();
  const rowId = toContactRowId(userId, newClientId(`${person.id}-aftermemo`));
  const flow = await resolveLinkedFlow({
    personId: person.id,
    preMeetingNavId: preMeetingNavRowId,
    salesRouteId: input.salesRouteId,
    calendarEventId: input.calendarEventId,
  });

  const { error } = await supabase.rpc('save_linked_after_memo', {
    p_after_memo_id: rowId,
    p_pre_meeting_nav_id: preMeetingNavRowId,
    p_contact_id: flow.contactId,
    p_sales_route_id: flow.salesRouteId,
    p_calendar_event_id: flow.calendarEventId,
    p_payload: {
      questionAnswers: questions.map((question) => ({ question, answer: answers[question] ?? '' })),
      freeMemo: [
        talkMemo ? `話した内容: ${talkMemo}` : '',
        allInfoMemo ? `得た情報: ${allInfoMemo}` : '',
        nextTodo ? `自分が考える次アクション: ${nextTodo}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      extractedInfo: { accumulation: suggestion.accumulation },
      summary: suggestion.accumulation,
      updateProposal: suggestion.categoryUpdate,
      classificationUpdate: { proposal: suggestion.categoryUpdate },
      goalUpdate: suggestion.goal,
      nextAction: suggestion.nextAction,
      feedback: suggestion.feedback,
      nextQuestions: [suggestion.nextQuestion].filter(Boolean),
    },
  });
  if (error) {
    throw new Error(`後メモの保存に失敗しました: ${error.message}`);
  }
  return rowId;
}

export async function saveMessageCheck(input: {
  person: Person;
  checkType: string;
  text: string;
  analysis: LineCheckAnalysis;
  salesRouteId?: string;
}): Promise<string> {
  const { person, checkType, text, analysis } = input;
  const userId = await requireUserId();
  const rowId = toContactRowId(userId, newClientId(`${person.id}-msgcheck`));
  const salesRouteId = await resolveSalesRouteId(person, input.salesRouteId);

  const { error } = await supabase.from('message_checks').insert({
    id: rowId,
    user_id: userId,
    contact_id: toContactRowId(userId, person.id),
    sales_route_id: salesRouteId,
    check_type: checkType,
    input_text: text,
    extracted_info: Object.fromEntries(analysis.extracted.map((item) => [item.label, item.value])),
    temperature: analysis.temperature.label,
    judgement: analysis.judgement,
    reply_policy: analysis.judgement,
    reply_text: analysis.replyDraft,
    next_question: analysis.nextQuestion,
    contact_update_proposal: analysis.cardUpdate,
    next_action: analysis.nextAction,
    feedback: `良い点: ${analysis.feedbackGood}\n改善点: ${analysis.feedbackImprove}`,
    saved_to_contact: true,
  });
  if (error) {
    throw new Error(`文面確認の保存に失敗しました: ${error.message}`);
  }
  return rowId;
}

export async function saveCoachLog(input: {
  person?: Person;
  problem: string;
  answer: CoachAnswer;
  salesRouteId?: string;
}): Promise<string> {
  const { person, problem, answer } = input;
  const userId = await requireUserId();
  const rowId = toContactRowId(userId, newClientId(person ? `${person.id}-coach` : 'coach'));
  const salesRouteId = person ? await resolveSalesRouteId(person, input.salesRouteId) : null;

  const { error } = await supabase.from('coach_logs').insert({
    id: rowId,
    user_id: userId,
    contact_id: person ? toContactRowId(userId, person.id) : null,
    sales_route_id: salesRouteId,
    related_screen: 'CoachChat',
    question: problem,
    context: person ? { contactName: person.name, categories: person.categories } : {},
    answer: [answer.conclusion, answer.reason, answer.translation].filter(Boolean).join('\n'),
    advice: answer.evidence,
    next_action: answer.nextAction,
  });
  if (error) {
    throw new Error(`営業コーチ履歴の保存に失敗しました: ${error.message}`);
  }
  return rowId;
}

export type CoachLogEntry = {
  rowId: string;
  question: string;
  answer: string;
  advice: string;
  nextAction: string;
  createdAt: string;
};

export async function getCoachLogs(personId: string | undefined, limit = 30): Promise<CoachLogEntry[]> {
  const userId = await requireUserId();
  let query = supabase
    .from('coach_logs')
    .select('id,question,answer,advice,next_action,created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  query = personId ? query.eq('contact_id', toContactRowId(userId, personId)) : query.is('contact_id', null);

  const { data, error } = await query;
  if (error) {
    throw new Error(`営業コーチ履歴の取得に失敗しました: ${error.message}`);
  }
  return ((data ?? []) as Array<{
    id: string;
    question: string;
    answer: string;
    advice: string;
    next_action: string;
    created_at: string;
  }>)
    .map((row) => ({
      rowId: row.id,
      question: row.question,
      answer: row.answer,
      advice: row.advice,
      nextAction: row.next_action,
      createdAt: row.created_at,
    }))
    .reverse();
}

export type EndOfDayCheckSnapshot = {
  updatedContactNames: string[];
  memoMissingNames: string[];
  contactDateMissingNames: string[];
  actionMissingNames: string[];
  overdueNames: string[];
  tomorrowPriorities: string[];
  feedback: string;
};

export async function saveEndOfDayCheck(snapshot: EndOfDayCheckSnapshot): Promise<string> {
  const userId = await requireUserId();
  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(
    today.getDate(),
  ).padStart(2, '0')}`;
  const rowId = toContactRowId(userId, `eod-${dateKey}`);

  const { error } = await supabase.from('end_of_day_checks').upsert(
    {
      id: rowId,
      user_id: userId,
      date: dateKey,
      completed_tasks: [],
      incomplete_tasks: snapshot.overdueNames.map((name) => ({ name, reason: '次回連絡日超過' })),
      completed_events: [],
      unresolved_items: [
        ...snapshot.memoMissingNames.map((name) => ({ name, type: '後メモ未入力' })),
        ...snapshot.contactDateMissingNames.map((name) => ({ name, type: '次回連絡日未設定' })),
        ...snapshot.actionMissingNames.map((name) => ({ name, type: '次アクション未設定' })),
      ],
      contact_updates: snapshot.updatedContactNames.map((name) => ({ name })),
      data_gap_ids: [],
      feedback: snapshot.feedback,
      tomorrow_theme: '追客漏れ防止と入力漏れの解消を優先する',
      tomorrow_tasks: snapshot.tomorrowPriorities,
      status: 'completed',
    },
    { onConflict: 'id' },
  );
  if (error) {
    throw new Error(`終業後チェックの保存に失敗しました: ${error.message}`);
  }
  return rowId;
}
