import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isRemoteEnabled } from '../lib/supabase';
import { fetchProfile, signIn as doSignIn, signOut as doSignOut, type Profile } from '../lib/admin';

interface AuthContextValue {
  /** متاح فقط عند ضبط Supabase. */
  remoteEnabled: boolean;
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(isRemoteEnabled);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      setProfile(data.session ? await fetchProfile(data.session.user.id) : null);
      if (active) setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!active) return;
      setSession(next);
      setProfile(next ? await fetchProfile(next.user.id) : null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      remoteEnabled: isRemoteEnabled,
      loading,
      session,
      profile,
      isAdmin: profile?.role === 'admin',
      async signIn(email, password) {
        const next = await doSignIn(email, password);
        setSession(next);
        setProfile(await fetchProfile(next.user.id));
      },
      async signOut() {
        await doSignOut();
        setSession(null);
        setProfile(null);
      },
    }),
    [loading, session, profile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
