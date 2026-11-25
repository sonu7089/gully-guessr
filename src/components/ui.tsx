import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'ink' | 'outline' | 'lilac' | 'outline-dark';

interface ArrowButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  arrow?: '→' | '↓' | '↗' | '↑' | '←';
  block?: boolean;
  children: ReactNode;
}

/** Editorial button: sentence-case label paired with a minimal directional arrow. */
export function ArrowButton({ variant = 'ink', arrow = '→', block, className = '', children, type = 'button', ...rest }: ArrowButtonProps) {
  return (
    <button type={type} className={`btn btn--${variant}${block ? ' btn--block' : ''} ${className}`.trim()} {...rest}>
      <span>{children}</span>
      <span className="arrow" aria-hidden="true">
        {arrow}
      </span>
    </button>
  );
}

/** Geometric pin/compass line mark used next to the wordmark. */
export function PinMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true">
      <circle cx="13" cy="11" r="7.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 3.75V1M13 21v4M5.75 11H3M23 11h-2.75" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13 6.5 15 11l-2 4.5-2-4.5 2-4.5Z" fill="currentColor" />
    </svg>
  );
}
