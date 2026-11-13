import type { AuthError, Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { useI18n } from '../i18n';
import { supabase } from '../lib/supabase';
import { fetchMe, updateMe, type Me, type ProfileChanges } from '../services/account';
import { resetBootstrap } from '../services/bootstrap';

/** `disabled` is mock mode: no backend, so no sign-in either. */
export type AuthStatus = 'disabled' | 'loading' | 'signedOut' | 'signedIn';

/** Why sign-in or sign-up failed, as a key into `t.auth.errors`. */
export type AuthFailureReason = 'invalidCredentials' | 'emailNotConfirmed' | 'userExists' | 'failed';

export class AuthFailure extends Error {
  readonly reason: AuthFailureReason;

  constructor(reason: AuthFailureReason, message: string) {
    super(message);
    this.name = 'AuthFailure';
    this.reason = reason;
  }
}

type Auth = {
  status: AuthStatus;
  session: Session | null;
  /** The signed-in user's profile and workspaces; `null` until loaded (or if the API is down). */
  me: Me | null;
  /** Loading the profile failed; `reloadMe` tries again. */
  meFailed: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Resolves `confirmEmail` when the account needs its email confirmed before the first sign-in. */
  signUp: (name: string, email: string, password: string) => Promise<'signedIn' | 'confirmEmail'>;
  /** Signs out on this device only. */
  signOut: () => Promise<void>;
  /** Ends every session of this user, on every device. */
  signOutEverywhere: () => Promise<void>;
  /** Loads the profile again, e.g. after it failed to load. */
  reloadMe: () => Promise<void>;
  /** Saves profile changes; a new language also switches the app's language. */
  updateProfile: (changes: ProfileChanges) => Promise<void>;
};

const AuthContext = createContext<Auth | null>(null);

/** The Supabase session, kept in step with supabase-js. In mock mode it stays `disabled`. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { setLanguage } = useI18n();
  const [status, setStatus] = useState<AuthStatus>(supabase ? 'loading' : 'disabled');
  const [session, setSession] = useState<Session | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [meFailed, setMeFailed] = useState(false);
  const userIdRef = useRef<string | null>(null);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    if (!supabase) return undefined;
    // Fires once with the saved session (INITIAL_SESSION), then on every sign-in, refresh and sign-out.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      const nextUserId = next?.user.id ?? null;
      if (nextUserId !== userIdRef.current) {
        // Another user's data must never be served from the previous one's first request.
        userIdRef.current = nextUserId;
        resetBootstrap();
        setMe(null);
        setMeFailed(false);
      }
      setSession(next);
      setStatus(next ? 'signedIn' : 'signedOut');
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    fetchMe().then(
      (result) => {
        if (cancelled) return;
        setMe(result);
        setMeFailed(false);
        // The app opens in the language saved with the profile.
        setLanguage(result.profile.locale);
      },
      (error: unknown) => {
        console.warn('[auth] Could not load the profile.', error);
        if (!cancelled) setMeFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId, setLanguage]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new AuthFailure('failed', 'No backend is configured.');
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw toFailure(error);
  }, []);

  const signUp = useCallback(async (name: string, email: string, password: string) => {
    if (!supabase) throw new AuthFailure('failed', 'No backend is configured.');
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    if (error) throw toFailure(error);
    // With confirmations on, Supabase hides whether the email was taken: no identities means it was.
    if (data.user && data.user.identities?.length === 0) throw new AuthFailure('userExists', 'User already exists');
    return data.session ? 'signedIn' : 'confirmEmail';
  }, []);

  const endSession = useCallback(async (scope: 'local' | 'global') => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut({ scope });
    if (error) {
      console.warn('[auth] Sign-out did not reach the server; clearing this device anyway.', error.message);
      if (scope === 'global') await supabase.auth.signOut({ scope: 'local' });
    }
  }, []);
  const signOut = useCallback(() => endSession('local'), [endSession]);
  const signOutEverywhere = useCallback(() => endSession('global'), [endSession]);

  const reloadMe = useCallback(async () => {
    try {
      setMe(await fetchMe());
      setMeFailed(false);
    } catch (error) {
      console.warn('[auth] Could not load the profile.', error);
      setMeFailed(true);
    }
  }, []);

  const updateProfile = useCallback(
    async (changes: ProfileChanges) => {
      const result = await updateMe(changes);
      setMe(result);
      if (changes.locale) setLanguage(result.profile.locale);
    },
    [setLanguage],
  );

  const value = useMemo<Auth>(
    () => ({ status, session, me, meFailed, signIn, signUp, signOut, signOutEverywhere, reloadMe, updateProfile }),
    [status, session, me, meFailed, signIn, signUp, signOut, signOutEverywhere, reloadMe, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Auth {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}

function toFailure(error: AuthError): AuthFailure {
  switch (error.code) {
    case 'invalid_credentials':
      return new AuthFailure('invalidCredentials', error.message);
    case 'email_not_confirmed':
      return new AuthFailure('emailNotConfirmed', error.message);
    case 'user_already_exists':
    case 'email_exists':
      return new AuthFailure('userExists', error.message);
    default:
      console.warn('[auth]', error.code ?? error.name, error.message);
      return new AuthFailure('failed', error.message);
  }
}
