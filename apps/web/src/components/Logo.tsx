import { cn } from '../lib/utils';

/**
 * The mark is a small geometric N with a single blue full stop. It is drawn
 * as a path rather than typeset so it stays crisp in the sidebar, auth pages,
 * favicon and installed PWA icon.
 */
export function LogoMark({ size = 20, inverse = false }: { size?: number; inverse?: boolean }) {
  return (
    <span className={cn('brand-mark', inverse && 'brand-mark-inverse')} style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M6.5 26V6l15 20V6"
          stroke="currentColor"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="27" cy="26" r="2.25" fill="var(--blue)" />
      </svg>
    </span>
  );
}

export function LogoLockup({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={cn('brand-lockup', inverse && 'brand-lockup-inverse')}>
      <LogoMark inverse={inverse} />
      <span className="brand-wordmark">NoteHack<span className="brand-period">.</span></span>
    </span>
  );
}
