import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  CloudOff,
  Download,
  FolderTree,
  LockKeyhole,
  MousePointerClick,
  Search,
  ShieldCheck,
  Sparkles,
  Tag,
  WifiOff,
  Zap,
} from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useT } from '../lib/i18n';
import { LogoLockup } from '../components/Logo';

export default function LandingPage() {
  const t = useT();
  const status = useAuthStore((state) => state.status);
  const primaryTo = status === 'authenticated' ? '/app' : '/register';
  const primaryLabel = status === 'authenticated' ? t('打开 NoteHack') : t('免费开始');

  return (
    <div className="marketing">
      <section className="marketing-hero">
        <nav className="marketing-nav">
          <Link to="/" aria-label="NoteHack">
            <LogoLockup inverse />
          </Link>
          <div className="marketing-nav-links">
            <a className="marketing-nav-link" href="#principles">{t('设计原则')}</a>
            <a className="marketing-nav-link" href="#features">{t('功能')}</a>
            <a className="marketing-nav-link" href="#security">{t('安全与数据')}</a>
          </div>
          <div className="marketing-nav-actions">
            {status !== 'authenticated' && (
              <Link to="/login" className="btn btn-ghost btn-sm marketing-login">
                {t('登录')}
              </Link>
            )}
            <Link to={primaryTo} className="btn btn-primary btn-sm">
              {primaryLabel}
              <ArrowRight size={14} />
            </Link>
          </div>
        </nav>

        <div className="hero">
          <div className="hero-copy">
            <div className="hero-eyebrow">
              <span className="dot" />
              {t('一个安静、快速、属于你的笔记空间')}
            </div>
            <h1 className="hero-title">
              {t('把想法留下，')}
              <br />
              <em>{t('把知识连起来。')}</em>
            </h1>
            <p className="hero-desc">
              {t(
                'NoteHack 把记录、整理、排版与分享放在同一条路径上。Markdown 为底，自动保存，离线可写，冲突保留副本。没有弹窗，也没有把数据锁住的花招。',
              )}
            </p>
            <div className="hero-actions">
              <Link to={primaryTo} className="hero-cta">
                {primaryLabel}
                <ArrowRight size={15} />
              </Link>
              <a href="#principles" className="hero-cta-ghost">
                {t('了解设计')}
                <span style={{ opacity: 0.5 }}>↓</span>
              </a>
            </div>
            <div className="hero-trust">
              <span><Check size={12} /> {t('无需信用卡')}</span>
              <span><WifiOff size={12} /> {t('离线可写')}</span>
              <span><Download size={12} /> {t('数据可导出')}</span>
            </div>
          </div>

          <div className="hero-stage">
            <div className="hero-glow" />
            <div className="app-mock" aria-hidden="true">
              <div className="mock-sidebar">
                <div className="mock-logo" />
                <div className="mock-nav active" />
                <div className="mock-nav" />
                <div className="mock-nav short" />
                <div className="mock-nav" />
                <div className="mock-spacer" />
                <div className="mock-nav short" />
              </div>
              <div className="mock-list">
                <div className="mock-search" />
                <div className="mock-list-title" />
                <div className="mock-item active">
                  <div className="mock-item-title" />
                  <div className="mock-item-line" />
                  <div className="mock-item-line short" />
                </div>
                <div className="mock-item">
                  <div className="mock-item-title" style={{ width: '58%' }} />
                  <div className="mock-item-line" />
                  <div className="mock-item-line short" />
                </div>
                <div className="mock-item">
                  <div className="mock-item-title" style={{ width: '82%' }} />
                  <div className="mock-item-line" />
                  <div className="mock-item-line short" />
                </div>
                <div className="mock-item">
                  <div className="mock-item-title" style={{ width: '63%' }} />
                  <div className="mock-item-line" />
                </div>
              </div>
              <div className="mock-editor">
                <div className="mock-editor-meta">
                  <span /><span style={{ width: 22 }} /><span style={{ width: 14 }} />
                </div>
                <div className="mock-title" />
                <div className="mock-sub" />
                <div className="mock-para" />
                <div className="mock-para w80" />
                <div className="mock-para w62" />
                <div className="mock-para blue" style={{ width: '45%' }} />
                <div className="mock-heading" />
                <div className="mock-para" />
                <div className="mock-para w80" />
                <div className="mock-image" />
                <div className="mock-para w62" />
                <span className="mock-cursor" />
              </div>
            </div>
            <div className="hero-float-card hero-float-1">
              <CloudOff size={15} />
              <span><strong>{t('离线可用')}</strong> · {t('联网自动合并')}</span>
            </div>
            <div className="hero-float-card hero-float-2">
              <ShieldCheck size={15} />
              <span><strong>{t('安全')}</strong> · TLS + 2FA</span>
            </div>
          </div>
        </div>
      </section>

      <section id="principles" className="marketing-section">
        <div className="marketing-section-head">
          <div className="section-kicker">{t('设计原则')}</div>
          <h2 className="section-title">{t('一屏一个主任务。')}</h2>
          <p className="section-desc">
            {t(
              '我们从 Trilium、Joplin、Standard Notes、SilverBullet、Memos、Blinko、Flatnotes、NoteDiscovery 和 Livebook 的经验出发，但没有把它们的界面拼在一起。NoteHack 只有一种节奏。',
            )}
          </p>
        </div>
        <div className="principles-grid">
          <article className="principle">
            <div className="principle-num">01</div>
            <div className="principle-title">{t('默认简单，渐进披露')}</div>
            <p className="principle-text">
              {t(
                '新用户只需要学会记录、搜索、看到同步状态。分享、版本、导出放在选中笔记之后；备份、恢复、安全放在设置里，也能通过命令面板随时找到。',
              )}
            </p>
          </article>
          <article className="principle">
            <div className="principle-num">02</div>
            <div className="principle-title">{t('写作时，世界退后')}</div>
            <p className="principle-text">
              {t(
                '编辑时隐藏管理操作，管理时弱化编辑控件。没有常驻的进度条、徽章和推销弹窗。只有文字、留白和必要的状态。',
              )}
            </p>
          </article>
          <article className="principle">
            <div className="principle-num">03</div>
            <div className="principle-title">{t('不把你锁在里面')}</div>
            <p className="principle-text">
              {t(
                '正文是 Markdown。附件可以单独下载。全库可以导出为可重建的 Markdown + 附件目录。同步不是备份，备份也可以随时下载。',
              )}
            </p>
          </article>
        </div>
      </section>

      <section id="features" className="marketing-section marketing-section-tight">
        <div className="marketing-section-head">
          <div className="section-kicker">{t('功能')}</div>
          <h2 className="section-title">{t('一个完整的写作空间')}</h2>
          <p className="section-desc">
            {t('从快速记录到长篇排版，从个人知识库到团队分享，保持同一种安静的节奏。')}
          </p>
        </div>
        <div className="feature-grid">
          <article className="feature-card">
            <div className="feature-icon"><Zap size={16} /></div>
            <div className="feature-title">{t('记录不打断思路')}</div>
            <p className="feature-text">
              {t('自动保存、离线草稿、快速捕获与网页剪藏。想法出现的那一刻，就能落下来。')}
            </p>
          </article>
          <article className="feature-card">
            <div className="feature-icon"><FolderTree size={16} /></div>
            <div className="feature-title">{t('整理不制造负担')}</div>
            <p className="feature-text">
              {t('文件夹给结构，标签给关联，双向链接让知识自己长出来。还有收藏、置顶和回收站。')}
            </p>
          </article>
          <article className="feature-card">
            <div className="feature-icon"><Search size={16} /></div>
            <div className="feature-title">{t('找得回来')}</div>
            <p className="feature-text">
              {t('一个入口搜索标题、正文、标签、附件名和 OCR 文本。结果带上下文片段，键盘上下即可打开。')}
            </p>
          </article>
          <article className="feature-card">
            <div className="feature-icon"><LockKeyhole size={16} /></div>
            <div className="feature-title">{t('安全不牺牲自由')}</div>
            <p className="feature-text">
              {t('TLS、附件加密存储、两步验证、登录设备管理、恢复密钥与可下载备份。')}
            </p>
          </article>
          <article className="feature-card">
            <div className="feature-icon"><Sparkles size={16} /></div>
            <div className="feature-title">{t('排版，不止是文字')}</div>
            <p className="feature-text">
              {t('表格、代码块、任务列表、图片附件、数学与高亮。Markdown 源码模式随时切换。')}
            </p>
          </article>
          <article className="feature-card">
            <div className="feature-icon"><MousePointerClick size={16} /></div>
            <div className="feature-title">{t('分享，有边界')}</div>
            <p className="feature-text">
              {t('只读、可评论或可编辑的分享链接，支持密码和过期时间。评论与版本历史不缺席。')}
            </p>
          </article>
        </div>
      </section>

      <section className="marketing-quote">
        <div className="marketing-quote-inner">
          <blockquote>
            {t('“最好的笔记工具，是你忘记它存在、却一直在用的工具。”')}
            <br />
            <em>{t('我们把它做成一张安静的书桌。')}</em>
          </blockquote>
          <p>{t('NoteHack 设计原则')}</p>
        </div>
      </section>

      <section id="security" className="marketing-section">
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.15fr)', gap: 48, alignItems: 'center' }} className="security-grid">
          <div>
            <div className="section-kicker">{t('安全与数据')}</div>
            <h2 className="section-title" style={{ fontSize: 38 }}>{t('你的数据属于你')}</h2>
            <p className="section-desc">
              {t('不发送营销邮件，不使用第三方分析，不把笔记用于训练 AI。低频但重要的安全操作都能在设置中找到，也能通过命令面板直达。')}
            </p>
            <div className="hero-trust" style={{ color: 'var(--text-tertiary)', marginTop: 22 }}>
              <span><ShieldCheck size={13} /> TLS + AES-256-GCM</span>
              <span><Download size={13} /> {t('可下载备份')}</span>
              <span><WifiOff size={13} /> {t('离线优先')}</span>
            </div>
          </div>
          <div className="principles-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <article className="principle" style={{ minHeight: 0, padding: '24px 22px' }}>
              <ShieldCheck size={18} style={{ color: 'var(--green)', marginBottom: 16 }} />
              <div className="principle-title">{t('两步验证')}</div>
              <p className="principle-text">{t('TOTP 与备用码，登录设备列表可随时撤销。')}</p>
            </article>
            <article className="principle" style={{ minHeight: 0, padding: '24px 22px' }}>
              <LockKeyhole size={18} style={{ color: 'var(--blue)', marginBottom: 16 }} />
              <div className="principle-title">{t('附件加密')}</div>
              <p className="principle-text">{t('服务器端的附件以 AES-256-GCM 加密存储。')}</p>
            </article>
            <article className="principle" style={{ minHeight: 0, padding: '24px 22px' }}>
              <Download size={18} style={{ color: 'var(--violet)', marginBottom: 16 }} />
              <div className="principle-title">{t('独立备份')}</div>
              <p className="principle-text">{t('自动备份与同步分离，可下载、可预览、可恢复。')}</p>
            </article>
            <article className="principle" style={{ minHeight: 0, padding: '24px 22px' }}>
              <Tag size={18} style={{ color: 'var(--amber)', marginBottom: 16 }} />
              <div className="principle-title">{t('可携带')}</div>
              <p className="principle-text">{t('Markdown、HTML、JSON、CSV，随时导出重建。')}</p>
            </article>
          </div>
        </div>
      </section>

      <section className="marketing-cta-band">
        <h2>{t('现在开始，写下第一行。')}</h2>
        <p>{t('注册后会自动生成一份简短的欢迎笔记。没有向导，没有填表。')}</p>
        <Link to={primaryTo} className="btn btn-primary btn-lg">
          {primaryLabel}
          <ArrowRight size={15} />
        </Link>
      </section>

      <footer className="marketing-footer">
        <div className="marketing-footer-inner">
          <LogoLockup />
          <span>© {new Date().getFullYear()} NoteHack</span>
          <div className="marketing-footer-links">
            <Link to="/privacy">{t('隐私')}</Link>
            <Link to="/terms">{t('条款')}</Link>
            <a href="#principles">{t('设计原则')}</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
