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

type AuthContextValue = {
  /** Restoring the persisted session on app launch. */
  initializing: boolean;
  session: Session | null;
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
async function ensureProfile(session: Session) {
  try {
    const { error } = await supabase.from('profiles').upsert(
      { id: session.user.id, email: session.user.email ?? null },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (error) {
      console.warn('profiles行の作成に失敗しました:', error.message);
    }
  } catch (err) {
    console.warn('profiles行の作成に失敗しました:', err);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) {
          return;
        }
        setSession(data.session);
        if (data.session) {
          void ensureProfile(data.session);
        }
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
        void ensureProfile(nextSession);
      }
      if (event === 'SIGNED_OUT') {
        setPasswordRecovery(false);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const clearPasswordRecovery = useCallback(() => setPasswordRecovery(false), []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(`ログアウトに失敗しました: ${error.message}`);
    }
  }, []);

  const value = useMemo(
    () => ({ initializing, session, passwordRecovery, clearPasswordRecovery, signOut }),
    [initializing, session, passwordRecovery, clearPasswordRecovery, signOut],
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
