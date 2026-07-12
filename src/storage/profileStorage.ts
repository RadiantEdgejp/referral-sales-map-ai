import { supabase } from '../lib/supabaseClient';

export type UserProfile = {
  id: string;
  email: string | null;
  displayName: string;
  role: string;
  companyName: string;
  onboardingCompleted: boolean;
  subscriptionStatus: string;
  plan: string;
};

type ProfileRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string | null;
  company_name: string | null;
  onboarding_completed: boolean;
  subscription_status: string;
  plan: string;
};

const PROFILE_COLUMNS =
  'id,email,display_name,role,company_name,onboarding_completed,subscription_status,plan';

function fromRow(row: ProfileRow): UserProfile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name ?? '',
    role: row.role ?? '',
    companyName: row.company_name ?? '',
    onboardingCompleted: row.onboarding_completed,
    subscriptionStatus: row.subscription_status,
    plan: row.plan,
  };
}

export async function getProfile(userId: string): Promise<UserProfile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .single();
  if (error) throw new Error(`プロフィールの取得に失敗しました: ${error.message}`);
  return fromRow(data as ProfileRow);
}

export async function ensureAndGetProfile(userId: string, email: string | null): Promise<UserProfile> {
  const { error: upsertError } = await supabase
    .from('profiles')
    .upsert({ id: userId, email }, { onConflict: 'id', ignoreDuplicates: true });
  if (upsertError) throw new Error(`プロフィールの作成に失敗しました: ${upsertError.message}`);
  return getProfile(userId);
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<UserProfile, 'displayName' | 'role' | 'companyName' | 'onboardingCompleted'>>,
): Promise<UserProfile> {
  const dbPatch: Record<string, string | boolean> = {};
  if (patch.displayName !== undefined) dbPatch.display_name = patch.displayName.trim();
  if (patch.role !== undefined) dbPatch.role = patch.role.trim();
  if (patch.companyName !== undefined) dbPatch.company_name = patch.companyName.trim();
  if (patch.onboardingCompleted !== undefined) dbPatch.onboarding_completed = patch.onboardingCompleted;

  const { data, error } = await supabase
    .from('profiles')
    .update(dbPatch)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .single();
  if (error) throw new Error(`プロフィールの更新に失敗しました: ${error.message}`);
  return fromRow(data as ProfileRow);
}
