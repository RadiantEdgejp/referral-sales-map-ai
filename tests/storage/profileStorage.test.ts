import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn() }));
vi.mock('../../src/lib/supabaseClient', () => ({ supabase: { from: db.from } }));

import { updateProfile } from '../../src/storage/profileStorage';

describe('Issue #23 profile persistence', () => {
  beforeEach(() => vi.resetAllMocks());

  it('writes onboarding/profile fields only to the signed-in profile id and returns DB truth', async () => {
    db.single.mockResolvedValue({
      data: {
        id: 'user-a', email: 'a@example.com', display_name: '山田 太郎', role: '紹介営業',
        company_name: '山田保険', onboarding_completed: true, subscription_status: 'free', plan: 'trial',
      },
      error: null,
    });
    db.select.mockReturnValue({ single: db.single });
    db.eq.mockReturnValue({ select: db.select });
    db.update.mockReturnValue({ eq: db.eq });
    db.from.mockReturnValue({ update: db.update });

    const profile = await updateProfile('user-a', {
      displayName: ' 山田 太郎 ', companyName: ' 山田保険 ', role: ' 紹介営業 ', onboardingCompleted: true,
    });

    expect(db.from).toHaveBeenCalledWith('profiles');
    expect(db.update).toHaveBeenCalledWith({
      display_name: '山田 太郎', company_name: '山田保険', role: '紹介営業', onboarding_completed: true,
    });
    expect(db.eq).toHaveBeenCalledWith('id', 'user-a');
    expect(profile).toMatchObject({ displayName: '山田 太郎', onboardingCompleted: true, plan: 'trial' });
  });

  it('surfaces a failed DB update instead of pretending onboarding completed', async () => {
    db.single.mockResolvedValue({ data: null, error: { message: 'RLS rejected' } });
    db.select.mockReturnValue({ single: db.single });
    db.eq.mockReturnValue({ select: db.select });
    db.update.mockReturnValue({ eq: db.eq });
    db.from.mockReturnValue({ update: db.update });

    await expect(updateProfile('user-a', { onboardingCompleted: true })).rejects.toThrow('RLS rejected');
  });
});
