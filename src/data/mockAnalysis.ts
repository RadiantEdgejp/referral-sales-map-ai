import type { PersonAnalysis, PersonCategory } from '../types/person';

const INDUSTRY_RULES: Array<{ pattern: RegExp; label: string; topic: string }> = [
  { pattern: /美容|サロン|エステ|ネイル|理容|美容師/, label: '美容サロン経営', topic: '美容業界' },
  { pattern: /整体|治療院|接骨|鍼灸|カイロ/, label: '整体院経営', topic: '治療院業界' },
  { pattern: /不動産|物件|賃貸|売買|仲介/, label: '不動産営業', topic: '不動産業界' },
  { pattern: /飲食|レストラン|カフェ|居酒屋|バー/, label: '飲食店経営', topic: '飲食業界' },
  { pattern: /税理士|会計士|弁護士|司法書士|社労士|行政書士|士業/, label: '士業', topic: '士業まわり' },
  { pattern: /保険|生保|損保/, label: '保険営業', topic: '保険業界' },
  { pattern: /IT|エンジニア|Web|システム|アプリ|SaaS/i, label: 'IT・Web', topic: 'IT業界' },
  { pattern: /建設|工務店|リフォーム|内装|住宅/, label: '建設・リフォーム', topic: '建設業界' },
  { pattern: /医療|クリニック|歯科|病院|介護/, label: '医療・介護', topic: '医療・介護業界' },
  { pattern: /採用|人材|求人/, label: '人材・採用支援', topic: '採用まわり' },
  { pattern: /経営|社長|代表|オーナー|起業/, label: '経営者', topic: '経営まわり' },
];

const PAIN_RULES: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /採用|人材|スタッフ|人手|定着/, label: '採用・人材定着' },
  { pattern: /集客|客が|広告|SNS|新規/, label: '集客・見込み客獲得' },
  { pattern: /リピート|継続|再来|続か/, label: 'リピート率' },
  { pattern: /固定費|コスト|経費|家賃/, label: '固定費・コスト' },
  { pattern: /資金|売上|利益|単価|赤字/, label: '売上・資金繰り' },
];

function extractName(memo: string) {
  const match = memo.match(/([一-龥々ぁ-んァ-ヶーA-Za-z]{1,8})(さん|様|氏|社長|先生)/);
  if (!match) {
    return '名前未確認の方';
  }

  const honorific = match[2] === '様' || match[2] === '氏' ? 'さん' : match[2];
  return `${match[1]}${honorific}`;
}

function inferIndustry(memo: string) {
  const hit = INDUSTRY_RULES.find((rule) => rule.pattern.test(memo));
  return hit ?? { label: '業種未確認', topic: '相手の業界' };
}

function inferRelationship(memo: string) {
  if (/交流会|イベント|セミナー|勉強会/.test(memo)) return '交流会で会った';
  if (/紹介/.test(memo)) return '知人から紹介';
  if (/友人|知人|同級生|先輩|後輩/.test(memo)) return '知人';
  if (/取引先|お客様|既存/.test(memo)) return '取引先';
  if (/SNS|オンライン|Zoom|DM/i.test(memo)) return 'オンラインで接点';
  return '接点の記録なし';
}

function inferMemoPain(memo: string) {
  return PAIN_RULES.find((rule) => rule.pattern.test(memo))?.label ?? '';
}

function inferMemoTemperature(memo: string): '高' | '中' | '低' {
  if (/興味な|不要|警戒|乗り気でな|冷たい|今すぐ.*(ない|なさそう)|忙しそう/.test(memo)) return '低';
  if (/ぜひ|前向き|会いたい|詳しく|興味あり|お願いされ/.test(memo)) return '高';
  return '中';
}

export function createMockAnalysis(memo: string): PersonAnalysis {
  const name = extractName(memo);
  const industry = inferIndustry(memo);
  const relationship = inferRelationship(memo);
  const pain = inferMemoPain(memo);
  const temperature = inferMemoTemperature(memo);
  const referralSignal = /紹介|人脈|知人|経営者仲間|コミュニティ|繋|つな|顔が広/.test(memo);
  const customerSignal = /保険|見直し|相談|検討|加入|興味/.test(memo) && temperature !== '低';
  const referralTargetSignal = /営業|案件|顧客を探|見込み|クライアント/.test(memo);
  const painTopic = pain || '経営課題';

  const categories: PersonCategory[] = [];
  if (referralSignal) categories.push('紹介元候補');
  if (pain || industry.label !== '業種未確認') categories.push('情報源候補');
  if (customerSignal) categories.push('顧客候補');
  if (referralTargetSignal) categories.push('紹介先候補');
  if (categories.length === 0) categories.push('将来候補');

  const temperatureScore = temperature === '高' ? 78 : temperature === '低' ? 42 : 62;
  const customerPotential = customerSignal ? 62 : temperature === '低' ? 22 : 35;
  const referrerPotential = referralSignal ? 80 : 48;
  const referralTargetPotential = referralTargetSignal ? 72 : 38;
  const informationValue = pain ? 78 : 55;
  const futurePotential = temperature === '低' ? 68 : 58;

  const contactDays = temperature === '高' ? 1 : temperature === '低' ? 7 : 3;
  const recommended = new Date();
  recommended.setDate(recommended.getDate() + contactDays);
  recommended.setHours(9, 0, 0, 0);

  const nextQuestion = pain
    ? `${industry.topic}の方って、最近は${painTopic}で悩んでいる方が多いですか？`
    : `${industry.topic}で、最近いちばん大変なことは何ですか？`;
  const goal = referralSignal
    ? 'まずは情報交換。2回目以降に紹介依頼を検討する。'
    : customerSignal
      ? `${painTopic}の理解を深め、役立つ情報提供から関係を作る。`
      : 'まずは関係構築。課題と人脈の広がりを確認する。';
  const nextAction =
    temperature === '低'
      ? `${contactDays}日後に売り込み感のない情報提供LINE。商品の話はしない。`
      : `${contactDays}日以内に軽い近況LINE。${referralSignal ? '紹介依頼は2回目以降が安全。' : `${painTopic}の話題から入る。`}`;
  const cautions =
    temperature === '低'
      ? '温度感が低め。売り込みは避け、負担の軽い情報提供から関係を温める。'
      : referralSignal
        ? 'いきなり紹介依頼をすると負担が大きい。まず情報交換で価値を渡してから。'
        : '初回から商品の話をすると売り込み感が出る。まず相手の課題理解を優先する。';

  return {
    name,
    industry: industry.label,
    relationship,
    categories,
    temperatureScore,
    customerPotential,
    referrerPotential,
    referralTargetPotential,
    informationValue,
    futurePotential,
    openingTalk: `${industry.topic}の${painTopic}について聞く`,
    nextQuestion,
    goal,
    roadmap: [
      `初回は売らずに${industry.topic}の課題を聞く`,
      `${painTopic}について情報交換する`,
      '役立つ情報を1つ渡す',
      `${contactDays}日以内に軽い近況LINEを送る`,
      referralSignal ? '2回目以降に紹介依頼を検討する' : '関係が温まったら次の段階を検討する',
    ],
    nextAction,
    lineMessage: `${name}、先日はありがとうございました。${industry.topic}の方とお話しする機会が増えていて、最近${painTopic}についてどんな悩みが多いのか少し知りたくて。もしよければ軽く教えてもらえませんか？`,
    emailMessage: `${name}\n\n先日はお話しさせていただき、ありがとうございました。\n${industry.topic}では最近${painTopic}についてどのようなお悩みが多いのか、少し勉強させていただきたいと思っています。\n\nもし差し支えなければ、また短時間で情報交換させていただけますと幸いです。\nどうぞよろしくお願いいたします。`,
    cautions,
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
