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
};

export type Person = PersonAnalysis & {
  id: string;
  rawMemo: string;
  createdAt: string;
  nextContactAt?: string;
  notificationId?: string;
};
