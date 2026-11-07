import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, ArrowRight, Check, Copy, KeyRound } from 'lucide-react';
import { api } from '../lib/api';
import { useT } from '../lib/i18n';
import { copyText } from '../lib/utils';
import { AuthLayout } from './AuthLayout';

export default function RecoverPage() {
  const t = useT();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [key, setKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError(t('两次输入的密码不一致'));
      return;
    }
    setLoading(true);
    try {
      const response = await api.post<{ recoveryKey: string }>('/api/auth/recover', {
        email,
        recoveryKey: key,
        newPassword: password,
      });
      setNewKey(response.recoveryKey);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  }

  if (newKey) {
    return (
      <AuthLayout quote={t('重新开始，')} caption={t('从这把新钥匙。')}>
        <h1 className="auth-heading">{t('账户已恢复')}</h1>
        <p className="auth-sub">
          {t('密码已重置，所有旧会话与两步验证已失效。下面是新的恢复密钥，请重新保存。')}
        </p>
        <div className="recovery-key-display" style={{ marginTop: 22 }}>{newKey}</div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 10 }}
          onClick={async () => {
            await copyText(newKey);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? t('已复制') : t('复制密钥')}
        </button>
        <div className="banner banner-warning" style={{ marginTop: 18 }}>
          <KeyRound size={15} />
          <div>{t('旧恢复密钥已作废。两步验证需要重新开启。')}</div>
        </div>
        <button type="button" className="btn btn-primary btn-block auth-submit" style={{ marginTop: 20 }} onClick={() => navigate('/login')}>
          {t('使用新密码登录')} <ArrowRight size={14} />
        </button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout quote={t('忘记密码时，')} caption={t('还有一把钥匙。')}>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/login')} style={{ marginLeft: -10, marginBottom: 18 }}>
        <ArrowLeft size={13} /> {t('返回登录')}
      </button>
      <h1 className="auth-heading">{t('恢复账户')}</h1>
      <p className="auth-sub">{t('使用注册时保存的恢复密钥重设密码。为安全起见，两步验证和所有登录设备也会被重置。')}</p>
      <form className="auth-form" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="recover-email">{t('邮箱')}</label>
          <input id="recover-email" className="input input-lg" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="recover-key">{t('恢复密钥')}</label>
          <input id="recover-key" className="input input-lg mono" value={key} onChange={(event) => setKey(event.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" required autoComplete="off" />
        </div>
        <div className="field">
          <label htmlFor="recover-password">{t('新密码')}</label>
          <input id="recover-password" className="input input-lg" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={10} autoComplete="new-password" placeholder={t('至少 10 个字符')} />
        </div>
        <div className="field">
          <label htmlFor="recover-confirm">{t('确认密码')}</label>
          <input id="recover-confirm" className="input input-lg" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required autoComplete="new-password" />
        </div>
        {error && <div className="form-error"><AlertCircle size={14} /> {error}</div>}
        <button type="submit" className="btn btn-primary btn-block auth-submit" disabled={loading}>
          {loading ? <span className="spinner" /> : <KeyRound size={14} />}
          {loading ? t('重置中…') : t('重置密码')}
        </button>
      </form>
      <p className="auth-switch">
        {t('没有恢复密钥？')} <Link to="/">{t('联系实例管理员')}</Link>
      </p>
    </AuthLayout>
  );
}
