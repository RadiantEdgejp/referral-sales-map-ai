import type { Person } from '../types/person';

export function getActionGuidance(actionType: string) {
  const guidance: Record<string, string> = {
    初回連絡前: '売らずに関係開始と課題確認を優先します。',
    商談前: '目的・質問・クロージング可否を整理します。',
    電話前: '短時間で聞くことを絞り、次の接点を決めます。',
    LINE前: '圧を弱め、返信しやすい文面にします。',
    情報交換前: '業界課題と人脈の広がりを聞きます。',
    追客前: '軽い接触で関係を切らさない文面を作ります。',
    紹介依頼前: '紹介依頼してよい段階か、先に価値提供が必要かを見ます。',
    関係構築前: '売り込みより、相手理解と信頼形成を優先します。',
  };

  return guidance[actionType] ?? '今日の目的に合わせて、聞くことと避けることを整理します。';
}

export function createPreMeetingNavigation(person: Person | undefined, actionType: string) {
  const name = person?.name ?? '相手';
  const industry = person?.industry ?? '相手の業界';
  const categories = person?.categories.join('・') ?? '分類未設定';
  const isReferralRequest = actionType === '紹介依頼前';
  const isLine = actionType === 'LINE前' || actionType === '初回連絡前';

  const questions = [
    `最近、${industry}の方って、集客と採用だとどちらで悩んでいる方が多いですか？`,
    `${name}の周りの経営者さんも、同じような悩みを持っている方は多いですか？`,
    'そういう経営者さんって、今どんな人と繋がれると助かりそうですか？',
  ];

  return {
    purpose: `${industry}の課題を聞き、この人が${categories}として進められるか判断する。`,
    destination: isReferralRequest
      ? '紹介依頼してよい段階かを確認する。早ければ、先に情報提供や人の紹介へ切り替える。'
      : '紹介依頼まではしない。まず周辺課題と人脈の有無を確認する。',
    policy: isLine
      ? '短く、返信しやすく、相手の負担が少ない聞き方にする。'
      : '売り込みではなく、相手の業界理解と情報交換を優先する。',
    opening: `最近の${industry}まわりでは、集客・採用・人材定着のどこが重いのかを聞く。`,
    questions,
    deepQuestions: [
      'その悩みって、ここ最近強くなっている感じですか？',
      '周りで特に困っている方はいますか？',
      '逆に、最近うまくいっている人は何が違うと思いますか？',
    ],
    ngActions: [
      'いきなり保険や商品への興味を聞く',
      'すぐに誰か紹介してほしいと頼む',
      '相手の状況を聞かずに商品説明を始める',
    ],
    sellOrAsk: '今日は聞く日。本人への提案や紹介依頼はまだ早い。',
    referralTiming: isReferralRequest
      ? '依頼前に、相手が紹介するメリットと紹介先の条件を確認する。負担が大きそうなら延期する。'
      : 'まだ早い。まずは情報交換をして、相手にとって話すメリットを作る。紹介依頼は2回目以降が安全。',
    recordItems: [
      '採用と集客のどちらが課題か',
      '周りの経営者にも同じ悩みがあるか',
      '紹介できそうな人がいるか',
      `${name}本人の温度感`,
      '次回連絡してよいタイミング',
      'こちらから価値提供できそうな情報',
    ],
    evidence: [
      'いきなり売ると心理的リアクタンスが起きやすい',
      '質問を絞ると相手の認知負荷が下がり、答えやすくなる',
      '先に情報交換や価値提供を挟むと、返報性が働きやすくなる',
      '紹介依頼は相手の信用を使う行為なので、信頼形成前に頼むと負担が大きい',
    ],
    coachPrompt: `${name}との${actionType}です。今日の目的は、${industry}の課題を聞いて、${categories}として進められるか判断することです。今日の質問や進め方が適切か確認してください。`,
  };
}

export type PreMeetingNavigation = ReturnType<typeof createPreMeetingNavigation>;
