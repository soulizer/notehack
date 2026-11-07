import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Check, Save, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useAppStore } from '../../stores/app';
import { useT } from '../../lib/i18n';
import { formatBytes, formatFullDate } from '../../lib/utils';
import { Avatar } from '../Avatar';
import { Modal } from '../Modal';
import { toast } from '../../stores/toast';

function roleLabel(t: ReturnType<typeof useT>, role: string): string {
  if (role === 'owner') return t('所有者');
  if (role === 'admin') return t('管理员');
  if (role === 'editor') return t('编辑者');
  if (role === 'viewer') return t('查看者');
  return role;
}

export default function AccountSettings() {
  const t = useT();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const workspaceId = useAppStore((state) => state.workspaceId);
  const workspace = useAuthStore((state) => state.workspaces.find((entry) => entry.id === workspaceId));
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState<{ noteCount: number; memberCount: number; attachmentBytes: number } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    api
      .get<{ noteCount: number; memberCount: number; attachmentBytes: number }>(`/api/workspaces/${workspaceId}/summary`)
      .then(setSummary)
      .catch(() => {});
  }, [workspaceId]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await api.patch<{ user: typeof user }>('/api/me', { displayName: displayName.trim() });
      if (response.user) setUser(response.user);
      toast('success', t('已保存设置'));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAccount() {
    setDeleting(true);
    setError(null);
    try {
      await api.delete('/api/me', { password: deletePassword, confirm: 'DELETE' });
      useAuthStore.setState({ user: null, workspaces: [], status: 'anonymous' });
      navigate('/', { replace: true });
    } catch (error) {
      setError((error as Error).message);
      setDeleting(false);
    }
  }

  return (
    <>
      <h1 className="settings-title">{t('账户')}</h1>
      <p className="settings-subtitle">{t('管理你的身份、登录邮箱与个人空间。')}</p>

      <section className="settings-section">
        <div className="settings-section-head">
          <span className="settings-section-title">{t('个人资料')}</span>
          <span className="settings-section-desc">{t('显示在评论、分享与团队中')}</span>
        </div>
        <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', marginBottom: 22 }}>
          <Avatar name={displayName || user?.displayName || 'N'} color={user?.avatarColor} size="xl" />
          <div style={{ flex: 1 }}>
            <div className="field" style={{ marginBottom: 12 }}>
              <label>{t('显示名称')}</label>
              <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={60} />
            </div>
            <div className="field">
              <label>{t('邮箱')}</label>
              <input className="input" value={email} readOnly disabled />
              <span className="field-hint">{t('邮箱用于登录与账户识别。NoteHack 不会向它发送邮件。')}</span>
            </div>
          </div>
        </div>
        {error && <div className="form-error" style={{ marginBottom: 10 }}><AlertCircle size={14} /> {error}</div>}
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving || !displayName.trim() || displayName.trim() === user?.displayName}>
          {saving ? <span className="spinner" /> : <Save size={13} />} {t('保存')}
        </button>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <span className="settings-section-title">{t('当前空间')}</span>
          <span className="settings-section-desc">{workspace?.kind === 'team' ? t('团队空间') : t('个人空间')}</span>
        </div>
        <div className="setting-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="workspace-mark" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', border: 0 }}>{workspace?.name.slice(0, 1)}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{workspace?.name}</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-tertiary)', marginTop: 2 }}>{t('角色：{role}', { role: roleLabel(t, workspace?.role ?? 'owner') })}</div>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => navigate('/app/settings/team')}>{t('管理')}</button>
          </div>
          {summary && (
            <div style={{ display: 'flex', gap: 26, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line-soft)' }}>
              <div>
                <div style={{ fontSize: 18, fontFamily: 'var(--font-serif)', fontWeight: 500 }}>{summary.noteCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t('笔记')}</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontFamily: 'var(--font-serif)', fontWeight: 500 }}>{summary.memberCount}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t('成员')}</div>
              </div>
              <div>
                <div style={{ fontSize: 18, fontFamily: 'var(--font-serif)', fontWeight: 500 }}>{formatBytes(summary.attachmentBytes)}</div>
                <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{t('附件')}</div>
              </div>
            </div>
          )}
        </div>
        <div className="setting-note" style={{ marginTop: 8 }}>
          {t('账户创建于 {date}', { date: user ? formatFullDate(user.createdAt) : '' })} · {t('实例管理员')}: {user?.role === 'admin' ? t('是') : t('否')}
        </div>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <span className="settings-section-title" style={{ color: 'var(--red)' }}>{t('危险操作')}</span>
        </div>
        <div className="setting-row">
          <div className="setting-row-main">
            <div className="setting-row-title">{t('注销账户')}</div>
            <div className="setting-row-desc">{t('删除你的个人空间、笔记、附件与登录会话。团队空间需要先转移所有权。')}</div>
          </div>
          <div className="setting-row-control">
            <button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 size={13} /> {t('注销账户')}
            </button>
          </div>
        </div>
      </section>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('注销账户')}
        description={t('此操作不可撤销。请先导出你需要保留的数据。')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteOpen(false)}>{t('取消')}</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={deleteAccount} disabled={deleting || deleteConfirm !== 'DELETE' || !deletePassword}>
              {deleting ? <span className="spinner" /> : <Trash2 size={13} />} {t('永久注销')}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label>{t('密码')}</label>
            <input className="input" type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} autoComplete="current-password" />
          </div>
          <div className="field">
            <label>{t('输入 DELETE 确认')}</label>
            <input className="input mono" value={deleteConfirm} onChange={(event) => setDeleteConfirm(event.target.value)} placeholder="DELETE" />
          </div>
          <div className="banner banner-error">
            <AlertCircle size={14} />
            <div>{t('个人空间和附件会被立即删除。备份中的副本会在保留周期结束后清除。')}</div>
          </div>
        </div>
      </Modal>
    </>
  );
}
