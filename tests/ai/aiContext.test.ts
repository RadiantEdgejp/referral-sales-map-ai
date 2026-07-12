import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: { auth: { getSession: vi.fn() }, from: vi.fn() },
}));

import { assembleContactAIContext } from '../../src/ai/aiContext';
import { formatAIContextForPrompt } from '../../src/ai/contextFormatter';
import { ollamaProvider } from '../../src/ai/providers/ollamaProvider';
import type { AiContextRows } from '../../src/storage/aiContextStorage';
import { summarizePersonHistoryRows } from '../../src/storage/personHistorySummary';
import type { Person } from '../../src/types/person';

const person: Person = {
  id: 'contact-1', name: '山本さん', industry: '整体院経営', relationship: '知人から紹介',
  categories: [], openingTalk: '', nextQuestion: '', goal: '店舗課題を把握する', roadmap: ['課題確認'],
  nextAction: '情報交換', lineMessage: '', emailMessage: '', cautions: '売り込みを急がない',
  recommendedNextContactAt: '', rawMemo: '紹介者の信頼を損なわない', createdAt: '2026-07-01T00:00:00Z',
};

function rows(): AiContextRows {
  return {
    salesRoutes: [{ id: 'route-1', route_type: '顧客化', goal: '課題把握', current_stage: '情報交換', next_step: '事例共有', priority: 'high', status: 'active', reason: '課題が具体化', confidence: 0.6 }],
    calendarEvents: [{ id: 'event-1', sales_route_id: 'route-1', title: '情報交換', event_type: 'meeting', start_at: '2026-07-12T04:00:00Z', end_at: '2026-07-12T05:00:00Z', purpose: '課題確認', meeting_method: 'online', status: 'completed' }],
    preMeetingNavs: [{ id: 'nav-1', sales_route_id: 'route-1', calendar_event_id: 'event-1', purpose: '課題確認', goal_today: '優先度を聞く', main_questions: ['今一番困っていることは？'], items_to_record_after: ['課題の優先度'], status: 'saved' }],
    afterMemos: [{ id: 'memo-1', sales_route_id: 'route-1', calendar_event_id: 'event-1', summary: '採用時期は未定。以前は忙しく今は必要ないとの回答。', extracted_info: { 採用人数: '2名', 採用時期: '未定' }, temperature: '低め', interest_direction: '将来検討', next_progress: '保留', next_action: '1か月後に軽く確認', next_questions: ['状況が変わったか'], created_at: '2026-07-12T06:00:00Z' }],
    messageChecks: [{ id: 'msg-1', sales_route_id: 'route-1', check_type: '受信文', extracted_info: { 状況: '今は忙しい' }, temperature: '低い', judgement: '今は必要ないため深追いしない', reply_policy: '短く関係を残す', reply_text: '承知しました。必要な際はお声がけください。', next_action: 'こちらから追わない', feedback: '追加質問をしない', created_at: '2026-07-12T07:00:00Z' }],
    interactionLogs: [{ id: 'log-1', type: 'message_received', title: '断り返信を受信', summary: '相手は今は忙しく必要ないと回答した', source_type: 'message_check', happened_at: '2026-07-12T07:00:00Z' }],
    updateHistories: [{ id: 'update-1', source_type: 'after_memo', summary: '温度感を低めへ更新', updated_fields: ['temperature', 'next_step'], created_at: '2026-07-12T07:10:00Z' }],
    dataGaps: [{ id: 'gap-1', sales_route_id: 'route-1', gap_type: 'timing', title: '再検討時期', reason: '時期を聞けていない', severity: 'high', target_screen: 'AfterMemo', status: 'open', created_at: '2026-07-12T07:20:00Z' }],
    actionTasks: [{ id: 'task-1', title: '1か月後に状況確認', due_date: '2026-08-12T00:00:00Z', status: 'open', updated_at: '2026-07-12T07:30:00Z' }],
  };
}

const grounding = { confirmedFacts: ['採用時期は未定'], hypotheses: [], unknowns: ['再検討時期'], cautions: ['深追いしない'] };
function completeLlmJson(nextAction = '深追いせず、相手からの連絡を待つ') {
  return {
    purpose: '状況確認', destination: '負担なく関係を残す', policy: '聞く', opening: '近況確認',
    questions: ['状況に変化はありましたか？'], deepQuestions: ['必要ならいつでも声をかけてください'], ngActions: ['紹介を迫る'],
    sellOrAsk: '聞く', referralTiming: 'まだ早い', recordItems: ['状況'], evidence: ['心理的負担を下げる'],
    categoryUpdate: '維持', goal: '関係維持', nextAction, nextContact: '1週間後 9:00', feedback: '引く判断を優先',
    nextQuestion: '追加質問なし', lineMessage: '承知しました。', accumulation: '低温度のため保留', unresolvedGaps: [], resolvedGapTypes: [],
    judgement: '低温度のため深追いしない', temperatureLabel: '低い', temperatureReason: '断り表現がある', painPoint: '未確認', situation: '忙しい', interest: '未確認', refusalReason: '今は必要ない', proposalReadiness: '提案不可', networkValue: '未確認', questionPurpose: 'なし', replyDraft: '承知しました。必要な際はお声がけください。', caution: '追加質問しない', feedbackGood: '押していない', feedbackImprove: '関係を残す',
    conclusion: '今は引く', reason: '保存済み履歴で低温度が確認できる', translation: '追加連絡をせず待つ',
    grounding,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('Issue #24 AI context', () => {
  it('builds a bounded context and separates facts, hypotheses, unknowns and cautions', () => {
    const context = assembleContactAIContext(person, rows(), '2026-07-12T08:00:00Z');
    expect(context.salesRoute?.id).toBe('route-1');
    expect(context.calendarEvent?.id).toBe('event-1');
    expect(context.preMeetingNav?.id).toBe('nav-1');
    expect(context.confirmedFacts).toContain('採用人数: 2名');
    expect(context.hypotheses).toContain('現在の営業仮説: 店舗課題を把握する');
    expect(context.unknowns.some((item) => item.includes('再検討時期'))).toBe(true);
    expect(context.cautions.some((item) => item.includes('低温度'))).toBe(true);
    expect(context.afterMemoSummaries).toHaveLength(1);
    expect(context.temperatureHistory).toHaveLength(1);
    expect(context.updateHistories).toHaveLength(1);
    expect(context.confirmedFacts.length).toBeLessThanOrEqual(12);
    expect(JSON.stringify(context).length).toBeLessThan(12000);
  });

  it('formats explicit evidence classes and newest saved history for the prompt', () => {
    const prompt = formatAIContextForPrompt(assembleContactAIContext(person, rows()));
    expect(prompt).toContain('【確認済みの事実】');
    expect(prompt).toContain('【仮説（断定禁止）】');
    expect(prompt).toContain('以前は忙しく今は必要ない');
    expect(prompt).toContain('確認済み事実と仮説を混同せず');
  });

  it('derives person detail counts and next step from the same rows as AI context', () => {
    const source = rows();
    const context = assembleContactAIContext(person, source);
    const summary = summarizePersonHistoryRows(source);
    expect(summary).toMatchObject({
      afterMemoCount: 1,
      messageCheckCount: 1,
      interactionCount: 1,
      updateHistoryCount: 1,
      unresolvedGapCount: 1,
      salesRouteCount: 1,
      latestNextStep: '事例共有',
    });
    expect(context.salesRoute?.nextStep).toBe(summary.latestNextStep);
  });

  it('passes the same saved context into message, coach, pre-meeting and after-memo prompts', async () => {
    const prompts: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { prompt: string };
      prompts.push(body.prompt);
      return new Response(JSON.stringify({ response: JSON.stringify(completeLlmJson()) }), { status: 200 });
    }));
    const context = assembleContactAIContext(person, rows());

    await ollamaProvider.analyzeMessageCheck({ person, checkType: '受信文', text: 'またタイミングが合えば', context });
    await ollamaProvider.coachChat({ person, problem: '次にどう進める？', context });
    await ollamaProvider.createPreMeetingNav({ person, actionType: '情報交換前', context });
    await ollamaProvider.analyzeAfterMemo({ person, answers: { 質問: '今は必要ない' }, talkMemo: '', allInfoMemo: '', nextTodo: '', context });

    expect(prompts).toHaveLength(4);
    for (const prompt of prompts) {
      expect(prompt).toContain('採用人数: 2名');
      expect(prompt).toContain('今は必要ないため深追いしない');
      expect(prompt).toContain('事実と仮説');
    }
  });

  it('uses saved low-temperature history to change the next AI output', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      const prompt = (JSON.parse(String(init?.body)) as { prompt: string }).prompt;
      const nextAction = prompt.includes('今は必要ないため深追いしない')
        ? '深追いせず、相手からの連絡を待つ'
        : '明日もう一度連絡する';
      return new Response(JSON.stringify({ response: JSON.stringify(completeLlmJson(nextAction)) }), { status: 200 });
    }));

    const withoutHistory = assembleContactAIContext(person, { ...rows(), messageChecks: [], interactionLogs: [] });
    const withHistory = assembleContactAIContext(person, rows());
    const first = await ollamaProvider.analyzeMessageCheck({ person, checkType: '受信文', text: '承知しました', context: withoutHistory });
    const second = await ollamaProvider.analyzeMessageCheck({ person, checkType: '受信文', text: '承知しました', context: withHistory });

    expect(first.nextAction).toBe('明日もう一度連絡する');
    expect(second.nextAction).toBe('深追いせず、相手からの連絡を待つ');
  });
});
