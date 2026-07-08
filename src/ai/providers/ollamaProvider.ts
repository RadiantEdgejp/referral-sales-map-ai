import type { AfterMemoAiSuggestion } from '../../types/aiAnalysis';
import type { Person, PersonAnalysis, PersonCategory } from '../../types/person';
import { LlmError, type LlmAdapter, type LineCheckAnalysis, type PreMeetingNavigation } from '../types';

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'llama3:latest';
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_ATTEMPTS = 2;

const VALID_CATEGORIES: PersonCategory[] = ['顧客候補', '紹介元候補', '紹介先候補', '情報源候補', '将来候補'];
const NEXT_CONTACT_OPTIONS = ['明日 9:00', '3日後 9:00', '1週間後 9:00'];

function getBaseUrl() {
  return (process.env.EXPO_PUBLIC_OLLAMA_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

function getModel() {
  return process.env.EXPO_PUBLIC_OLLAMA_MODEL || DEFAULT_MODEL;
}

type JsonObject = Record<string, unknown>;

async function generateJson(prompt: string): Promise<JsonObject> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${getBaseUrl()}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getModel(),
        prompt,
        stream: false,
        format: 'json',
        options: { temperature: 0.3, num_predict: 1024 },
      }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LlmError('timeout', 'AIの応答が制限時間内に返りませんでした。');
    }
    throw new LlmError('network', 'Ollamaに接続できませんでした。Ollamaが起動しているか確認してください。');
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new LlmError('network', `Ollamaがエラーを返しました（HTTP ${response.status}）。モデル設定を確認してください。`);
  }

  let payload: { response?: string };
  try {
    payload = await response.json();
  } catch {
    throw new LlmError('invalid_output', 'Ollamaの応答を読み取れませんでした。');
  }

  try {
    const parsed = JSON.parse(payload.response ?? '');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed as JsonObject;
  } catch {
    throw new LlmError('invalid_output', 'AIの出力がJSONとして解釈できませんでした。');
  }
}

/**
 * invalid_output（JSON崩れ・必須欠落）のみ1回リトライする。
 * ネットワーク断・タイムアウトはリトライしても回復しないため即時失敗させる。
 */
async function generateValidated<T>(prompt: string, validate: (raw: JsonObject) => T): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return validate(await generateJson(prompt));
    } catch (error) {
      lastError = error;
      if (error instanceof LlmError && error.kind === 'invalid_output' && attempt < MAX_ATTEMPTS) {
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function str(raw: JsonObject, key: string, fallback = ''): string {
  const value = raw[key];
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number') return String(value);
  return fallback;
}

function requireStr(raw: JsonObject, key: string): string {
  const value = str(raw, key);
  if (!value) {
    throw new LlmError('invalid_output', `AI出力に必須項目「${key}」が含まれていませんでした。`);
  }
  return value;
}

function strArray(raw: JsonObject, key: string, fallback: string[] = []): string[] {
  const value = raw[key];
  if (!Array.isArray(value)) return fallback;
  const items = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim());
  return items.length > 0 ? items : fallback;
}

function score(raw: JsonObject, key: string, fallback: number): number {
  const value = raw[key];
  const num = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(num)) return fallback;
  return Math.min(100, Math.max(0, Math.round(num)));
}

function categories(raw: JsonObject, key: string): PersonCategory[] {
  const value = raw[key];
  if (!Array.isArray(value)) return ['将来候補'];
  const picked = value.filter((item): item is PersonCategory => VALID_CATEGORIES.includes(item as PersonCategory));
  return picked.length > 0 ? [...new Set(picked)] : ['将来候補'];
}

function personContext(person?: Person) {
  if (!person) return '（人脈カード未選択）';
  return [
    `名前: ${person.name}`,
    person.company ? `会社: ${person.company}` : '',
    person.role ? `役職: ${person.role}` : '',
    `業種: ${person.industry}`,
    `関係性: ${person.relationship}`,
    `分類: ${person.categories.join('・')}`,
    `現在のゴール: ${person.goal}`,
    `次アクション: ${person.nextAction}`,
    `注意点: ${person.cautions}`,
    person.rawMemo ? `初回メモ: ${person.rawMemo.slice(0, 400)}` : '',
    person.additionalMemo ? `直近のやり取りメモ（抜粋）: ${person.additionalMemo.slice(-600)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

const COMMON_RULES = `あなたは紹介営業（リファラル営業）を支援するAIです。
ルール:
- 必ずJSONオブジェクトのみを出力する。前置きや説明文は書かない。
- すべての値は日本語で書く。空文字・null・省略は禁止。
- 事実の捏造をしない。入力にない予算・期限・約束を作らない。
- 売り込みを急がせない。関係構築と課題理解を優先する提案にする。`;

export const ollamaProvider: LlmAdapter = {
  name: 'ollama',

  async analyzePerson(input) {
    const prompt = `${COMMON_RULES}

以下の人物メモを分析し、人脈カードを作るためのJSONを出力してください。

人物メモ:
${input.memo}

出力するJSONのキーと内容:
{
  "name": "呼び名（例: 田中さん。メモに名前がなければ「名前未確認の方」）",
  "industry": "業種ラベル（不明なら「業種未確認」）",
  "relationship": "接点・関係性（不明なら「接点の記録なし」）",
  "categories": ["顧客候補","紹介元候補","紹介先候補","情報源候補","将来候補" のうち該当するものの配列],
  "temperatureScore": 0-100の数値（相手の温度感）,
  "customerPotential": 0-100の数値,
  "referrerPotential": 0-100の数値（紹介元としての可能性）,
  "referralTargetPotential": 0-100の数値,
  "informationValue": 0-100の数値,
  "futurePotential": 0-100の数値,
  "openingTalk": "次に会うときの最初の話題",
  "nextQuestion": "次に聞くべき質問（1文）",
  "goal": "この人との当面のゴール（1文）",
  "roadmap": ["関係を進める手順を3〜5個の配列で"],
  "nextAction": "次の具体アクション（いつ・何をするか）",
  "lineMessage": "そのまま送れる自然なLINE文面（2〜3文）",
  "emailMessage": "そのまま送れる丁寧なメール文面",
  "cautions": "注意点・NG行動（1〜2文）",
  "recommendedContactDays": 次に連絡するまでの日数（1か3か7の数値）
}`;

    return generateValidated(prompt, (raw): PersonAnalysis => {
      const name = requireStr(raw, 'name');
      const nextQuestion = requireStr(raw, 'nextQuestion');
      const goal = requireStr(raw, 'goal');
      const nextAction = requireStr(raw, 'nextAction');
      const industry = str(raw, 'industry', '業種未確認');
      const lineMessage = str(raw, 'lineMessage', `${name}、先日はありがとうございました。${nextQuestion}`);

      const days = [1, 3, 7].includes(Number(raw.recommendedContactDays)) ? Number(raw.recommendedContactDays) : 3;
      const recommended = new Date();
      recommended.setDate(recommended.getDate() + days);
      recommended.setHours(9, 0, 0, 0);

      return {
        name,
        industry,
        relationship: str(raw, 'relationship', '接点の記録なし'),
        categories: categories(raw, 'categories'),
        temperatureScore: score(raw, 'temperatureScore', 55),
        customerPotential: score(raw, 'customerPotential', 40),
        referrerPotential: score(raw, 'referrerPotential', 50),
        referralTargetPotential: score(raw, 'referralTargetPotential', 40),
        informationValue: score(raw, 'informationValue', 55),
        futurePotential: score(raw, 'futurePotential', 55),
        openingTalk: str(raw, 'openingTalk', nextQuestion),
        nextQuestion,
        goal,
        roadmap: strArray(raw, 'roadmap', [nextAction]),
        nextAction,
        lineMessage,
        emailMessage: str(raw, 'emailMessage', lineMessage),
        cautions: str(raw, 'cautions', '初回から売り込み感を出さず、相手の課題理解を優先する。'),
        recommendedNextContactAt: recommended.toISOString(),
      };
    });
  },

  async createPreMeetingNav(input) {
    const prompt = `${COMMON_RULES}

これから「${input.actionType}」の接触をします。以下の人脈カード情報を参照して、予定前ナビをJSONで出力してください。

人脈カード:
${personContext(input.person)}
${input.memo?.trim() ? `\n当日の追加メモ:\n${input.memo.trim()}` : ''}

出力するJSONのキーと内容:
{
  "purpose": "今日の目的（1文）",
  "destination": "今日の到達点（どこまで進めば成功か、1文）",
  "policy": "今日の会話方針（1文）",
  "opening": "最初の一言・入り方",
  "questions": ["今日必ず聞く質問をちょうど3個の配列で"],
  "deepQuestions": ["深掘り質問を3個の配列で"],
  "ngActions": ["今日やってはいけない行動を3個の配列で"],
  "sellOrAsk": "今日は売る日か聞く日かの判断（1文）",
  "referralTiming": "紹介依頼をしてよい段階かの判断（1〜2文）",
  "recordItems": ["会話後に記録すべき項目を4〜6個の配列で"],
  "evidence": ["この進め方の営業科学的な根拠を3個の配列で"]
}`;

    return generateValidated(prompt, (raw): PreMeetingNavigation => {
      const purpose = requireStr(raw, 'purpose');
      const questions = strArray(raw, 'questions');
      if (questions.length === 0) {
        throw new LlmError('invalid_output', 'AI出力に必須項目「questions」が含まれていませんでした。');
      }

      const name = input.person?.name ?? '相手';
      return {
        purpose,
        destination: str(raw, 'destination', 'まず周辺課題と人脈の有無を確認する。'),
        policy: str(raw, 'policy', '売り込みではなく、相手の業界理解と情報交換を優先する。'),
        opening: str(raw, 'opening', questions[0]),
        questions: questions.slice(0, 3),
        deepQuestions: strArray(raw, 'deepQuestions', ['その悩みは、ここ最近強くなっていますか？']),
        ngActions: strArray(raw, 'ngActions', ['相手の状況を聞かずに商品説明を始める']),
        sellOrAsk: str(raw, 'sellOrAsk', '今日は聞く日。本人への提案や紹介依頼はまだ早い。'),
        referralTiming: str(raw, 'referralTiming', 'まだ早い。まずは情報交換をして、相手にとって話すメリットを作る。'),
        recordItems: strArray(raw, 'recordItems', ['相手の課題', '温度感', '次回連絡してよいタイミング']),
        evidence: strArray(raw, 'evidence', ['先に情報交換や価値提供を挟むと、返報性が働きやすくなる']),
        coachPrompt: `${name}との${input.actionType}です。今日の目的は「${purpose}」です。今日の質問や進め方が適切か確認してください。`,
      };
    });
  },

  async analyzeAfterMemo(input) {
    const answers = Object.entries(input.answers)
      .filter(([, value]) => value.trim())
      .map(([question, value]) => `Q: ${question}\nA: ${value}`)
      .join('\n');
    const prompt = `${COMMON_RULES}

商談・会話の後メモを分析し、人脈カードの更新案をJSONで出力してください。

人脈カード:
${personContext(input.person)}

質問への回答:
${answers || '（未入力）'}

話した内容:
${input.talkMemo || '（未入力）'}

得た情報すべて:
${input.allInfoMemo || '（未入力）'}

本人が考える次アクション（最優先で尊重する）:
${input.nextTodo || '（未入力）'}

出力するJSONのキーと内容:
{
  "categoryUpdate": "分類（顧客候補/紹介元候補/紹介先候補/情報源候補/将来候補）の更新方針（1〜2文）",
  "goal": "更新後のゴール（1文）",
  "nextAction": "次の具体アクション（本人の次アクション案があればそれを優先）",
  "nextContact": "「明日 9:00」「3日後 9:00」「1週間後 9:00」のいずれか1つ",
  "feedback": "今日の会話への営業フィードバック（2〜3文）",
  "nextQuestion": "次回聞くべき質問（1文）",
  "lineMessage": "会話のお礼と次につながる自然なLINE文面（2〜3文）",
  "accumulation": "人脈カードに蓄積する要点の箇条書き（課題・温度感・紹介可能性・決裁/期限/予算の有無・次回連絡。改行区切りの1つの文字列）"
}`;

    return generateValidated(prompt, (raw): AfterMemoAiSuggestion => {
      const goal = requireStr(raw, 'goal');
      const nextAction = input.nextTodo.trim() || requireStr(raw, 'nextAction');
      const feedback = requireStr(raw, 'feedback');
      const nextContactRaw = str(raw, 'nextContact');
      const nextContact = NEXT_CONTACT_OPTIONS.find((option) => nextContactRaw.includes(option.replace(' 9:00', ''))) ?? '3日後 9:00';
      const name = input.person?.name ?? 'この人';

      return {
        categoryUpdate: str(raw, 'categoryUpdate', '現状の分類を維持。紹介依頼は急がず、関係構築を優先。'),
        goal,
        nextAction,
        nextContact,
        feedback,
        nextQuestion: str(raw, 'nextQuestion', '周りの経営者にも同じ悩みがあるか確認する。'),
        lineMessage: str(raw, 'lineMessage', `${name}さん、今日はありがとうございました。お話に出ていた件、参考になりそうな情報を探してみます。`),
        accumulation: str(raw, 'accumulation', `AIフィードバック：${feedback}`),
      };
    });
  },

  async analyzeMessageCheck(input) {
    const prompt = `${COMMON_RULES}

LINE・DMの文面チェック（種別: ${input.checkType}）です。以下の文面と人脈カードを分析し、JSONで出力してください。

人脈カード:
${personContext(input.person)}

対象の文面:
${input.text}

出力するJSONのキーと内容:
{
  "judgement": "今どう返すべきかの結論（1〜2文）",
  "temperatureLabel": "相手の温度感（例: 低い / 低い〜普通 / 普通 / 普通〜やや高い / 高い）",
  "temperatureReason": "温度感の判断理由（1〜2文）",
  "painPoint": "読み取れた課題（なければ「未確認」）",
  "situation": "相手の状況（1文）",
  "interest": "相手の関心事",
  "refusalReason": "断り・後ろ向きサインの内容（なければ「現時点では明確な断りなし」）",
  "proposalReadiness": "今、商品提案してよいかの判断（1文）",
  "networkValue": "紹介元・情報源としての人脈価値の見立て（1文）",
  "nextQuestion": "次に聞くべき質問（1文）",
  "questionPurpose": "その質問の目的（1文）",
  "replyDraft": "そのまま送れる自然な返信文面（2〜3文）",
  "categoryUpdate": "分類の更新案（1〜2文）",
  "nextAction": "次の具体アクション（1文）",
  "nextContact": "次回連絡の目安（例: 明日 9:00 / 3日後 9:00 / 1週間後 9:00 / 返信待ち）",
  "caution": "注意点（1〜2文）",
  "feedbackGood": "今回のやり取りの良い点（1文）",
  "feedbackImprove": "改善点（1文）"
}`;

    return generateValidated(prompt, (raw): LineCheckAnalysis => {
      const judgement = requireStr(raw, 'judgement');
      const replyDraft = requireStr(raw, 'replyDraft');
      const nextAction = requireStr(raw, 'nextAction');
      const temperatureLabel = str(raw, 'temperatureLabel', '判断中');
      const painPoint = str(raw, 'painPoint', '未確認');
      const interest = str(raw, 'interest', '未確認');
      const proposalReadiness = str(raw, 'proposalReadiness', '今は提案より関係維持と確認が安全。');
      const categoryUpdate = str(raw, 'categoryUpdate', '現状の分類を維持。');
      const caution = str(raw, 'caution', '売り込みを急がず、相手の課題理解を優先する。');
      const nextQuestion = str(raw, 'nextQuestion', '周りでも同じ課題で悩んでいる方は多いですか？');
      const name = input.person?.name ?? '相手';

      return {
        judgement,
        temperature: {
          label: temperatureLabel,
          reason: str(raw, 'temperatureReason', '温度感はまだ判断途中です。次の一問で確認が必要です。'),
        },
        extracted: [
          { label: '課題', value: painPoint },
          { label: '状況', value: str(raw, 'situation', '未確認') },
          { label: '興味', value: interest },
          { label: '断り理由', value: str(raw, 'refusalReason', '現時点では明確な断りなし') },
          { label: '現時点の提案可否', value: proposalReadiness },
          { label: '人脈価値', value: str(raw, 'networkValue', '周辺人脈にも同じ課題があるか確認が必要') },
        ],
        nextQuestion,
        questionPurpose: str(raw, 'questionPurpose', '本人と周辺人脈の課題を確認し、紹介元・情報源としての価値を判断する。'),
        replyDraft,
        cardUpdate: [
          '追加する情報：',
          `・課題：${painPoint}`,
          `・関心：${interest}`,
          `・温度感：${temperatureLabel}`,
          `・注意点：${caution}`,
          '',
          '分類更新案：',
          categoryUpdate,
        ].join('\n'),
        categoryUpdate,
        nextAction,
        nextContact: str(raw, 'nextContact', '返信待ち / 返信がなければ3日後 9:00'),
        caution,
        feedbackGood: str(raw, 'feedbackGood', '会話を営業データとして残す流れを作れています。'),
        feedbackImprove: str(raw, 'feedbackImprove', '周辺人脈にも同じ課題があるか聞くと、紹介元としての価値を判断しやすくなります。'),
        coachPrompt: `${name}とのやり取り（${input.checkType}）について、「${judgement}」という方針で進めようとしています。次の返信の進め方を相談したいです。`,
      };
    });
  },

  async coachChat(input) {
    const prompt = `${COMMON_RULES}

営業パーソンからの相談に、営業コーチとして答えてください。

${input.person ? `相談に関連する人脈カード:\n${personContext(input.person)}\n` : ''}
相談内容:
${input.problem}

出力するJSONのキーと内容:
{
  "conclusion": "結論（1〜2文。まず何をすべきか）",
  "reason": "その結論の理由（2〜3文）",
  "evidence": "営業科学・心理学的な根拠（2〜3文）",
  "translation": "営業現場への翻訳。明日から使える具体的な言い回しや動き方（2〜3文）",
  "nextAction": "次の行動。今日・今週やることを具体的に（1〜2文）"
}`;

    return generateValidated(prompt, (raw) => ({
      conclusion: requireStr(raw, 'conclusion'),
      reason: requireStr(raw, 'reason'),
      evidence: str(raw, 'evidence', '人は自分の話を丁寧に聞かれた相手に協力しやすくなります（返報性・一貫性）。'),
      translation: requireStr(raw, 'translation'),
      nextAction: requireStr(raw, 'nextAction'),
    }));
  },
};
