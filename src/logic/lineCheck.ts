import type { Person } from '../types/person';
import { isDueToday } from './personPriority';

export const LINE_CHECK_TYPES = ['受信文チェック', '返信作成', '送信前チェック', '断り返信', '紹介依頼文', 'お礼文', 'スクショメモ', '音声メモ'] as const;
export const LINE_PERSON_FILTERS = ['今日予定', '最近やり取り', '次アクションあり', '返信待ち', '最近追加', '全員'] as const;
export const LINE_NOTICE_OPTIONS = ['明日 9:00', '3日後 9:00', '1週間後 9:00', '返信がなければ3日後', '通知なし'];

export type LineCheckType = (typeof LINE_CHECK_TYPES)[number];
export type LinePersonFilter = (typeof LINE_PERSON_FILTERS)[number];

export function matchesLinePersonFilter(person: Person, filter: LinePersonFilter) {
  if (filter === '全員') return true;
  if (filter === '今日予定') return isDueToday(person);
  if (filter === '最近やり取り') return Boolean(person.additionalMemo);
  if (filter === '次アクションあり') return Boolean(person.nextAction);
  if (filter === '返信待ち') return person.nextAction.includes('返信');
  if (filter === '最近追加') {
    return Date.now() - new Date(person.createdAt).getTime() < 1000 * 60 * 60 * 24 * 14;
  }
  return true;
}

export function getLinePersonStatus(person: Person) {
  if (isDueToday(person)) return '今日連絡';
  if (person.nextAction.includes('返信')) return '返信待ち';
  if (person.additionalMemo) return 'やり取りあり';
  return person.nextAction ? '次アクションあり' : '最近追加';
}

export function getLineCheckTypeGuide(type: LineCheckType) {
  const guides: Record<LineCheckType, string> = {
    送信前チェック: '売り込み感、圧の強さ、返信しやすさ、相手メリットを確認します。',
    受信文チェック: '相手の返信から、課題・温度感・興味・次に聞く質問を抽出します。',
    返信作成: '相手の文脈と人脈カードを参照して、次につながる返信文を作ります。',
    スクショメモ: 'スクショから読み取った内容を雑に書いて、人脈カード更新案に変えます。',
    音声メモ: '移動中の音声メモを営業データに整理する想定です。',
    断り返信: '断り理由を抽出し、関係を切らさない次アクションを作ります。',
    紹介依頼文: '紹介依頼してよい段階か、依頼文が重すぎないかを確認します。',
    お礼文: '会った直後のお礼文から、次回接触と後メモにつながる文面を作ります。',
  };

  return guides[type];
}

export function createLineCheckAnalysis(person: Person | undefined, checkType: LineCheckType, text: string) {
  const name = person?.name ?? '相手';
  const source = text || '相手から「最近はリピート率が課題ですね。新規は来るけど続かないです」と返信が来た。';
  const issue = inferLineIssue(source);
  const isRefusal = /断|不要|今は|難しい|また|検討|忙しい/.test(source) || checkType === '断り返信';
  const hasReferralSignal = /紹介|知人|経営者|周り|つな|繋/.test(source);
  const hasConcretePain = /課題|困|悩|大変|リピート|採用|集客|広告|固定費|売上/.test(source);
  const isBeforeSend = checkType === '送信前チェック' || checkType === '紹介依頼文' || checkType === 'お礼文';
  const temperatureLabel = isRefusal ? '低い〜普通' : hasConcretePain ? '普通〜やや高い' : '普通';
  const proposalReadiness = hasConcretePain && !isBeforeSend && !isRefusal ? '商品提案はまだ早い。課題の深掘りと情報提供を優先。' : '今は提案より関係維持と確認が安全。';
  const nextQuestion = createLineNextQuestion(issue, person, hasReferralSignal);
  const replyDraft = createLineReplyDraft(name, issue, isRefusal, hasReferralSignal);
  const categoryUpdate = [
    `顧客候補：${hasConcretePain ? '中' : '低〜中'}`,
    `将来候補：${isRefusal ? '中' : '高'}`,
    `情報源候補：${hasReferralSignal ? '高' : '中'}`,
  ].join('\n');
  const nextAction = isRefusal
    ? '断り理由を保存し、1週間後に負担の軽い情報提供で再接触する'
    : `返信後、${issue.shortLabel}について本人と周辺人脈の両方を深掘りする`;

  return {
    judgement: isBeforeSend
      ? '送信前の文面は、相手の状況確認を先に置くと安全です。売り込み感を抑え、返信しやすい一問に絞ってください。'
      : `この返信は${hasConcretePain ? '前向きな材料があります' : '会話継続の余地があります'}。ただし、今すぐ商品提案ではなく、課題の深掘りと情報提供を優先してください。`,
    temperature: {
      label: temperatureLabel,
      reason: hasConcretePain
        ? '自分の課題を具体的に話しているため、会話継続の余地があります。ただし商品への興味ではなく、経営課題への関心です。'
        : isRefusal
          ? '明確な前進サインは弱いですが、断り理由を保存すれば次回の接点設計に使えます。'
          : '温度感はまだ判断途中です。次の一問で課題の具体度を確認する必要があります。',
    },
    extracted: [
      { label: '課題', value: issue.label },
      { label: '状況', value: issue.situation },
      { label: '興味', value: issue.interest },
      { label: '断り理由', value: isRefusal ? '今すぐ進める負担、またはタイミングの問題がある可能性' : '現時点では明確な断りなし' },
      { label: '現時点の提案可否', value: proposalReadiness },
      { label: '人脈価値', value: hasReferralSignal ? '周辺経営者や知人情報を取れる可能性あり' : '周辺人脈にも同じ課題があるか確認が必要' },
    ],
    nextQuestion,
    questionPurpose: '本人だけでなく、周辺人脈にも同じ課題があるか確認し、紹介元・情報源としての価値を判断する。',
    replyDraft,
    cardUpdate: [
      '追加する情報：',
      `・課題：${issue.label}`,
      `・関心：${issue.interest}`,
      `・温度感：${temperatureLabel}`,
      `・注意点：${proposalReadiness}`,
      `・次回の切り口：${issue.shortLabel}と周辺人脈の課題`,
      '',
      '分類更新案：',
      categoryUpdate,
    ].join('\n'),
    categoryUpdate,
    nextAction,
    nextContact: isRefusal ? '1週間後 9:00' : '返信待ち / 返信がなければ3日後 9:00',
    caution: isRefusal
      ? '断られた直後に説得すると負担が増えます。まず理由を保存し、軽い情報提供で接点を残してください。'
      : 'ここで保険や商品提案に進むと早すぎる可能性があります。まずは相手の課題を深掘りし、情報提供できる関係を作ってください。',
    feedbackGood: hasConcretePain ? '相手の課題を引き出せています。' : '会話を営業データとして残す流れを作れています。',
    feedbackImprove: '次は本人の課題だけでなく、周辺人脈にも同じ課題があるか聞くと、紹介元・情報源としての価値を判断しやすくなります。',
    coachPrompt: `${name}から${issue.shortLabel}に関する返信が来ました。今すぐ提案するのではなく、課題を深掘りして関係を温めたいです。次にどう返信するべきか相談したいです。`,
  };
}

export type LineCheckAnalysis = ReturnType<typeof createLineCheckAnalysis>;

function inferLineIssue(text: string) {
  if (/リピート|継続|再来|続か/.test(text)) {
    return {
      label: 'リピート率',
      shortLabel: 'リピート率',
      situation: '新規は来るが継続率が低い',
      interest: '再来店施策、SNS運用、店舗改善',
    };
  }
  if (/採用|スタッフ|人材|定着/.test(text)) {
    return {
      label: '採用・スタッフ定着',
      shortLabel: '採用課題',
      situation: '人手不足やスタッフ定着に悩んでいる可能性',
      interest: '採用導線、定着施策、経営者同士の情報交換',
    };
  }
  if (/集客|広告|SNS|新規/.test(text)) {
    return {
      label: '集客・広告費',
      shortLabel: '集客課題',
      situation: '新規獲得や広告費の効率に課題がある可能性',
      interest: 'SNS運用、紹介導線、広告費改善',
    };
  }
  if (/固定費|経費|コスト|家賃/.test(text)) {
    return {
      label: '固定費・経費',
      shortLabel: '固定費',
      situation: '店舗運営コストの見直し余地がある可能性',
      interest: '固定費削減、経営改善、資金繰り',
    };
  }
  return {
    label: '経営課題',
    shortLabel: '経営課題',
    situation: '課題の具体度はまだ不足',
    interest: '情報交換、課題整理、周辺人脈の状況確認',
  };
}

function createLineNextQuestion(issue: ReturnType<typeof inferLineIssue>, person: Person | undefined, hasReferralSignal: boolean) {
  if (hasReferralSignal) {
    return `${person?.industry ?? '同じ業界'}の周りの方も、${issue.shortLabel}で悩んでいる方は多いですか？`;
  }
  return `周りの${person?.industry ?? '経営者'}さんも、${issue.shortLabel}で悩んでいる方は多いですか？`;
}

function createLineReplyDraft(name: string, issue: ReturnType<typeof inferLineIssue>, isRefusal: boolean, hasReferralSignal: boolean) {
  if (isRefusal) {
    return `${name}さん、ありがとうございます。今すぐ進める話ではなくて大丈夫です。ちなみに今後の参考までに、今はタイミングの問題なのか、内容自体が少し違う感じなのかだけ軽く教えてもらえますか？`;
  }

  const relationQuestion = hasReferralSignal
    ? `ちなみに周りの方も、${issue.shortLabel}で悩んでいる方は多いですか？`
    : `ちなみに周りの経営者さんも、${issue.shortLabel}で悩んでいる方は多いですか？`;

  return `${name}さん、ありがとうございます。${issue.situation}というのは、かなり大きい課題ですね。${relationQuestion}`;
}
