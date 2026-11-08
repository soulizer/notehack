import { cn } from '../lib/utils';

/**
 * The mark is a handwritten note with a gold pen on a warm ink tile. It is
 * drawn as a compact vector so it stays readable in the sidebar, auth pages,
 * favicon and installed PWA icon.
 */
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="nh-pen" x1="32" y1="6" x2="41" y2="28" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F4D58F" />
            <stop offset="0.5" stopColor="#DDAE50" />
            <stop offset="1" stopColor="#BC8730" />
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="46" height="46" rx="12" fill="#201A13" />
        <rect x="1.6" y="1.6" width="44.8" height="44.8" rx="11.4" stroke="#3B3023" strokeWidth="1" />
        <g transform="rotate(-7 23 25)">
          <rect x="12.3" y="12.8" width="20.5" height="25.4" rx="3.6" fill="#BFA778" fillOpacity="0.55" />
          <rect x="10.5" y="10.5" width="20.5" height="25.4" rx="3.6" fill="#FFF9EA" stroke="#D8C08A" strokeWidth="1" />
          <path d="M14.8 17.3c2-1.6 3.6 1.6 5.6 0 2-1.6 3.6 1.6 5.6 0" stroke="#6B5237" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M14.8 22.6c2-1.6 3.6 1.6 5.6 0 2-1.6 3.6 1.6 5.6 0" stroke="#6B5237" strokeWidth="1.6" strokeLinecap="round" />
          <path d="M14.8 27.9c2-1.6 3.6 1.6 5.6 0 2-1.6 3.6 1.6 5.6 0" stroke="#6B5237" strokeWidth="1.6" strokeLinecap="round" />
        </g>
        <g transform="rotate(39 36 21)">
          <rect x="32.4" y="6.5" width="8.3" height="20.5" rx="4.15" fill="url(#nh-pen)" />
          <rect x="33.5" y="8" width="2.2" height="14.5" rx="1.1" fill="#FAE5AF" fillOpacity="0.7" />
          <rect x="32.4" y="11.3" width="8.3" height="1.6" fill="#9D6C20" fillOpacity="0.55" />
          <path d="M32.4 27h8.3l-4.15 6.4z" fill="#C79A4B" />
          <path d="M34.4 31.2h4.3l-2.15 4.3z" fill="#4F3922" />
        </g>
      </svg>
    </span>
  );
}

export function LogoLockup({ inverse = false }: { inverse?: boolean }) {
  return (
    <span className={cn('brand-lockup', inverse && 'brand-lockup-inverse')}>
      <LogoMark />
      <span className="brand-wordmark">NoteHack<span className="brand-period">.</span></span>
    </span>
  );
}
