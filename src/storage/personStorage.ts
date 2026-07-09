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
 * - `updated_at` is owned by the DB trigger (`trg_contacts_updated_at`);
 *   it is only ever read back, never written by the client.
 */

type ContactRow = {
  id: string;
  user_id: string;
  name: string;
  industry: string;
  relationship: string;
  company: string | null;
  role: string | null;
  introduced_by: string | null;
  classification: PersonCategory[] | null;
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
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

const CONTACT_COLUMNS =
  'id,user_id,name,industry,relationship,company,role,introduced_by,classification,opening_talk,next_question,' +
  'current_goal,required_actions,next_step,line_message,email_message,caution,' +
  'recommended_next_contact_at,notes,additional_memo,next_contact_date,notification_id,' +
  'archived_at,created_at,updated_at';

export async function requireUserId(): Promise<string> {
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

/**
 * `contacts.id`（およびそれを参照する各テーブルの `contact_id`）は
 * `<user_id>:<client_id>` 形式で名前空間化されている。contacts に紐づく行を
 * 書き込む他のストレージモジュールも、この関数で同じ行IDを導出すること。
 */
export function toContactRowId(userId: string, personId: string): string {
  return `${userId}:${personId}`;
}

const toRowId = toContactRowId;

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
  return {
    id: fromRowId(userId, row.id),
    name: row.name,
    industry: row.industry,
    relationship: row.relationship,
    company: row.company ?? undefined,
    role: row.role ?? undefined,
    introducedById: row.introduced_by ? fromRowId(userId, row.introduced_by) : undefined,
    categories: row.classification ?? [],
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
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function personToRow(userId: string, person: Person) {
  return {
    id: toRowId(userId, person.id),
    user_id: userId,
    name: person.name,
    industry: person.industry,
    relationship: person.relationship,
    company: person.company ?? null,
    role: person.role ?? null,
    introduced_by: person.introducedById ? toRowId(userId, person.introducedById) : null,
    classification: person.categories,
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
    archived_at: toIsoOrNull(person.archivedAt),
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

export async function updatePerson(person: Person): Promise<Person> {
  const userId = await requireUserId();
  // id/user_id/created_at are immutable identity columns; updated_at is
  // owned by the DB trigger. None of these belong in the UPDATE payload.
  const { id, user_id, created_at, ...updates } = personToRow(userId, person);
  const { data, error } = await supabase
    .from('contacts')
    .update(updates)
    .eq('id', id)
    .select(CONTACT_COLUMNS)
    .single();

  if (error) {
    throw new Error(`人物の更新に失敗しました: ${error.message}`);
  }

  return rowToPerson(userId, data as unknown as ContactRow);
}
