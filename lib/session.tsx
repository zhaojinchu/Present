import type { Session, User } from '@supabase/supabase-js';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from './supabase';
import type { Profile } from './types';

interface SessionCtx {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(email: string, password: string, displayName: string): Promise<void>;
  signOut(): Promise<void>;
  refreshProfile(): Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => setSession(data.session))
      .finally(() => setLoading(false));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // Keep the JWT fresh while foregrounded; otherwise it expires mid-demo and realtime dies silently.
  useEffect(() => {
    const onChange = (st: AppStateStatus) => {
      if (st === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    };
    onChange(AppState.currentState);
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, []);

  const userId = session?.user.id ?? null;

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    setProfile((data as Profile | null) ?? null);
  }, [userId]);

  useEffect(() => {
    refreshProfile();
  }, [refreshProfile]);

  const value = useMemo<SessionCtx>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      },
      async signUp(email, password, displayName) {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { display_name: displayName.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          throw new Error(
            'Account created but email confirmation is still on. In Supabase: Authentication → Providers → Email → turn off "Confirm email", then sign in.',
          );
        }
      },
      async signOut() {
        await supabase.auth.signOut();
      },
      refreshProfile,
    }),
    [session, profile, loading, refreshProfile],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSession outside SessionProvider');
  return v;
}
