export type MainTab = 'home' | 'people' | 'calendar' | 'pre' | 'after' | 'line' | 'end';

/**
 * 予定前ナビ → 後メモへの引き継ぎ情報（CLAUDE.md 5.4:
 * ナビで決めた質問は後メモにそのまま渡す）。
 */
export type AfterMemoHandoff = {
  /** 予定前ナビで決めた質問（後メモの質問欄にそのまま表示する） */
  questions: string[];
  /** pre_meeting_navs の行ID。after_memos.pre_meeting_nav_id に紐付ける */
  preMeetingNavRowId?: string;
  /** 引き継ぎ元の人物ID（別人物のナビ質問を混ぜないためのガード） */
  personId: string;
  salesRouteId?: string;
  calendarEventId?: string;
  afterMemoTaskId?: string;
};
