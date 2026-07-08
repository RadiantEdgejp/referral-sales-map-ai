import { supabase } from '../lib/supabaseClient';
import type { CoachAnswer, LineCheckAnalysis, PreMeetingNavigation } from '../ai/types';
import type { AfterMemoAiSuggestion } from '../types/aiAnalysis';
import type { Person } from '../types/person';
import { requireUserId, toContactRowId } from './personStorage';

/**
 * Issue #17: 営業フロー各画面の実行結果を Supabase に永続化する層。
 *
 * 対象テーブル:
 * - pre_meeting_navs（予定前ナビ生成結果）
 * - after_memos（後メモのAI整理結果）
 * - message_checks（文面確認のAI分析結果）
 * - coach_logs（営業コーチのやり取り）
 * - end_of_day_checks（終業後チェックのスナップショット）
 *
 * 設計メモ:
 * - 行IDは contacts と同じ `<user_id>:<client_id>` 名前空間方式
 *   （followUpStorage.ts と同一の規約）。
 * - AI生成が成功した結果のみ保存する（AI失敗時はDBに書かない: CLAUDE.md 4.4）。
 * - Supabase書き込み失敗時はエラーを投げ、ローカルへフォールバックしない
 *   （CLAUDE.md 4.2）。呼び出し側は失敗を成功として表示してはならない。
 */

function newClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

export type SavedPreMeetingNav = {
  /** pre_meeting_navs.id（名前空間付きの行ID） */
  rowId: string;
};

export async function savePreMeetingNav(input: {
  person: Person;
  actionType: string;
  memo: string;
  nav: PreMeetingNavigation;
}): Promise<SavedPreMeetingNav> {
  const { person, actionType, memo, nav } = input;
  const userId = await requireUserId();
  const rowId = toContactRowId(userId, newClientId(`${person.id}-nav`));

  const { error } = await supabase.from('pre_meeting_navs').insert({
    id: rowId,
    user_id: userId,
    contact_id: toContactRowId(userId, person.id),
    sales_route_id: null,
    calendar_event_id: null,
    action_type: actionType,
    additional_memo: memo,
    purpose: nav.purpose,
    goal_today: nav.destination,
    conversation_policy: nav.policy,
    opening_topic: nav.opening,
    main_questions: nav.questions,
    follow_up_questions: nav.deepQuestions,
    ng_actions: nav.ngActions,
    should_sell_or_listen: nav.sellOrAsk,
    referral_request_timing: nav.referralTiming,
    items_to_record_after: nav.recordItems,
    scientific_reason: nav.evidence,
    status: 'created',
  });
  if (error) {
    throw new Error(`予定前ナビの保存に失敗しました: ${error.message}`);
  }

  return { rowId };
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
}): Promise<string> {
  const { person, questions, answers, talkMemo, allInfoMemo, nextTodo, suggestion, preMeetingNavRowId } = input;
  const userId = await requireUserId();
  const rowId = toContactRowId(userId, newClientId(`${person.id}-aftermemo`));

  const { error } = await supabase.from('after_memos').insert({
    id: rowId,
    user_id: userId,
    contact_id: toContactRowId(userId, person.id),
    sales_route_id: null,
    calendar_event_id: null,
    pre_meeting_nav_id: preMeetingNavRowId ?? null,
    contact_type: '会話後メモ',
    question_answers: questions.map((question) => ({
      question,
      answer: answers[question] ?? '',
    })),
    free_memo: [
      talkMemo ? `話した内容：${talkMemo}` : '',
      allInfoMemo ? `得た情報：${allInfoMemo}` : '',
      nextTodo ? `自分が思う次アクション：${nextTodo}` : '',
    ]
      .filter(Boolean)
      .join('\n'),
    extracted_info: { accumulation: suggestion.accumulation },
    summary: suggestion.accumulation,
    update_proposal: suggestion.categoryUpdate,
    classification_update: { proposal: suggestion.categoryUpdate },
    goal_update: suggestion.goal,
    next_action: suggestion.nextAction,
    feedback: suggestion.feedback,
    next_questions: [suggestion.nextQuestion].filter(Boolean),
    saved_to_contact: true,
  });
  if (error) {
    throw new Error(`後メモの保存に失敗しました: ${error.message}`);
  }

  if (preMeetingNavRowId) {
    // 予定前ナビ側にも後メモIDを書き戻す（失敗しても後メモ本体は保存済みのため致命ではない）
    await supabase
      .from('pre_meeting_navs')
      .update({ after_memo_id: rowId, status: 'after_memo_done' })
      .eq('id', preMeetingNavRowId);
  }

  return rowId;
}

export async function saveMessageCheck(input: {
  person: Person;
  checkType: string;
  text: string;
  analysis: LineCheckAnalysis;
}): Promise<string> {
  const { person, checkType, text, analysis } = input;
  const userId = await requireUserId();
  const rowId = toContactRowId(userId, newClientId(`${person.id}-msgcheck`));

  const { error } = await supabase.from('message_checks').insert({
    id: rowId,
    user_id: userId,
    contact_id: toContactRowId(userId, person.id),
    sales_route_id: null,
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
    feedback: `良い点：${analysis.feedbackGood}\n改善点：${analysis.feedbackImprove}`,
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
}): Promise<string> {
  const { person, problem, answer } = input;
  const userId = await requireUserId();
  const rowId = toContactRowId(userId, newClientId(person ? `${person.id}-coach` : 'coach'));

  const { error } = await supabase.from('coach_logs').insert({
    id: rowId,
    user_id: userId,
    contact_id: person ? toContactRowId(userId, person.id) : null,
    sales_route_id: null,
    related_screen: 'CoachChat',
    question: problem,
    context: person ? { contactName: person.name, categories: person.categories } : {},
    answer: [answer.conclusion, answer.reason, answer.translation].filter(Boolean).join('\n'),
    advice: answer.evidence,
    next_action: answer.nextAction,
  });
  if (error) {
    throw new Error(`営業コーチのログ保存に失敗しました: ${error.message}`);
  }

  return rowId;
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
  // 同日中の再実行は同じ行を更新する（1日1スナップショット）
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
