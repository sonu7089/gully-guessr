import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { cleanName, NAME_MAX, NAME_MIN } from '../multiplayer/protocol';
import { AuthDialog } from './AuthDialog';
import { firebaseAuth, firebaseConfigured } from './firebase';

export interface Player {
  uid: string;
  name: string;
  email: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

interface AuthApi {
  /** False when Firebase isn't configured; accounts and multiplayer are hidden. */
  enabled: boolean;
  ready: boolean;
  player: Player | null;
  signUp(name: string, email: string, password: string): Promise<void>;
  logIn(email: string, password: string): Promise<void>;
  logInWithGoogle(): Promise<void>;
  resetPassword(email: string): Promise<void>;
  rename(name: string): Promise<void>;
  logOut(): Promise<void>;
  idToken(): Promise<string | null>;
  /** Opens the log in / sign up dialog; `reason` explains why it popped up. */
  openAuth(mode?: AuthMode, reason?: string): void;
}

export type AuthMode = 'login' | 'signup' | 'reset';

const AuthContext = createContext<AuthApi | null>(null);

export { cleanName, NAME_MAX, NAME_MIN };

const toPlayer = (u: User): Player => ({
  uid: u.uid,
  name: cleanName(u.displayName || u.email?.split('@')[0] || 'Player') || 'Player',
  email: u.email,
  photoURL: u.photoURL,
  emailVerified: u.emailVerified,
});

const MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists. Log in instead.',
  'auth/invalid-email': 'That email address doesn’t look right.',
  'auth/weak-password': 'Use a password with at least 6 characters.',
  'auth/invalid-credential': 'Wrong email or password.',
  'auth/wrong-password': 'Wrong email or password.',
  'auth/user-not-found': 'No account with that email. Sign up instead.',
  'auth/too-many-requests': 'Too many attempts. Wait a minute and try again.',
  'auth/network-request-failed': 'Couldn’t reach the server. Check your connection.',
  'auth/popup-closed-by-user': 'Google sign-in was closed before it finished.',
  'auth/popup-blocked': 'Your browser blocked the Google sign-in window. Allow pop-ups and try again.',
  'auth/operation-not-allowed': 'This sign-in method isn’t switched on for the game yet.',
  'auth/configuration-not-found': 'This sign-in method isn’t switched on for the game yet.',
};

export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  return (code && MESSAGES[code]) || 'Something went wrong. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = firebaseAuth();
  const [ready, setReady] = useState(!auth);
  const [player, setPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setPlayer(u ? toPlayer(u) : null);
      setReady(true);
    });
  }, [auth]);

  const need = useCallback(() => {
    if (!auth) throw Object.assign(new Error('Accounts are not configured'), { code: 'auth/operation-not-allowed' });
    return auth;
  }, [auth]);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const a = need();
      const { user } = await createUserWithEmailAndPassword(a, email.trim(), password);
      await updateProfile(user, { displayName: cleanName(name) });
      setPlayer(toPlayer(user));
      sendEmailVerification(user).catch(() => undefined);
    },
    [need],
  );

  const logIn = useCallback(
    async (email: string, password: string) => {
      await signInWithEmailAndPassword(need(), email.trim(), password);
    },
    [need],
  );

  const logInWithGoogle = useCallback(async () => {
    await signInWithPopup(need(), new GoogleAuthProvider());
  }, [need]);

  const resetPassword = useCallback(
    async (email: string) => {
      await sendPasswordResetEmail(need(), email.trim());
    },
    [need],
  );

  const rename = useCallback(
    async (name: string) => {
      const user = need().currentUser;
      if (!user) return;
      await updateProfile(user, { displayName: cleanName(name) });
      await user.getIdToken(true);
      setPlayer(toPlayer(user));
    },
    [need],
  );

  const logOut = useCallback(async () => {
    if (auth) await fbSignOut(auth);
  }, [auth]);

  const idToken = useCallback(async () => (auth?.currentUser ? auth.currentUser.getIdToken() : null), [auth]);

  const [dialog, setDialog] = useState<{ mode: AuthMode; reason?: string } | null>(null);
  const openAuth = useCallback((mode: AuthMode = 'login', reason?: string) => setDialog({ mode, reason }), []);

  const api = useMemo<AuthApi>(
    () => ({ enabled: firebaseConfigured, ready, player, signUp, logIn, logInWithGoogle, resetPassword, rename, logOut, idToken, openAuth }),
    [ready, player, signUp, logIn, logInWithGoogle, resetPassword, rename, logOut, idToken, openAuth],
  );

  return (
    <AuthContext.Provider value={api}>
      {children}
      {dialog && <AuthDialog initialMode={dialog.mode} reason={dialog.reason} onClose={() => setDialog(null)} />}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
