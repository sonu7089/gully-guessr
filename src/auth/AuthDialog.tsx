import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Logo } from '../components/ui';
import { authErrorMessage, NAME_MAX, NAME_MIN, useAuth, type AuthMode } from './AuthProvider';

interface AuthDialogProps {
  initialMode: AuthMode;
  reason?: string;
  onClose: () => void;
}

const TITLES: Record<AuthMode, string> = {
  login: 'Log in',
  signup: 'Create your account',
  reset: 'Reset your password',
};

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}

export function AuthDialog({ initialMode, reason, onClose }: AuthDialogProps) {
  const { signUp, logIn, logInWithGoogle, resetPassword } = useAuth();
  const ref = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => d?.close();
  }, []);

  const switchTo = (m: AuthMode) => {
    setMode(m);
    setError(null);
    setSent(false);
  };

  const run = async (fn: () => Promise<void>, closeAfter = true) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      if (closeAfter) onClose();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'signup') {
      if (name.trim().length < NAME_MIN) return setError(`Pick a player name with at least ${NAME_MIN} characters.`);
      run(() => signUp(name, email, password));
    } else if (mode === 'login') {
      run(() => logIn(email, password));
    } else {
      run(async () => {
        await resetPassword(email);
        setSent(true);
      }, false);
    }
  };

  return (
    <dialog
      ref={ref}
      className="auth"
      aria-labelledby="auth-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="auth__card">
        <button type="button" className="auth__close" onClick={onClose} aria-label="Close">
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
            <path d="M2 2l10 10M12 2 2 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="auth__brand">
          <Logo size={40} />
        </div>
        <h2 id="auth-title" className="auth__title">
          {TITLES[mode]}
        </h2>
        {reason && mode !== 'reset' && <p className="auth__reason">{reason}</p>}

        {mode !== 'reset' && (
          <>
            <button type="button" className="auth__google" onClick={() => run(logInWithGoogle)} disabled={busy}>
              <GoogleIcon />
              Continue with Google
            </button>
            <div className="auth__or">
              <span>or</span>
            </div>
          </>
        )}

        {sent ? (
          <div className="auth__sent" role="status">
            <p>
              If an account exists for <strong>{email.trim()}</strong>, a reset link is on its way. Check your inbox and spam folder.
            </p>
            <Button block onClick={() => switchTo('login')}>
              Back to log in
            </Button>
          </div>
        ) : (
          <form className="auth__form" onSubmit={onSubmit} noValidate>
            {mode === 'signup' && (
              <label className="field">
                <span>Player name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} autoComplete="nickname" required placeholder="Shown to other players" />
              </label>
            )}
            <label className="field">
              <span>Email</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required placeholder="you@example.com" />
            </label>
            {mode !== 'reset' && (
              <label className="field">
                <span className="field__row">
                  Password
                  {mode === 'login' && (
                    <button type="button" className="link-quiet" onClick={() => switchTo('reset')}>
                      Forgot password?
                    </button>
                  )}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  minLength={6}
                  required
                  placeholder={mode === 'signup' ? 'At least 6 characters' : ''}
                />
              </label>
            )}
            {error && (
              <p className="auth__error" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" size="lg" block disabled={busy}>
              {busy ? 'Please wait…' : mode === 'signup' ? 'Sign up' : mode === 'login' ? 'Log in' : 'Send reset link'}
            </Button>
          </form>
        )}

        <p className="auth__switch">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button type="button" className="link-quiet" onClick={() => switchTo('login')}>
                Log in
              </button>
            </>
          ) : mode === 'login' ? (
            <>
              New here?{' '}
              <button type="button" className="link-quiet" onClick={() => switchTo('signup')}>
                Create an account
              </button>
            </>
          ) : (
            <button type="button" className="link-quiet" onClick={() => switchTo('login')}>
              Back to log in
            </button>
          )}
        </p>
      </div>
    </dialog>
  );
}
