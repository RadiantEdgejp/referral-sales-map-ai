import { supabase } from '../lib/supabaseClient';
import type { Person, PersonCategory } from '../types/person';

/**
 * Persistence layer for Person, backed by the Supabase `contacts` table
 * (Issue #9). The public function signatures (getPeople / savePeople /
 * addPerson / updatePerson) are kept identical to the previous
 * AsyncStorage implementation so callers do not change.
 *
 * Design notes:
 * - `contacts.id` is a global primary key while the app generates opaque
 *   client ids (e.g. `${Date.now()}`, 'mock-tanaka'). To guarantee two
 *   users can never collide on the same client id, rows are stored with a
 *   per-user namespaced id: `<user_id>:<client_id>`. The prefix is added
 *   and stripped inside this module only; callers always see client ids.
 * - Supabase write failures throw. There is no silent fallback to local
 *   storage (CLAUDE.md 4.2).
 */

type ContactRow = {
  id: string;
  user_id: string;
  name: string;
  industry: string;
  relationship: string;
  classification: PersonCategory[] | null;
  scores: {
    temperatureScore?: number;
    customerPotential?: number;
    referrerPotential?: number;
    referralTargetPotential?: number;
    informationValue?: number;
    futurePotential?: number;
  } | null;
  opening_talk: string | null;
  next_question: string | null;
  current_goal: string;
  required_actions: string[] | null;
  next_step: string;
  line_message: string | null;
  email_message: string | null;
  caution: string;
  recommended_next_contact_at: string | null;
  notes: string;
  additional_memo: string | null;
  next_contact_date: string | null;
  notification_id: string | null;
  created_at: string;
};

const CONTACT_COLUMNS =
  'id,user_id,name,industry,relationship,classification,scores,opening_talk,next_question,' +
  'current_goal,required_actions,next_step,line_message,email_message,caution,' +
  'recommended_next_contact_at,notes,additional_memo,next_contact_date,notification_id,created_at';

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    throw new Error(`セッションの取得に失敗しました: ${error.message}`);
  }
  const userId = data.session?.user.id;
  if (!userId) {
    throw new Error('ログインしていないため、人物データにアクセスできません。');
  }
  return userId;
}

function toRowId(userId: string, personId: string): string {
  return `${userId}:${personId}`;
}

function fromRowId(userId: string, rowId: string): string {
  const prefix = `${userId}:`;
  return rowId.startsWith(prefix) ? rowId.slice(prefix.length) : rowId;
}

function toIsoOrNull(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function rowToPerson(userId: string, row: ContactRow): Person {
  const scores = row.scores ?? {};
  return {
    id: fromRowId(userId, row.id),
    name: row.name,
    industry: row.industry,
    relationship: row.relationship,
    categories: row.classification ?? [],
    temperatureScore: scores.temperatureScore ?? 0,
    customerPotential: scores.customerPotential ?? 0,
    referrerPotential: scores.referrerPotential ?? 0,
    referralTargetPotential: scores.referralTargetPotential ?? 0,
    informationValue: scores.informationValue ?? 0,
    futurePotential: scores.futurePotential ?? 0,
    openingTalk: row.opening_talk ?? '',
    nextQuestion: row.next_question ?? '',
    goal: row.current_goal,
    roadmap: row.required_actions ?? [],
    nextAction: row.next_step,
    lineMessage: row.line_message ?? '',
    emailMessage: row.email_message ?? '',
    cautions: row.caution,
    recommendedNextContactAt: row.recommended_next_contact_at ?? '',
    rawMemo: row.notes,
    additionalMemo: row.additional_memo ?? undefined,
    nextContactAt: row.next_contact_date ?? undefined,
    notificationId: row.notification_id ?? undefined,
    createdAt: row.created_at,
  };
}

function personToRow(userId: string, person: Person) {
  return {
    id: toRowId(userId, person.id),
    user_id: userId,
    name: person.name,
    industry: person.industry,
    relationship: person.relationship,
    classification: person.categories,
    scores: {
      temperatureScore: person.temperatureScore,
      customerPotential: person.customerPotential,
      referrerPotential: person.referrerPotential,
      referralTargetPotential: person.referralTargetPotential,
      informationValue: person.informationValue,
      futurePotential: person.futurePotential,
    },
    opening_talk: person.openingTalk,
    next_question: person.nextQuestion,
    current_goal: person.goal,
    required_actions: person.roadmap,
    next_step: person.nextAction,
    line_message: person.lineMessage,
    email_message: person.emailMessage,
    caution: person.cautions,
    recommended_next_contact_at: toIsoOrNull(person.recommendedNextContactAt),
    notes: person.rawMemo,
    additional_memo: person.additionalMemo ?? null,
    next_contact_date: toIsoOrNull(person.nextContactAt),
    notification_id: person.notificationId ?? null,
    created_at: person.createdAt,
    first_contact_date: toIsoOrNull(person.createdAt),
  };
}

export async function getPeople(): Promise<Person[]> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('contacts')
    .select(CONTACT_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`人物データの取得に失敗しました: ${error.message}`);
  }

  return ((data ?? []) as unknown as ContactRow[]).map((row) => rowToPerson(userId, row));
}

export async function savePeople(people: Person[]) {
  const userId = await requireUserId();
  if (people.length === 0) {
    return;
  }

  const rows = people.map((person) => personToRow(userId, person));
  const { error } = await supabase.from('contacts').upsert(rows, { onConflict: 'id' });

  if (error) {
    throw new Error(`人物データの保存に失敗しました: ${error.message}`);
  }
}

export async function addPerson(person: Person) {
  const userId = await requireUserId();
  const { error } = await supabase.from('contacts').insert(personToRow(userId, person));

  if (error) {
    throw new Error(`人物の追加に失敗しました: ${error.message}`);
  }
}

export async function updatePerson(person: Person) {
  const userId = await requireUserId();
  const { id, user_id, created_at, ...updates } = personToRow(userId, person);
  const { error } = await supabase.from('contacts').update(updates).eq('id', id);

  if (error) {
    throw new Error(`人物の更新に失敗しました: ${error.message}`);
  }
}
