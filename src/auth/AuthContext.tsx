import type { Session } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { supabase } from '../lib/supabaseClient';
import { ensureAndGetProfile, updateProfile, type UserProfile } from '../storage/profileStorage';

type AuthContextValue = {
  /** Restoring the persisted session on app launch. */
  initializing: boolean;
  session: Session | null;
  profile: UserProfile | null;
  profileLoading: boolean;
  profileError: string;
  reloadProfile: () => Promise<void>;
  completeOnboarding: (input: { displayName: string; companyName: string; role: string }) => Promise<void>;
  /** True while the user arrived via a password-recovery link. */
  passwordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Ensure a profiles row exists for the signed-in user (Issue #10).
 * The DB trigger handle_new_user normally creates it; this is a client-side
 * fallback for users created before the trigger existed. Failures are logged
 * but do not block sign-in.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState('');

  const loadProfile = useCallback(async (activeSession: Session | null) => {
    if (!activeSession) {
      setProfile(null);
      setProfileError('');
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    setProfileError('');
    try {
      setProfile(await ensureAndGetProfile(activeSession.user.id, activeSession.user.email ?? null));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'プロフィールの取得に失敗しました。';
      console.error('loadProfile:', error);
      setProfile(null);
      setProfileError(message);
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) {
          return;
        }
        setSession(data.session);
        void loadProfile(data.session);
      })
      .finally(() => {
        if (mounted) {
          setInitializing(false);
        }
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) {
        return;
      }
      setSession(nextSession);
      if (event === 'PASSWORD_RECOVERY') {
        setPasswordRecovery(true);
      }
      if (event === 'SIGNED_IN' && nextSession) {
        void loadProfile(nextSession);
      }
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
        setProfile(null);
        setProfileError('');
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(`ログアウトに失敗しました: ${error.message}`);
    }
  }, []);

  const reloadProfile = useCallback(async () => {
    await loadProfile(session);
  }, [loadProfile, session]);

  const completeOnboarding = useCallback(async (input: { displayName: string; companyName: string; role: string }) => {
    if (!session) throw new Error('ログイン情報を確認できません。もう一度ログインしてください。');
    const saved = await updateProfile(session.user.id, { ...input, onboardingCompleted: true });
    setProfile(saved);
  }, [session]);

  const value = useMemo(
    () => ({
      initializing,
      session,
      profile,
      profileLoading,
      profileError,
      reloadProfile,
      completeOnboarding,
      passwordRecovery,
      clearPasswordRecovery,
      signOut,
    }),
    [initializing, session, profile, profileLoading, profileError, reloadProfile, completeOnboarding, passwordRecovery, clearPasswordRecovery, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth は AuthProvider の内側で使用してください。');
  }
  return ctx;
}
