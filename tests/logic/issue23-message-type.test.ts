import { describe, expect, it } from 'vitest';
import { detectMessageType } from '../../src/logic/messageTypeDetection';

describe('Issue #23 automatic message type detection', () => {
  it.each([
    ['相手から「今は必要ないです」と返信が来た', '', '受信文チェック', '断り・保留'],
    ['美容サロン経営者の知り合いを紹介してもらいたい', '', '紹介依頼文', '紹介依頼'],
    ['来週あたりで15分ほど情報交換できるか聞きたい', '', '返信作成', '日程調整'],
    ['先日はありがとうございましたと送りたい', '', 'お礼文', 'お礼'],
    ['この文章を送る予定です', '押し売り感を弱くしたい', '送信前チェック', '送信前文面'],
    ['ありがとうございます。ぜひお願いします。', '', '受信文チェック', '受信文'],
  ])('%s is detected as %s', (text, intention, checkType, label) => {
    expect(detectMessageType(text, intention)).toMatchObject({ checkType, label });
  });
});
