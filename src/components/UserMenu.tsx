import { useEffect, useRef, useState, type FormEvent } from 'react';
import { authErrorMessage, cleanName, NAME_MAX, NAME_MIN, useAuth, type Player } from '../auth/AuthProvider';
import { Button, ChevronIcon } from './ui';

export function Avatar({ player, size = 32 }: { player: Pick<Player, 'name' | 'photoURL'>; size?: number }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.45 }} aria-hidden="true">
      {player.photoURL && !broken ? (
        <img src={player.photoURL} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} />
      ) : (
        player.name.slice(0, 1).toUpperCase()
      )}
    </span>
  );
}

/** Log in / sign up buttons, or the signed-in player's menu. */
export function UserMenu() {
  const { enabled, ready, player, openAuth, logOut, rename } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !root.current?.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  if (!enabled || !ready) return null;

  if (!player) {
    return (
      <div className="user-menu__guest">
        <button type="button" className="site-nav__link" onClick={() => openAuth('login')}>
          Log in
        </button>
        <Button size="sm" variant="secondary" onClick={() => openAuth('signup')}>
          Sign up
        </Button>
      </div>
    );
  }

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (cleanName(name).length < NAME_MIN) return setError(`At least ${NAME_MIN} characters.`);
    try {
      await rename(name);
      setEditing(false);
      setError(null);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  };

  return (
    <div className="user-menu" ref={root}>
      <button type="button" className="user-menu__trigger" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((o) => !o)}>
        <Avatar player={player} />
        <span className="user-menu__name">{player.name}</span>
        <ChevronIcon />
      </button>
      {open && (
        <div className="user-menu__panel" role="menu">
          <div className="user-menu__who">
            <Avatar player={player} size={44} />
            <div>
              <strong>{player.name}</strong>
              <span>{player.email}</span>
            </div>
          </div>
          {editing ? (
            <form className="user-menu__rename" onSubmit={save}>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={NAME_MAX} aria-label="Player name" autoFocus />
              <Button type="submit" size="sm">
                Save
              </Button>
              {error && <p className="auth__error">{error}</p>}
            </form>
          ) : (
            <button
              type="button"
              role="menuitem"
              className="user-menu__item"
              onClick={() => {
                setName(player.name);
                setError(null);
                setEditing(true);
              }}
            >
              Change player name
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="user-menu__item"
            onClick={() => {
              setOpen(false);
              logOut();
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
