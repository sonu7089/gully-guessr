import { GAME_TITLE } from '../config';
import { Button, Logo, PlayIcon, Wordmark } from './ui';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  onPlayNow?: () => void;
  onHome?: () => void;
  onMultiplayer?: () => void;
  /** Section links only make sense on the landing page. */
  sections?: boolean;
}

export function Header({ onPlayNow, onHome, onMultiplayer, sections = true }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <button className="wordmark" onClick={onHome} aria-label={`${GAME_TITLE} home`}>
          <Logo />
          <Wordmark />
        </button>
        <nav className="site-nav" aria-label="Primary">
          {sections && (
            <>
              <a href="#maps">Maps</a>
              <a href="#how">How to play</a>
            </>
          )}
          {onMultiplayer && (
            <button type="button" className="site-nav__link site-nav__mp" onClick={onMultiplayer}>
              Multiplayer
            </button>
          )}
          {onPlayNow && (
            <Button size="sm" onClick={onPlayNow} icon={<PlayIcon />} className="site-nav__play">
              Play
            </Button>
          )}
          <UserMenu />
        </nav>
      </div>
    </header>
  );
}
