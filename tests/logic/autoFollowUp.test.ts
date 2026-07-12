import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/notifications/notificationService', () => ({
  cancelContactNotification: vi.fn(),
  scheduleContactNotification: vi.fn(),
}));

vi.mock('../../src/storage/personStorage', () => ({
  updatePerson: vi.fn(),
}));

import {
  AUTO_FOLLOW_UP_DAYS,
  AUTO_FOLLOW_UP_HOUR,
  buildAutoFollowUpPlan,
  hasValidNextContact,
} from '../../src/logic/autoFollowUp';

describe('automatic follow-up rule', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 12, 16, 30, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('schedules an omitted next-contact date three days later at 09:00', () => {
    const plan = buildAutoFollowUpPlan();

    expect(AUTO_FOLLOW_UP_DAYS).toBe(3);
    expect(AUTO_FOLLOW_UP_HOUR).toBe(9);
    expect(plan.dueDate).toEqual(new Date(2026, 6, 15, 9, 0, 0));
    expect(plan.reason).toContain('3');
    expect(plan.reason).toContain('9:00');
  });

  it('rejects missing and malformed dates instead of treating them as scheduled', () => {
    expect(hasValidNextContact()).toBe(false);
    expect(hasValidNextContact('not-a-date')).toBe(false);
    expect(hasValidNextContact('2026-07-15T09:00:00+09:00')).toBe(true);
  });
});
