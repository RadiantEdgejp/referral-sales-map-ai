import { describe, expect, it } from 'vitest';

import { buildFirstRunGuide } from '../../src/logic/firstRunGuide';

describe('first-run guide visibility and step state', () => {
  it('新規アカウント（人脈0・予定0）ではガイドを表示し、最初のステップを案内する', () => {
    const guide = buildFirstRunGuide({ peopleCount: 0, eventsCount: 0, hasOpenPreMeetingTask: false });

    expect(guide.visible).toBe(true);
    expect(guide.steps.map((step) => step.done)).toEqual([false, false, false]);
    expect(guide.steps.map((step) => step.current)).toEqual([true, false, false]);
  });

  it('人脈カードを登録すると次は予定追加を案内する', () => {
    const guide = buildFirstRunGuide({ peopleCount: 1, eventsCount: 0, hasOpenPreMeetingTask: false });

    expect(guide.visible).toBe(true);
    expect(guide.steps.map((step) => step.done)).toEqual([true, false, false]);
    expect(guide.steps.map((step) => step.current)).toEqual([false, true, false]);
  });

  it('最初の予定を作り予定前タスクが残っている間は、予定前ナビ体験を案内する', () => {
    const guide = buildFirstRunGuide({ peopleCount: 1, eventsCount: 1, hasOpenPreMeetingTask: true });

    expect(guide.visible).toBe(true);
    expect(guide.steps.map((step) => step.done)).toEqual([true, true, false]);
    expect(guide.steps.map((step) => step.current)).toEqual([false, false, true]);
  });

  it('予定前ナビまで体験したらガイドを表示しない', () => {
    const guide = buildFirstRunGuide({ peopleCount: 1, eventsCount: 1, hasOpenPreMeetingTask: false });

    expect(guide.visible).toBe(false);
    expect(guide.steps.every((step) => step.done)).toBe(true);
  });

  it('利用が進んだユーザー（予定2件以上）には予定前タスクが残っていても表示しない', () => {
    const guide = buildFirstRunGuide({ peopleCount: 5, eventsCount: 2, hasOpenPreMeetingTask: true });

    expect(guide.visible).toBe(false);
  });
});
