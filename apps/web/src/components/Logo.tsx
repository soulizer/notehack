import { cn } from '../lib/utils';

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="1.5" y="1.5" width="29" height="29" rx="8.5" fill="#0B1020" stroke="rgba(255,255,255,.14)" />
      <path d="M9.5 22.5V9.5L22.5 22.5V9.5" stroke="#F4F2EC" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="22.5" cy="9.5" r="2.15" fill="#8DB4FF" />
    </svg>
  );
}

export function LogoLockup({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return (
    <span className={cn('brand-lockup', compact && 'brand-lockup-compact')}>
      <LogoMark size={27} />
      {!compact && (
        <span className="brand-wordmark" style={inverse ? undefined : { color: 'var(--text)' }}>
          Note<span>Hack</span>
        </span>
      )}
    </span>
  );
}
