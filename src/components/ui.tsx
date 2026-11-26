import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md' | 'lg';
  icon?: ReactNode;
  block?: boolean;
  children: ReactNode;
}

/** Glossy pill button: green for the main action, purple for secondary, translucent for quiet ones. */
export function Button({ variant = 'primary', size = 'md', icon, block, className = '', children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={`btn btn--${variant} btn--${size}${block ? ' btn--block' : ''} ${className}`.trim()} {...rest}>
      <span>{children}</span>
      {icon && (
        <span className="btn__icon" aria-hidden="true">
          {icon}
        </span>
      )}
    </button>
  );
}

export const ArrowIcon = ({ dir = 'right' }: { dir?: 'right' | 'down' | 'up' | 'left' }) => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 16 16"
    fill="none"
    style={{ transform: { right: undefined, down: 'rotate(90deg)', up: 'rotate(-90deg)', left: 'rotate(180deg)' }[dir] }}
  >
    <path d="M3 8h9.5M8.5 3.5 13 8l-4.5 4.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PlayIcon = () => (
  <svg width="14" height="14" viewBox="0 0 16 16">
    <path d="M4 2.5v11l9.5-5.5z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const ChevronIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2.5 4.5 6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const CheckIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="m2.5 6.2 2.3 2.3L9.5 3.8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Yellow map pin on a night tile. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#2b2363" />
      <path d="M16 4.5a8 8 0 0 0-8 8c0 6 8 14.5 8 14.5s8-8.5 8-14.5a8 8 0 0 0-8-8z" fill="#ffc628" />
      <circle cx="16" cy="12.5" r="3.2" fill="#2b2363" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark__text">
      GULLY<em>GUESSR</em>
    </span>
  );
}

interface SegmentedProps<T extends string | number> {
  name: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}

/** Recessed pill track with a raised purple thumb on the active option. */
export function Segmented<T extends string | number>({ name, value, options, onChange, className = '' }: SegmentedProps<T>) {
  return (
    <div className={`seg ${className}`.trim()} role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button key={String(o.id)} type="button" role="radio" aria-checked={o.id === value} className="seg__opt" onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface SelectPillProps<T extends string | number> extends Omit<SegmentedProps<T>, 'className'> {
  label: string;
}

export function SelectPill<T extends string | number>({ name, label, value, options, onChange }: SelectPillProps<T>) {
  return (
    <label className="select-pill">
      <span className="select-pill__label">{label}</span>
      <select
        aria-label={name}
        value={String(value)}
        onChange={(e) => {
          const hit = options.find((o) => String(o.id) === e.target.value);
          if (hit) onChange(hit.id);
        }}
      >
        {options.map((o) => (
          <option key={String(o.id)} value={String(o.id)}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronIcon />
    </label>
  );
}

/** Small uppercase italic label used above values, like a scoreboard caption. */
export const Eyebrow = ({ children, className = '' }: { children: ReactNode; className?: string }) => <span className={`eyebrow ${className}`.trim()}>{children}</span>;

export function ProgressBar({ value, label, size = 'md' }: { value: number; label: string; size?: 'sm' | 'md' }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <div className={`progress progress--${size}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
      <div className="progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

const prefersReducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Eases the displayed number from its previous value (or `from`) to `target`. */
export function useCountUp(target: number, ms = 900, from = target): number {
  const [value, setValue] = useState(from);
  const current = useRef(from);
  useEffect(() => {
    const start = current.current;
    if (start === target) return;
    if (prefersReducedMotion()) {
      current.current = target;
      setValue(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      const v = Math.round(start + (target - start) * (1 - (1 - k) ** 3));
      current.current = v;
      setValue(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}
