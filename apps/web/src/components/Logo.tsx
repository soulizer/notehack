import { cn } from '../lib/utils';

/** Typographic identity: the wordmark is the logo. A blue full stop is the only accent. */
export function LogoMark({ size = 24, inverse = false }: { size?: number; inverse?: boolean }) {
  return (
    <span
      className={cn('logo-initial', inverse && 'logo-initial-inverse')}
      style={{ fontSize: size }}
      aria-hidden="true"
    >
      N<span>.</span>
    </span>
  );
}

export function LogoLockup({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <span
      className={cn('brand-lockup', compact && 'brand-lockup-compact')}
      style={{ color: inverse ? '#F2F0EA' : 'var(--text)' }}
    >
      <span className="brand-wordmark">
        NoteHack<span className="brand-period" style={{ color: inverse ? '#8DB4FF' : 'var(--blue)' }}>.</span>
      </span>
      <span className="brand-initial" aria-hidden="true">
        N<span>.</span>
      </span>
    </span>
  );
}
