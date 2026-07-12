import type { LineCheckType } from './lineCheck';

export type MessageDirection = '受信' | '送信';

export type MessageTypeDetection = {
  checkType: LineCheckType;
  direction: MessageDirection;
  label: string;
  reason: string;
};

const RECEIVED_MARKERS = /(?:届いた|来た|返信|相手(?:から|が)|と言われ|とのこと|受信)/;
const OUTBOUND_MARKERS = /(?:送りたい|送る|伝えたい|聞きたい|お願いしたい|返信したい|文面を作|添削)/;
const LIKELY_SHORT_REPLY = /^(?:ありがとうございます|承知しました|了解しました|かしこまりました|ぜひお願いします|検討します|また連絡します)(?:[。！!]|$)/;

export function detectMessageType(text: string, intention = ''): MessageTypeDetection {
  const source = `${intention}\n${text}`.trim();
  const normalized = source.replace(/\s+/g, ' ');

  if (/(?:紹介して|紹介をお願い|知り合いを紹介|つないで|繋いで)/.test(normalized)) {
    return detection('紹介依頼文', '送信', '紹介依頼', '紹介者へ人をつないでもらう依頼が含まれています。');
  }
  if (/(?:今は必要ない|お断り|断られ|見送|今回は結構|難しい|またタイミング|忙しい)/.test(normalized)) {
    const direction = RECEIVED_MARKERS.test(normalized) || !OUTBOUND_MARKERS.test(normalized) ? '受信' : '送信';
    return detection(direction === '受信' ? '受信文チェック' : '断り返信', direction, '断り・保留', '断りまたは保留の表現が含まれています。');
  }
  if (/(?:日程|都合|候補日|何時|いつ|来週|今週|打ち合わせ|面談|15分|30分)/.test(normalized)) {
    return detection('返信作成', '送信', '日程調整', '日程や面談時間の調整が目的です。');
  }
  if (/(?:ありがとう|お礼|先日は|本日は)/.test(normalized) && OUTBOUND_MARKERS.test(normalized)) {
    return detection('お礼文', '送信', 'お礼', 'お礼を伝える送信文です。');
  }
  if (RECEIVED_MARKERS.test(normalized) || /^[「『].+[」』]$/.test(normalized)) {
    return detection('受信文チェック', '受信', '受信文', '相手から届いた文面として分析します。');
  }
  if (!OUTBOUND_MARKERS.test(normalized) && LIKELY_SHORT_REPLY.test(normalized)) {
    return detection('受信文チェック', '受信', '受信文', '相手から届いた可能性が高い短い返信として、温度感と返信方針を確認します。');
  }
  if (/(?:返信|返したい)/.test(normalized)) {
    return detection('返信作成', '送信', '返信作成', '相手への返信を作る意図が含まれています。');
  }

  return detection('送信前チェック', '送信', '送信前文面', '送る予定の文面として、圧の強さと返信しやすさを確認します。');
}

function detection(
  checkType: LineCheckType,
  direction: MessageDirection,
  label: string,
  reason: string,
): MessageTypeDetection {
  return { checkType, direction, label, reason };
}
