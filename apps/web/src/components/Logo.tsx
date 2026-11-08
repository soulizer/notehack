import { cn } from '../lib/utils';

/**
 * NoteHack's identity is typographic: the wordmark is the logo and the blue
 * full stop is its only mark. The collapsed sidebar shows the same N + period
 * silhouette instead of introducing a second logo.
 */
export function LogoLockup({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={cn('brand-lockup', inverse && 'brand-lockup-inverse')}>
      <span className="brand-wordmark">
        NoteHack<span className="brand-period">.</span>
      </span>
      <span className="brand-initial" aria-hidden="true">
        N<span>.</span>
      </span>
    </span>
  );
}
