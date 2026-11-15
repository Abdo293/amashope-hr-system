import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { HRUser } from '../types/hr';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  hrUser: HRUser | null;
  loading: boolean;
  isForbidden: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<HRUser | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [hrUser, setHrUser] = useState<HRUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isForbidden, setIsForbidden] = useState<boolean>(false);
  const authRequestId = useRef(0);
  const activeUserId = useRef<string | null>(null);
  const resolvedProfileUserId = useRef<string | null>(null);

  const fetchHRProfile = useCallback(async (userId: string, userEmail?: string) => {
    try {
      const { data, error } = await supabase
        .from('hr_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching HR profile:', error);
        return { profile: null, forbidden: true };
      }

      if (!data || !data.is_active) {
        return { profile: null, forbidden: true };
      }

      return {
        profile: {
          ...data,
          email: userEmail || data.email || '',
          must_change_password: Boolean(data.must_change_password),
        } as HRUser,
        forbidden: false,
      };
    } catch (err) {
      console.error('Failed to load HR profile:', err);
      return { profile: null, forbidden: true };
    }
  }, []);

  const applySession = useCallback(async (nextSession: Session | null) => {
    const nextUserId = nextSession?.user.id || null;
    const canReuseResolvedProfile = Boolean(
      nextUserId &&
      activeUserId.current === nextUserId &&
      resolvedProfileUserId.current === nextUserId,
    );

    activeUserId.current = nextUserId;
    setSession(nextSession);
    setUser(nextSession?.user || null);

    // Supabase may emit SIGNED_IN/TOKEN_REFRESHED again when a hidden tab
    // becomes active. Keep the already-authorized profile so the protected
    // route does not flash its full-page loading screen on every tab focus.
    if (canReuseResolvedProfile) return;

    const requestId = ++authRequestId.current;
    setLoading(true);
    setHrUser(null);
    setIsForbidden(false);

    if (!nextSession?.user) {
      resolvedProfileUserId.current = null;
      if (requestId === authRequestId.current) setLoading(false);
      return;
    }

    const result = await fetchHRProfile(nextSession.user.id, nextSession.user.email);
    if (requestId !== authRequestId.current) return;

    setHrUser(result.profile);
    setIsForbidden(result.forbidden);
    resolvedProfileUserId.current = nextSession.user.id;
    setLoading(false);
  }, [fetchHRProfile]);

  useEffect(() => {
    const initializeAuth = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      await applySession(currentSession);
    };

    void initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        // Run profile I/O after the auth callback returns. This also ensures the
        // route remains on its loading state until authorization is resolved.
        window.setTimeout(() => {
          void applySession(newSession);
        }, 0);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [applySession]);

  const logout = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    await applySession(null);
  };

  const refreshProfile = useCallback(async (): Promise<HRUser | null> => {
    const currentSession = session || (await supabase.auth.getSession()).data.session;
    if (!currentSession?.user) return null;

    const result = await fetchHRProfile(currentSession.user.id, currentSession.user.email);
    setHrUser(result.profile);
    setIsForbidden(result.forbidden);
    if (result.profile) {
      resolvedProfileUserId.current = currentSession.user.id;
      activeUserId.current = currentSession.user.id;
    }
    return result.profile;
  }, [fetchHRProfile, session]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        hrUser,
        loading,
        isForbidden,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
