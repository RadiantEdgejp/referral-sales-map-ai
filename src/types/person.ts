export type PersonCategory =
  | '顧客候補'
  | '紹介元候補'
  | '紹介先候補'
  | '情報源候補'
  | '将来候補';

export type PersonAnalysis = {
  name: string;
  industry: string;
  relationship: string;
  categories: PersonCategory[];
  openingTalk: string;
  nextQuestion: string;
  goal: string;
  roadmap: string[];
  nextAction: string;
  lineMessage: string;
  emailMessage: string;
  cautions: string;
  recommendedNextContactAt: string;
};

export type Person = PersonAnalysis & {
  id: string;
  rawMemo: string;
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
  nextContactAt?: string;
  notificationId?: string;
  additionalMemo?: string;
  /** 会社名（同姓同名の判別に使う。contacts.company に対応） */
  company?: string;
  /** 役職（contacts.role に対応） */
  role?: string;
  /** 紹介元のPerson ID（contacts.introduced_by に対応。紹介チェーン表示に使う） */
  introducedById?: string;
};
