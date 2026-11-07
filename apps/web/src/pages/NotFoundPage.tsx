import { Link } from 'react-router-dom';
import { useT } from '../lib/i18n';
import { LogoLockup } from '../components/Logo';

export default function NotFoundPage() {
  const t = useT();
  return (
    <div className="notfound">
      <div>
        <div className="notfound-code">404</div>
        <h1>{t('页面不存在')}</h1>
        <p>{t('它可能已经被移动，或链接不完整。')}</p>
        <Link to="/" className="btn btn-primary"><LogoLockup compact /> {t('返回首页')}</Link>
      </div>
    </div>
  );
}
