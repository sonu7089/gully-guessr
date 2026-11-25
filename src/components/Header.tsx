import { GAME_TITLE } from '../config';
import { PinMark } from './ui';

interface HeaderProps {
  onPlayNow: () => void;
  onHome?: () => void;
}

export function Header({ onPlayNow, onHome }: HeaderProps) {
  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <button className="wordmark" onClick={onHome} aria-label={`${GAME_TITLE} home`}>
          <PinMark />
          <span>{GAME_TITLE}</span>
        </button>
        <nav className="site-nav" aria-label="Primary">
          <a href="#how">How it works</a>
          <a href="#regions">Regions</a>
          <a href="#stats">Stats</a>
          <button className="btn btn--outline" onClick={onPlayNow}>
            <span>Play now</span>
            <span className="arrow" aria-hidden="true">↗</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
