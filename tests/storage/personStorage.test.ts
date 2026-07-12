import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Person } from '../../src/types/person';

const db = vi.hoisted(() => ({
  getSession: vi.fn(),
  from: vi.fn(),
  insert: vi.fn(),
  upsert: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
  order: vi.fn(),
}));

vi.mock('../../src/lib/supabaseClient', () => ({
  supabase: {
    auth: { getSession: db.getSession },
    from: db.from,
  },
}));

import { addPerson, getPeople, savePeople, toContactRowId, updatePerson } from '../../src/storage/personStorage';

const USER_ID = 'user-a';
const CREATED_AT = '2026-07-12T01:00:00.000Z';

function person(overrides: Partial<Person> = {}): Person {
  return {
    id: 'contact-1',
    name: '田中さん',
    industry: '美容サロン経営',
    relationship: '交流会で会った',
    company: '田中サロン',
    role: '代表',
    introducedById: 'contact-referrer',
    categories: [],
    openingTalk: '採用課題を聞く',
    nextQuestion: '採用と集客ではどちらが大変ですか？',
    goal: '情報交換を続ける',
    roadmap: ['課題を確認する'],
    nextAction: '事例を共有する',
    lineMessage: '先日はありがとうございました。',
    emailMessage: '先日はありがとうございました。',
    cautions: '売り込みを急がない',
    recommendedNextContactAt: '2026-07-15T09:00:00+09:00',
    nextContactAt: '2026-07-15T09:00:00+09:00',
    rawMemo: '採用に困っている可能性がある。',
    createdAt: CREATED_AT,
    ...overrides,
  };
}

function contactRow(overrides: Record<string, unknown> = {}) {
  return {
    id: `${USER_ID}:contact-1`,
    user_id: USER_ID,
    name: '田中さん',
    industry: '美容サロン経営',
    relationship: '交流会で会った',
    company: '田中サロン',
    role: '代表',
    introduced_by: `${USER_ID}:contact-referrer`,
    classification: [],
    opening_talk: '採用課題を聞く',
    next_question: '採用と集客ではどちらが大変ですか？',
    current_goal: '情報交換を続ける',
    required_actions: ['課題を確認する'],
    next_step: '事例を共有する',
    line_message: '先日はありがとうございました。',
    email_message: '先日はありがとうございました。',
    caution: '売り込みを急がない',
    recommended_next_contact_at: '2026-07-15T00:00:00.000Z',
    notes: '採用に困っている可能性がある。',
    additional_memo: null,
    next_contact_date: '2026-07-15T00:00:00.000Z',
    notification_id: null,
    archived_at: null,
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    ...overrides,
  };
}

describe('personStorage database contract', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    db.getSession.mockResolvedValue({
      data: { session: { user: { id: USER_ID } } },
      error: null,
    });
  });

  it('namespaces contact and relation IDs and writes user-owned rows', async () => {
    db.insert.mockResolvedValue({ error: null });
    db.from.mockReturnValue({ insert: db.insert });

    await addPerson(person());

    expect(toContactRowId(USER_ID, 'contact-1')).toBe(`${USER_ID}:contact-1`);
    expect(db.from).toHaveBeenCalledWith('contacts');
    expect(db.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: `${USER_ID}:contact-1`,
        user_id: USER_ID,
        introduced_by: `${USER_ID}:contact-referrer`,
        next_contact_date: '2026-07-15T00:00:00.000Z',
      }),
    );
  });

  it('upserts every supplied person with the authenticated user namespace', async () => {
    db.upsert.mockResolvedValue({ error: null });
    db.from.mockReturnValue({ upsert: db.upsert });

    await savePeople([person(), person({ id: 'contact-2', introducedById: undefined })]);

    expect(db.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({ id: `${USER_ID}:contact-1`, user_id: USER_ID }),
        expect.objectContaining({ id: `${USER_ID}:contact-2`, user_id: USER_ID, introduced_by: null }),
      ],
      { onConflict: 'id' },
    );
  });

  it('does not send immutable identity columns in an update and maps the returned DB row', async () => {
    db.single.mockResolvedValue({ data: contactRow({ next_step: '採用事例を共有する' }), error: null });
    db.select.mockReturnValue({ single: db.single });
    db.eq.mockReturnValue({ select: db.select });
    db.update.mockReturnValue({ eq: db.eq });
    db.from.mockReturnValue({ update: db.update });

    const saved = await updatePerson(person({ nextAction: '採用事例を共有する' }));
    const updatePayload = db.update.mock.calls[0][0];

    expect(updatePayload).not.toHaveProperty('id');
    expect(updatePayload).not.toHaveProperty('user_id');
    expect(updatePayload).not.toHaveProperty('created_at');
    expect(updatePayload).not.toHaveProperty('updated_at');
    expect(updatePayload).toMatchObject({ next_step: '採用事例を共有する' });
    expect(db.eq).toHaveBeenCalledWith('id', `${USER_ID}:contact-1`);
    expect(saved.id).toBe('contact-1');
    expect(saved.introducedById).toBe('contact-referrer');
    expect(saved.nextAction).toBe('採用事例を共有する');
  });

  it('restores DB rows to client IDs without leaking the user namespace', async () => {
    db.order.mockResolvedValue({ data: [contactRow()], error: null });
    db.select.mockReturnValue({ order: db.order });
    db.from.mockReturnValue({ select: db.select });

    const people = await getPeople();

    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({
      id: 'contact-1',
      introducedById: 'contact-referrer',
      name: '田中さん',
      nextAction: '事例を共有する',
    });
  });

  it('fails before writing when there is no authenticated user', async () => {
    db.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(addPerson(person())).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
  });
});
