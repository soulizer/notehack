import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LogoLockup } from '../components/Logo';
import { useT } from '../lib/i18n';

export function AuthLayout({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  const t = useT();
  return (
    <div className="auth-screen">
      <header className="auth-screen-head">
        <Link to="/app" aria-label="NoteHack" className="auth-screen-brand">
          <LogoLockup />
        </Link>
      </header>
      <main className="auth-screen-main">
        <div className={wide ? 'auth-card-clean auth-card-wide' : 'auth-card-clean'}>{children}</div>
      </main>
      <footer className="auth-screen-foot">
        <span>© {new Date().getFullYear()} NoteHack</span>
        <div className="auth-screen-links">
          <Link to="/privacy">{t('隐私政策')}</Link>
          <Link to="/terms">{t('服务条款')}</Link>
        </div>
      </footer>
    </div>
  );
}
