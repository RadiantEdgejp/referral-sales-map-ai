import type { PersonAnalysis } from '../types/person';

export function createMockAnalysis(_memo: string): PersonAnalysis {
  const recommended = new Date();
  recommended.setDate(recommended.getDate() + 3);
  recommended.setHours(9, 0, 0, 0);

  return {
    name: '田中さん',
    industry: '美容サロン経営',
    relationship: '交流会で会った',
    categories: ['紹介元候補', '情報源候補'],
    temperatureScore: 68,
    customerPotential: 32,
    referrerPotential: 82,
    referralTargetPotential: 44,
    informationValue: 78,
    futurePotential: 65,
    openingTalk: '美容業界の採用・集客・経営者人脈について聞く',
    nextQuestion:
      '美容系の経営者さんって、最近は集客より採用の方が大変だったりしますか？',
    goal: 'まずは情報交換。2回目以降に紹介依頼を検討する。',
    roadmap: [
      '初回は売らずに美容業界の課題を聞く',
      '採用・集客・経営者人脈について情報交換する',
      '役立つ情報を1つ渡す',
      '3日以内に軽い近況LINEを送る',
      '2回目以降に紹介依頼を検討する',
    ],
    nextAction: '3日以内に軽い近況LINE。紹介依頼は2回目以降が安全。',
    lineMessage:
      '田中さん、先日はありがとうございました。美容業界の方と話す機会が増えていて、最近サロン経営者の方って採用や集客でどんな悩みが多いのか少し知りたくて。もしよければ軽く教えてもらえませんか？',
    emailMessage:
      '田中さん\n\n先日は交流会でお話しさせていただき、ありがとうございました。\n美容業界の経営者の方とお話しする機会が増えており、最近のサロン経営では採用や集客についてどのようなお悩みが多いのか、少し勉強させていただきたいと思っています。\n\nもし差し支えなければ、また短時間で情報交換させていただけますと幸いです。\nどうぞよろしくお願いいたします。',
    cautions:
      'いきなり保険の話をすると売り込み感が出る可能性がある。まずは相手の業界理解と情報交換を優先する。',
    recommendedNextContactAt: recommended.toISOString(),
  };
}

export function createCoachMockAnswer(problem: string) {
  const theme = problem.trim() || 'この人との関係の進め方';

  return {
    conclusion: '今すぐ強い紹介依頼をするより、まずは相手の業界課題を聞く相談が安全です。',
    reason:
      `「${theme}」は、相手の信頼残高がまだ十分かどうかで温度感が変わります。初回接点では依頼よりも理解を優先した方が次につながります。`,
    evidence:
      '人は自分の話を丁寧に聞かれた相手に協力しやすくなります。営業現場では、返報性・一貫性・心理的安全性を先に作るほど紹介依頼の抵抗が下がります。',
    translation:
      '売る・頼むより先に「最近どんな人が周りで困っていますか？」と聞くと、紹介ではなく会話として自然に始められます。',
    nextAction:
      '今日送るなら、短い近況LINEで1つだけ質問してください。紹介依頼は2回目以降、相手が話してくれた課題に役立つ情報を渡した後が目安です。',
  };
}
