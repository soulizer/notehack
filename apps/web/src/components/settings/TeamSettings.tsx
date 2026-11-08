import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Check,
  Copy,
  Crown,
  LogOut,
  MailPlus,
  Shield,
  Trash2,
  UserMinus,
  Users,
} from 'lucide-react';
import type { AuditEntry, Invitation, User, WorkspaceMember } from '@notehack/shared';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useAppStore } from '../../stores/app';
import { useT } from '../../lib/i18n';
import { copyText, formatFullDate, formatRelativeShort } from '../../lib/utils';
import { Avatar } from '../Avatar';
import { Modal } from '../Modal';
import { toast } from '../../stores/toast';

const ROLES = ['admin', 'editor', 'viewer'] as const;

export default function TeamSettings() {
  const t = useT();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const workspaces = useAuthStore((state) => state.workspaces);
  const refreshAuth = useAuthStore((state) => state.refresh);
  const workspaceId = useAppStore((state) => state.workspaceId);
  const initialize = useAppStore((state) => state.initialize);
  const workspace = workspaces.find((entry) => entry.id === workspaceId);
  const canManage = workspace?.role === 'owner' || workspace?.role === 'admin';
  const isOwner = workspace?.role === 'owner';

  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [invitations, setInvitations] = useState<Array<Invitation & { url?: string }>>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [name, setName] = useState(workspace?.name ?? '');
  const [savingName, setSavingName] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [removeMember, setRemoveMember] = useState<WorkspaceMember | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setName(workspace?.name ?? '');
    if (!workspaceId) return;
    void loadMembers();
    if (canManage) {
      void loadInvitations();
      void loadAudit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, canManage, workspace?.name]);

  async function loadMembers() {
    try {
      const response = await api.get<{ members: WorkspaceMember[] }>(`/api/workspaces/${workspaceId}/members`);
      setMembers(response.members);
    } catch {
      /* ignore */
    }
  }

  async function loadInvitations() {
    try {
      const response = await api.get<{ invitations: Array<Invitation & { url?: string }> }>(`/api/workspaces/${workspaceId}/invitations`);
      setInvitations(response.invitations);
    } catch {
      /* ignore */
    }
  }

  async function loadAudit() {
    try {
      const response = await api.get<{ entries: AuditEntry[] }>(`/api/workspaces/${workspaceId}/audit`);
      setAudit(response.entries);
    } catch {
      /* ignore */
    }
  }

  async function saveName() {
    if (!workspaceId || !name.trim()) return;
    setSavingName(true);
    try {
      await api.patch(`/api/workspaces/${workspaceId}`, { name: name.trim() });
      await refreshAuth();
      toast('success', t('设置已保存'));
    } catch (error) {
      toast('error', t('保存失败'), (error as Error).message);
    } finally {
      setSavingName(false);
    }
  }

  async function invite() {
    if (!workspaceId || !inviteEmail.trim()) return;
    setInviting(true);
    setError(null);
    try {
      const response = await api.post<{ invitation: Invitation & { url?: string }; emailSent: boolean }>(
        `/api/workspaces/${workspaceId}/invitations`,
        { email: inviteEmail.trim(), role: inviteRole },
      );
      setInvitations((current) => [response.invitation, ...current]);
      setInviteLink(response.invitation.url ?? null);
      setInviteEmail('');
      toast('success', t('邀请已创建'), t('我们不会发送邮件。请复制邀请链接发给对方。'));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setInviting(false);
    }
  }

  async function changeRole(member: WorkspaceMember, role: string) {
    if (role === 'owner' && !window.confirm(t('确定把空间所有权转移给 {name}？你将成为管理员。', { name: member.displayName }))) {
      await loadMembers();
      return;
    }
    try {
      await api.patch(`/api/workspaces/${workspaceId}/members/${member.userId}`, { role });
      await loadMembers();
      await refreshAuth();
      toast('success', t('角色已更新'));
    } catch (error) {
      toast('error', t('操作失败'), (error as Error).message);
    }
  }

  async function confirmRemove() {
    if (!removeMember) return;
    try {
      await api.delete(`/api/workspaces/${workspaceId}/members/${removeMember.userId}`);
      setRemoveMember(null);
      await loadMembers();
      toast('success', t('成员已移除'));
    } catch (error) {
      toast('error', t('操作失败'), (error as Error).message);
    }
  }

  async function revokeInvitation(id: string) {
    try {
      await api.delete(`/api/workspaces/${workspaceId}/invitations/${id}`);
      setInvitations((current) => current.filter((entry) => entry.id !== id));
    } catch (error) {
      toast('error', t('操作失败'), (error as Error).message);
    }
  }

  async function createWorkspace() {
    if (!createName.trim()) return;
    setCreating(true);
    try {
      const response = await api.post<{ workspace: { id: string; name: string } }>('/api/workspaces', { name: createName.trim() });
      await refreshAuth();
      localStorage.setItem('nh-workspace', response.workspace.id);
      await initialize(response.workspace.id);
      setCreateName('');
      navigate('/app');
      toast('success', t('团队空间已创建'));
    } catch (error) {
      toast('error', t('创建失败'), (error as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function deleteWorkspace() {
    try {
      await api.delete(`/api/workspaces/${workspaceId}`);
      await refreshAuth();
      localStorage.removeItem('nh-workspace');
      setDeleteOpen(false);
      navigate('/app');
    } catch (error) {
      toast('error', t('删除失败'), (error as Error).message);
    }
  }

  async function leaveWorkspace() {
    try {
      await api.post(`/api/workspaces/${workspaceId}/leave`);
      await refreshAuth();
      localStorage.removeItem('nh-workspace');
      setLeaveOpen(false);
      navigate('/app');
    } catch (error) {
      toast('error', t('操作失败'), (error as Error).message);
    }
  }

  function copy(value: string, id: string) {
    void copyText(value).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <>
      <h1 className="settings-title">{t('团队与空间')}</h1>
      <p className="settings-subtitle">{t('空间是内容与成员的边界。个人空间只属于你；团队空间通过角色与审计记录协作。')}</p>

      <section className="settings-section">
        <div className="settings-section-head">
          <span className="settings-section-title">{t('当前空间')}</span>
          <span className="settings-section-desc">{workspace?.kind === 'team' ? t('团队空间') : t('个人空间')}</span>
        </div>
        <div className="setting-card">
          <div className="setting-inline-form">
            <div className="field">
              <label>{t('空间名称')}</label>
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} disabled={!canManage} maxLength={80} />
            </div>
            {canManage && (
              <button type="button" className="btn btn-primary btn-sm" onClick={saveName} disabled={savingName || name.trim() === workspace?.name}>
                {savingName && <span className="spinner" />} {t('保存')}
              </button>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, fontSize: 13, color: 'var(--text-tertiary)' }}>
            <Users size={12} /> {t('{n} 位成员', { n: workspace?.memberCount ?? members.length })}
            <span className="dot" />
            {t('你的角色：{role}', { role: roleLabel(t, workspace?.role ?? '') })}
            {workspace?.kind === 'personal' && <><span className="dot" />{t('只有你可以访问')}</>}
          </div>
        </div>
      </section>

      {workspace?.kind === 'personal' ? (
        <section className="settings-section">
          <div className="settings-section-head"><span className="settings-section-title">{t('需要协作？')}</span></div>
          <div className="banner banner-info">
            <Users size={15} />
            <div>{t('团队空间让多位成员共享文件夹、标签与笔记，并拥有独立成员角色、邀请与审计日志。个人空间保持简单，只属于你。')}</div>
          </div>
          <div className="setting-inline-form" style={{ marginTop: 12 }}>
            <div className="field"><label>{t('团队空间名称')}</label><input className="input" value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder={t('例如：产品团队')} /></div>
            <button type="button" className="btn btn-primary btn-sm" onClick={createWorkspace} disabled={creating || !createName.trim()}>
              {creating && <span className="spinner" />} <Users size={13} /> {t('创建团队空间')}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="settings-section">
            <div className="settings-section-head">
              <span className="settings-section-title">{t('成员')}</span>
              <span className="settings-section-desc">{t('{n} 人', { n: members.length })}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {members.map((member) => (
                <div key={member.userId} className="setting-card" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10 }}>
                  <Avatar name={member.displayName} color={member.avatarColor} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 560, color: 'var(--text)' }}>{member.displayName}</span>
                      {member.userId === user?.id && <span className="badge">{t('你')}</span>}
                      {member.role === 'owner' && <Crown size={11} style={{ color: 'var(--amber)' }} />}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{member.email} · {t('加入于 {date}', { date: formatRelativeShort(member.joinedAt) })}</div>
                  </div>
                  {canManage && member.role !== 'owner' ? (
                    <select className="select select-sm" value={member.role} onChange={(event) => void changeRole(member, event.target.value)} style={{ width: 100 }}>
                      {ROLES.map((role) => <option key={role} value={role}>{roleLabel(t, role)}</option>)}
                      {isOwner && <option value="owner">{t('转移所有权')}</option>}
                    </select>
                  ) : (
                    <span className="badge">{roleLabel(t, member.role)}</span>
                  )}
                  {canManage && member.role !== 'owner' && member.userId !== user?.id && (
                    <button type="button" className="icon-btn icon-btn-sm" onClick={() => setRemoveMember(member)} aria-label={t('移除')} title={t('移除')}>
                      <UserMinus size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>

          {canManage && (
            <section className="settings-section">
              <div className="settings-section-head">
                <span className="settings-section-title">{t('邀请成员')}</span>
                <span className="settings-section-desc">{t('不会发送邮件，请复制链接')}</span>
              </div>
              <div className="setting-inline-form">
                <div className="field"><label>{t('邮箱')}</label><input className="input" type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@example.com" /></div>
                <div className="field" style={{ flex: '0 0 120px' }}><label>{t('角色')}</label><select className="select" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as typeof inviteRole)}>{ROLES.map((role) => <option key={role} value={role}>{roleLabel(t, role)}</option>)}</select></div>
                <button type="button" className="btn btn-primary btn-sm" onClick={invite} disabled={inviting || !inviteEmail.trim()}>
                  {inviting ? <span className="spinner" /> : <MailPlus size={13} />} {t('创建邀请')}
                </button>
              </div>
              {error && <div className="form-error" style={{ marginTop: 10 }}><AlertCircle size={14} /> {error}</div>}
              {inviteLink && (
                <div className="share-link-box" style={{ marginTop: 10 }}>
                  <input readOnly value={inviteLink} onFocus={(event) => event.target.select()} />
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(inviteLink, 'latest')}>{copied === 'latest' ? <Check size={12} /> : <Copy size={12} />} {t('复制')}</button>
                </div>
              )}
              {invitations.length > 0 && (
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {invitations.map((invitation) => (
                    <div key={invitation.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 9px', border: '1px solid var(--line)', borderRadius: 7, background: 'var(--surface)' }}>
                      <Shield size={13} style={{ color: 'var(--text-tertiary)' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: 'var(--text)' }}>{invitation.email} <span className="badge" style={{ marginLeft: 5 }}>{roleLabel(t, invitation.role)}</span></div>
                        <div style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>{t('待接受')} · {formatRelativeShort(invitation.createdAt)}</div>
                      </div>
                      {invitation.url && <button type="button" className="icon-btn icon-btn-sm" onClick={() => copy(invitation.url!, invitation.id)} aria-label={t('复制邀请链接')}>{copied === invitation.id ? <Check size={12} /> : <Copy size={12} />}</button>}
                      <button type="button" className="icon-btn icon-btn-sm" onClick={() => void revokeInvitation(invitation.id)} aria-label={t('撤销')}><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {canManage && (
            <section className="settings-section">
              <div className="settings-section-head">
                <span className="settings-section-title">{t('审计日志')}</span>
                <span className="settings-section-desc">{t('重要安全与数据操作')}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {audit.length === 0 ? (
                  <div className="context-empty">{t('暂无记录')}</div>
                ) : (
                  audit.slice(0, 20).map((entry) => (
                    <div key={entry.id} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--line-soft)', fontSize: 13 }}>
                      <span style={{ width: 110, flex: 'none', color: 'var(--text-tertiary)' }}>{formatFullDate(entry.createdAt)}</span>
                      <span style={{ width: 90, flex: 'none', color: 'var(--text-secondary)' }}>{entry.actorName ?? t('系统')}</span>
                      <span style={{ flex: 1, color: 'var(--text-secondary)' }}>{actionLabel(t, entry.action)}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>{entry.ip}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </>
      )}

      {workspace?.kind === 'team' && (
        <section className="settings-section">
          <div className="settings-section-head"><span className="settings-section-title">{t('创建另一个空间')}</span></div>
          <div className="setting-inline-form">
            <div className="field"><label>{t('名称')}</label><input className="input" value={createName} onChange={(event) => setCreateName(event.target.value)} placeholder={t('例如：研究笔记')} /></div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={createWorkspace} disabled={creating || !createName.trim()}>
              {creating && <span className="spinner" />} <Users size={13} /> {t('创建团队空间')}
            </button>
          </div>
        </section>
      )}

      {workspace?.kind === 'team' && (
        <section className="settings-section">
          <div className="settings-section-head"><span className="settings-section-title" style={{ color: 'var(--red)' }}>{t('危险操作')}</span></div>
          <div className="setting-row">
            <div className="setting-row-main"><div className="setting-row-title">{t('离开空间')}</div><div className="setting-row-desc">{t('离开后，你将失去对空间内容的访问权限。你创建的笔记会保留。')}</div></div>
            <div className="setting-row-control"><button type="button" className="btn btn-ghost btn-sm" onClick={() => setLeaveOpen(true)} disabled={isOwner}><LogOut size={13} /> {t('离开')}</button></div>
          </div>
          {isOwner && (
            <div className="setting-row">
              <div className="setting-row-main"><div className="setting-row-title">{t('删除空间')}</div><div className="setting-row-desc">{t('空间及其中的笔记、附件会被删除。此操作需要先下载备份。')}</div></div>
              <div className="setting-row-control"><button type="button" className="btn btn-danger-ghost btn-sm" onClick={() => setDeleteOpen(true)}><Trash2 size={13} /> {t('删除空间')}</button></div>
            </div>
          )}
        </section>
      )}

      <Modal
        open={Boolean(removeMember)}
        onClose={() => setRemoveMember(null)}
        title={t('移除成员？')}
        description={t('成员将立即失去访问权限。')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRemoveMember(null)}>{t('取消')}</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={confirmRemove}>{t('移除')}</button>
          </>
        }
      >
        <p style={{ fontSize: 13 }}>{removeMember?.displayName} · {removeMember?.email}</p>
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={t('删除空间？')}
        description={t('此操作会删除空间及其内容。请确保已经下载备份。')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteOpen(false)}>{t('取消')}</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={deleteWorkspace}><Trash2 size={13} /> {t('删除空间')}</button>
          </>
        }
      >
        <p style={{ fontSize: 13 }}>{workspace?.name}</p>
      </Modal>

      <Modal
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        title={t('离开空间？')}
        description={t('你将失去访问权限，但不会删除其他成员的内容。')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLeaveOpen(false)}>{t('取消')}</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={leaveWorkspace}>{t('离开')}</button>
          </>
        }
      >
        <p style={{ fontSize: 13 }}>{workspace?.name}</p>
      </Modal>
    </>
  );
}

function roleLabel(t: ReturnType<typeof useT>, role: string): string {
  if (role === 'owner') return t('所有者');
  if (role === 'admin') return t('管理员');
  if (role === 'editor') return t('编辑者');
  if (role === 'viewer') return t('查看者');
  return role;
}

function actionLabel(t: ReturnType<typeof useT>, action: string): string {
  const labels: Record<string, string> = {
    'workspace.create': '创建工作区',
    'workspace.rename': '重命名工作区',
    'workspace.delete': '删除工作区',
    'workspace.export': '导出工作区',
    'member.invite': '邀请成员',
    'member.role': '修改成员角色',
    'member.remove': '移除成员',
    'invitation.accept': '接受邀请',
    'note.create': '创建笔记',
    'note.empty_trash': '清空回收站',
    'note.version.restore': '恢复历史版本',
    'share.create': '创建分享链接',
    'share.update': '更新分享链接',
    'share.revoke': '撤销分享链接',
    'backup.create': '创建备份',
    'backup.restore': '恢复备份',
    'backup.download': '下载备份',
    'backup.delete': '删除备份',
    'api_token.create': '创建 API 令牌',
    'api_token.revoke': '撤销 API 令牌',
    'admin.settings.update': '更新实例设置',
    'auth.login': '登录',
    'auth.login.2fa': '两步验证登录',
    'auth.logout': '退出登录',
    'auth.session.revoke': '撤销会话',
    'auth.password.change': '修改密码',
    'auth.2fa.enable': '开启两步验证',
    'auth.2fa.disable': '关闭两步验证',
    'auth.recovery_key.rotate': '更新恢复密钥',
    'account.delete': '注销账户',
    'account.profile.update': '更新个人资料',
    'comment.delete': '删除评论',
  };
  return labels[action] ? t(labels[action]) : action;
}
