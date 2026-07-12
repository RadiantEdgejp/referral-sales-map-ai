import { describe, expect, it } from 'vitest';
import { filterContactCandidates } from '../../src/logic/contactPicker';
import type { Person } from '../../src/types/person';

function person(id: string, name: string, company: string, extra: Partial<Person> = {}): Person {
  return {
    id, name, company, role: '代表', industry: '美容', relationship: '交流会', categories: [],
    openingTalk: '', nextQuestion: '', goal: '', roadmap: [], nextAction: '', lineMessage: '', emailMessage: '', cautions: '',
    recommendedNextContactAt: '', rawMemo: '', createdAt: '2026-07-12T00:00:00.000Z', ...extra,
  };
}

describe('Issue #23 common contact picker', () => {
  const people = [
    person('1', '佐藤さん', '青空不動産'),
    person('2', '佐藤さん', '緑山会計', { role: '税理士', relationship: '知人から紹介' }),
    person('3', '田中さん', '非表示会社', { archivedAt: '2026-07-12T00:00:00.000Z' }),
  ];

  it('searches by name while preserving same-name contacts for company/role identification', () => {
    const result = filterContactCandidates(people, '佐藤');
    expect(result).toHaveLength(2);
    expect(result.map((item) => item.company)).toEqual(['青空不動産', '緑山会計']);
  });

  it('searches company, role, relationship and never returns archived contacts', () => {
    expect(filterContactCandidates(people, '税理士').map((item) => item.id)).toEqual(['2']);
    expect(filterContactCandidates(people, '知人から紹介').map((item) => item.id)).toEqual(['2']);
    expect(filterContactCandidates(people, '非表示会社')).toEqual([]);
    expect(filterContactCandidates(people, '')).toHaveLength(2);
  });
});
