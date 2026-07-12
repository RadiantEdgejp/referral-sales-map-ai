import { describe, expect, it } from 'vitest';
import { selectMissingDemoPeople } from '../../src/logic/demoPeople';
import type { Person } from '../../src/types/person';

const person = (id: string, name: string): Person => ({
  id,
  name,
  industry: '士業',
  relationship: '交流会',
  categories: [],
  openingTalk: '',
  nextQuestion: '',
  goal: '',
  roadmap: [],
  nextAction: '',
  lineMessage: '',
  emailMessage: '',
  cautions: '',
  recommendedNextContactAt: '',
  rawMemo: '',
  createdAt: '2026-07-12T00:00:00.000Z',
  updatedAt: '2026-07-12T00:00:00.000Z',
});

describe('demo people seeding', () => {
  it('does not return a demo row whose id already exists, preserving user edits', () => {
    const edited = person('demo-1', '編集後の名前');
    const demos = [person('demo-1', '初期名'), person('demo-2', '新規デモ')];
    expect(selectMissingDemoPeople([edited], demos)).toEqual([demos[1]]);
  });
});
