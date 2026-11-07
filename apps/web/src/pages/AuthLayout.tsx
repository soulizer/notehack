import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, ShieldCheck, WifiOff } from 'lucide-react';
import { LogoLockup } from '../components/Logo';
import { useT } from '../lib/i18n';

export function AuthLayout({
  children,
  quote,
  caption,
}: {
  children: ReactNode;
  quote?: string;
  caption?: string;
}) {
  const t = useT();
  return (
    <div className="auth-page">
      <aside className="auth-visual">
        <div className="auth-visual-top">
          <Link to="/" aria-label="NoteHack">
            <LogoLockup inverse />
          </Link>
          <Link
            to="/"
            style={{ color: 'rgba(242,240,234,.42)', fontSize: 10.5, display: 'flex', alignItems: 'center', gap: 5 }}
          >
            <ArrowLeft size={12} />
            {t('返回首页')}
          </Link>
        </div>
        <div className="auth-visual-body">
          <div className="auth-visual-quote">
            {quote ?? t('把想法留下，')}
            <br />
            <em>{caption ?? t('把知识连起来。')}</em>
          </div>
          <p className="auth-visual-text">
            {t('一个安静、快速、属于你的笔记空间。自动保存、离线可写、冲突保留副本，数据随时可以带走。')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 28 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'rgba(242,240,234,.46)' }}>
              <Check size={13} style={{ color: '#8DB4FF' }} /> {t('Markdown 为底，导出无损')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'rgba(242,240,234,.46)' }}>
              <WifiOff size={13} style={{ color: '#8DB4FF' }} /> {t('离线继续写，联网自动同步')}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'rgba(242,240,234,.46)' }}>
              <ShieldCheck size={13} style={{ color: '#8DB4FF' }} /> {t('TLS、2FA、加密存储与可下载备份')}
            </span>
          </div>
        </div>
        <div className="auth-visual-foot">
          <span>© {new Date().getFullYear()} NoteHack</span>
          <Link to="/privacy" style={{ color: 'inherit' }}>{t('隐私政策')}</Link>
          <Link to="/terms" style={{ color: 'inherit' }}>{t('服务条款')}</Link>
        </div>
      </aside>
      <main className="auth-panel">
        <div className="auth-card">
          <div className="auth-logo-mobile">
            <Link to="/" aria-label="NoteHack">
              <LogoLockup />
            </Link>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
