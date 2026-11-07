import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Clock3,
  FolderClosed,
  FolderOpen,
  FolderPlus,
  Hash,
  LogOut,
  MoreHorizontal,
  PanelLeftClose,
  Plus,
  Settings,
  Star,
  Tag as TagIcon,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import type { Folder, Tag } from '@notehack/shared';
import { useAppStore, type NoteFilter } from '../stores/app';
import { useAuthStore } from '../stores/auth';
import { useT } from '../lib/i18n';
import { cn } from '../lib/utils';
import { Avatar } from './Avatar';
import { LogoLockup } from './Logo';
import { Dropdown, MenuItem } from './Dropdown';
import { Modal } from './Modal';
import { NotificationCenter } from './NotificationCenter';
import { api } from '../lib/api';
import { toast } from '../stores/toast';

export function Sidebar() {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const workspaces = useAuthStore((state) => state.workspaces);
  const logout = useAuthStore((state) => state.logout);
  const setWorkspaces = useAuthStore((state) => state.setWorkspaces);
  const workspaceId = useAppStore((state) => state.workspaceId);
  const folders = useAppStore((state) => state.folders);
  const tags = useAppStore((state) => state.tags);
  const total = useAppStore((state) => state.total);
  const filter = useAppStore((state) => state.filter);
  const folderId = useAppStore((state) => state.folderId);
  const tagId = useAppStore((state) => state.tagId);
  const pendingCount = useAppStore((state) => state.pendingCount);
  const syncState = useAppStore((state) => state.syncState);
  const offline = useAppStore((state) => state.offline);
  const collapsed = useAppStore((state) => state.sidebarCollapsed);
  const mobileOpen = useAppStore((state) => state.sidebarMobileOpen);
  const toggleSidebar = useAppStore((state) => state.toggleSidebar);
  const setMobileSidebar = useAppStore((state) => state.setMobileSidebar);
  const setFilter = useAppStore((state) => state.setFilter);
  const initialize = useAppStore((state) => state.initialize);
  const createNote = useAppStore((state) => state.createNote);
  const refreshFolders = useAppStore((state) => state.refreshFolders);
  const refreshTags = useAppStore((state) => state.refreshTags);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [folderModal, setFolderModal] = useState<{ mode: 'create' | 'rename'; folder?: Folder } | null>(null);
  const [tagModal, setTagModal] = useState<{ mode: 'create' | 'rename'; tag?: Tag } | null>(null);
  const [deleteNode, setDeleteNode] = useState<{ kind: 'folder' | 'tag'; id: string; name: string } | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const currentWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
  const settingsActive = location.pathname.startsWith('/app/settings');

  useEffect(() => {
    const roots = folders.filter((folder) => folder.parentId === null).map((folder) => folder.id);
    setExpanded((current) => {
      if (current.size) return current;
      return new Set(roots);
    });
  }, [folders]);

  function closeMobile() {
    setMobileSidebar(false);
  }

  async function selectFilter(next: NoteFilter, opts?: { folderId?: string | null; tagId?: string | null }) {
    navigate('/app');
    await setFilter(next, opts);
    closeMobile();
  }

  async function switchWorkspace(id: string) {
    if (id === workspaceId) return;
    localStorage.setItem('nh-workspace', id);
    await initialize(id);
    navigate('/app');
    closeMobile();
  }

  async function newNote() {
    const note = await createNote();
    if (note) navigate(`/app/note/${note.id}`);
    closeMobile();
  }

  async function submitName(event: FormEvent) {
    event.preventDefault();
    if (!workspaceId || !name.trim()) return;
    setBusy(true);
    try {
      if (folderModal?.mode === 'create') {
        await api.post('/api/folders', { workspaceId, name: name.trim(), parentId: null });
      } else if (folderModal?.mode === 'rename' && folderModal.folder) {
        await api.patch(`/api/folders/${folderModal.folder.id}`, { name: name.trim() });
      } else if (tagModal?.mode === 'create') {
        await api.post('/api/tags', { workspaceId, name: name.trim() });
      } else if (tagModal?.mode === 'rename' && tagModal.tag) {
        await api.patch(`/api/tags/${tagModal.tag.id}`, { name: name.trim() });
      }
      await Promise.all([refreshFolders(), refreshTags()]);
      setFolderModal(null);
      setTagModal(null);
      setName('');
    } catch (error) {
      toast('error', t('保存失败'), (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteNode) return;
    setBusy(true);
    try {
      if (deleteNode.kind === 'folder') {
        await api.delete(`/api/folders/${deleteNode.id}`);
        if (filter === 'folder' && folderId === deleteNode.id) await setFilter('all');
      } else {
        await api.delete(`/api/tags/${deleteNode.id}`);
        if (filter === 'tag' && tagId === deleteNode.id) await setFilter('all');
      }
      await Promise.all([refreshFolders(), refreshTags()]);
      setDeleteNode(null);
    } catch (error) {
      toast('error', t('删除失败'), (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function renderFolders(parentId: string | null, depth = 0): ReactNode {
    return folders
      .filter((folder) => folder.parentId === parentId)
      .map((folder) => {
        const children = folders.filter((item) => item.parentId === folder.id);
        const isOpen = expanded.has(folder.id);
        return (
          <div key={folder.id} className={cn('tree-folder', isOpen && 'expanded')}>
            <div
              className={cn('tree-folder-row', filter === 'folder' && folderId === folder.id && 'active')}
              style={{ paddingLeft: 6 + depth * 9 }}
              onClick={() => {
                setExpanded((current) => {
                  const next = new Set(current);
                  if (next.has(folder.id)) next.delete(folder.id);
                  else next.add(folder.id);
                  return next;
                });
                void selectFilter('folder', { folderId: folder.id });
              }}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void selectFilter('folder', { folderId: folder.id });
              }}
            >
              <span className="tree-chevron">
                {children.length > 0 ? isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} /> : <span style={{ width: 12 }} />}
              </span>
              {isOpen ? <FolderOpen size={13} /> : <FolderClosed size={13} />}
              <span className="tree-folder-name">{folder.name}</span>
              {folder.noteCount ? <span className="tree-folder-count">{folder.noteCount}</span> : null}
              <Dropdown
                width={170}
                trigger={
                  <button type="button" className="sidebar-section-action" aria-label={t('更多操作')}>
                    <MoreHorizontal size={13} />
                  </button>
                }
              >
                {(close) => (
                  <>
                    <MenuItem
                      icon={<Plus size={14} />}
                      onClick={() => {
                        close();
                        setName('');
                        setFolderModal({ mode: 'create' });
                      }}
                    >
                      {t('新建文件夹')}
                    </MenuItem>
                    <MenuItem
                      icon={<FolderClosed size={14} />}
                      onClick={() => {
                        close();
                        setName(folder.name);
                        setFolderModal({ mode: 'rename', folder });
                      }}
                    >
                      {t('重命名')}
                    </MenuItem>
                    <div className="menu-separator" />
                    <MenuItem
                      danger
                      icon={<Trash2 size={14} />}
                      onClick={() => {
                        close();
                        setDeleteNode({ kind: 'folder', id: folder.id, name: folder.name });
                      }}
                    >
                      {t('删除文件夹')}
                    </MenuItem>
                  </>
                )}
              </Dropdown>
            </div>
            {isOpen && children.length > 0 && <div className="tree-children">{renderFolders(folder.id, depth + 1)}</div>}
          </div>
        );
      });
  }

  const statusLabel =
    offline || syncState === 'offline'
      ? pendingCount
        ? t('待同步', { n: pendingCount })
        : t('离线')
      : syncState === 'saving'
        ? t('保存中…')
        : syncState === 'error'
          ? t('同步失败')
          : t('已同步');

  return (
    <>
      {mobileOpen && <div className="sidebar-scrim" onClick={closeMobile} />}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <Link to="/app" aria-label="NoteHack" onClick={closeMobile}>
            <LogoLockup inverse />
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NotificationCenter />
            <button type="button" className="sidebar-collapse" onClick={toggleSidebar} aria-label={t('收起侧栏')}>
              <PanelLeftClose size={15} />
            </button>
            <button
              type="button"
              className="sidebar-collapse"
              onClick={closeMobile}
              aria-label={t('关闭侧栏')}
              style={{ display: mobileOpen ? 'grid' : 'none' }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <Dropdown
          width={238}
          align="start"
          trigger={
            <button type="button" className="workspace-switcher">
              <span className="workspace-mark">{currentWorkspace?.name?.slice(0, 1).toUpperCase() ?? 'N'}</span>
              <span className="workspace-meta">
                <span className="workspace-name">{currentWorkspace?.name ?? 'NoteHack'}</span>
                <span className="workspace-kind">
                  {currentWorkspace?.kind === 'team' ? t('团队空间') : t('个人空间')}
                </span>
              </span>
              <ChevronDown size={13} className="workspace-chevron" />
            </button>
          }
        >
          {(close) => (
            <>
              <div className="menu-label">{t('空间')}</div>
              {workspaces.map((workspace) => (
                <MenuItem
                  key={workspace.id}
                  icon={<span className="workspace-mark" style={{ width: 20, height: 20, borderRadius: 6, fontSize: 13 }}>{workspace.name.slice(0, 1)}</span>}
                  detail={workspace.id === workspaceId ? '✓' : undefined}
                  onClick={() => {
                    close();
                    void switchWorkspace(workspace.id);
                  }}
                >
                  {workspace.name}
                </MenuItem>
              ))}
              <div className="menu-separator" />
              <MenuItem
                icon={<Settings size={14} />}
                onClick={() => {
                  close();
                  navigate('/app/settings/team');
                }}
              >
                {t('管理空间')}
              </MenuItem>
              <MenuItem
                icon={<Plus size={14} />}
                onClick={() => {
                  close();
                  navigate('/app/settings/team?create=1');
                }}
              >
                {t('创建团队空间')}
              </MenuItem>
            </>
          )}
        </Dropdown>

        <div className="sidebar-nav">
          <button type="button" className={cn('nav-item', !settingsActive && filter === 'all' && 'active')} onClick={() => void selectFilter('all')}>
            <Archive size={15} />
            <span className="nav-label">{t('全部笔记')}</span>
            <span className="nav-count">{total}</span>
          </button>
          <button type="button" className={cn('nav-item', !settingsActive && filter === 'recent' && 'active')} onClick={() => void selectFilter('recent')}>
            <Clock3 size={15} />
            <span className="nav-label">{t('最近编辑')}</span>
          </button>
          <button type="button" className={cn('nav-item', !settingsActive && filter === 'favorites' && 'active')} onClick={() => void selectFilter('favorites')}>
            <Star size={15} />
            <span className="nav-label">{t('收藏')}</span>
          </button>
          <button type="button" className={cn('nav-item', !settingsActive && filter === 'trash' && 'active')} onClick={() => void selectFilter('trash')}>
            <Trash2 size={15} />
            <span className="nav-label">{t('回收站')}</span>
          </button>
        </div>

        <div className="sidebar-section" style={{ marginTop: 14 }}>
          <span className="sidebar-section-label">{t('文件夹')}</span>
          <button
            type="button"
            className="sidebar-section-action"
            onClick={() => {
              setName('');
              setFolderModal({ mode: 'create' });
            }}
            aria-label={t('新建文件夹')}
          >
            <FolderPlus size={13} />
          </button>
        </div>
        <div className="sidebar-tree">
          {folders.length ? (
            renderFolders(null)
          ) : (
            <div className="sidebar-empty">{t('用文件夹给笔记一个结构。')}</div>
          )}
        </div>

        <div className="sidebar-section">
          <span className="sidebar-section-label">{t('标签')}</span>
          <button
            type="button"
            className="sidebar-section-action"
            onClick={() => {
              setName('');
              setTagModal({ mode: 'create' });
            }}
            aria-label={t('新建标签')}
          >
            <Plus size={13} />
          </button>
        </div>
        <div style={{ maxHeight: '24vh', overflowY: 'auto', flex: 'none' }}>
          {tags.length ? (
            <div className="tag-list">
              {tags.slice(0, 30).map((tag) => (
                <div key={tag.id} style={{ display: 'flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={cn('tag-nav-item', !settingsActive && filter === 'tag' && tagId === tag.id && 'active')}
                    onClick={() => void selectFilter('tag', { tagId: tag.id })}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <span className="tag-dot" style={{ ['--tag-color' as string]: tag.color ?? 'var(--sidebar-muted)' }} />
                    <span>{tag.name}</span>
                    <span className="tag-count">{tag.noteCount ?? 0}</span>
                  </button>
                  <Dropdown
                    width={160}
                    trigger={
                      <button type="button" className="sidebar-section-action" aria-label={t('更多操作')}>
                        <MoreHorizontal size={12} />
                      </button>
                    }
                  >
                    {(close) => (
                      <>
                        <MenuItem
                          icon={<Hash size={14} />}
                          onClick={() => {
                            close();
                            setName(tag.name);
                            setTagModal({ mode: 'rename', tag });
                          }}
                        >
                          {t('重命名')}
                        </MenuItem>
                        <MenuItem
                          danger
                          icon={<Trash2 size={14} />}
                          onClick={() => {
                            close();
                            setDeleteNode({ kind: 'tag', id: tag.id, name: tag.name });
                          }}
                        >
                          {t('删除标签')}
                        </MenuItem>
                      </>
                    )}
                  </Dropdown>
                </div>
              ))}
            </div>
          ) : (
            <div className="sidebar-empty">{t('用标签连接不同文件夹中的想法。')}</div>
          )}
        </div>

        <div className="sidebar-footer" style={{ marginTop: 'auto' }}>
          <button
            type="button"
            className={cn('nav-item', settingsActive && 'active')}
            onClick={() => {
              navigate('/app/settings/account');
              closeMobile();
            }}
          >
            <Settings size={15} />
            <span className="nav-label">{t('设置')}</span>
          </button>
          <div className="sidebar-status">
            <span className={cn('sync-dot', syncState === 'saving' && 'saving', (offline || syncState === 'offline') && 'offline', syncState === 'error' && 'error')} />
            <span>{statusLabel}</span>
          </div>
          <Dropdown
            width={210}
            align="start"
            trigger={
              <button type="button" className="sidebar-user">
                <Avatar name={user?.displayName ?? 'N'} color={user?.avatarColor} size="sm" />
                <span className="sidebar-user-meta">
                  <span className="sidebar-user-name">{user?.displayName}</span>
                  <span className="sidebar-user-sub">{user?.email}</span>
                </span>
                <MoreHorizontal size={14} style={{ color: 'var(--sidebar-muted)' }} />
              </button>
            }
          >
            {(close) => (
              <>
                <MenuItem icon={<UserRound size={14} />} onClick={() => { close(); navigate('/app/settings/account'); }}>
                  {t('账户')}
                </MenuItem>
                <MenuItem icon={<Settings size={14} />} onClick={() => { close(); navigate('/app/settings/appearance'); }}>
                  {t('外观')}
                </MenuItem>
                <MenuItem icon={<TagIcon size={14} />} onClick={() => { close(); navigate('/app/settings/security'); }}>
                  {t('安全')}
                </MenuItem>
                <div className="menu-separator" />
                <MenuItem
                  danger
                  icon={<LogOut size={14} />}
                  onClick={async () => {
                    close();
                    await logout();
                    navigate('/login');
                  }}
                >
                  {t('退出登录')}
                </MenuItem>
              </>
            )}
          </Dropdown>
        </div>
      </aside>

      <Modal
        open={Boolean(folderModal || tagModal)}
        onClose={() => {
          setFolderModal(null);
          setTagModal(null);
        }}
        title={folderModal ? (folderModal.mode === 'create' ? t('新建文件夹') : t('重命名文件夹')) : tagModal?.mode === 'create' ? t('新建标签') : t('重命名标签')}
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setFolderModal(null); setTagModal(null); }}>
              {t('取消')}
            </button>
            <button type="submit" form="node-name-form" className="btn btn-primary btn-sm" disabled={busy || !name.trim()}>
              {busy && <span className="spinner" />} {t('保存')}
            </button>
          </>
        }
      >
        <form id="node-name-form" onSubmit={submitName}>
          <div className="field">
            <label>{folderModal ? t('文件夹名称') : t('标签名称')}</label>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus maxLength={80} />
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(deleteNode)}
        onClose={() => setDeleteNode(null)}
        title={deleteNode?.kind === 'folder' ? t('删除文件夹？') : t('删除标签？')}
        description={
          deleteNode?.kind === 'folder'
            ? t('文件夹中的笔记也会进入回收站。')
            : t('标签会从所有笔记上移除，笔记本身不会删除。')
        }
        size="sm"
        footer={
          <>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setDeleteNode(null)}>{t('取消')}</button>
            <button type="button" className="btn btn-danger btn-sm" onClick={confirmDelete} disabled={busy}>
              {busy && <span className="spinner" />} {t('删除')}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{deleteNode?.name}</p>
      </Modal>
    </>
  );
}
