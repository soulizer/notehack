import { useState } from 'react';
import { Copy, Cpu, LockKeyhole, Sparkles, Wand2 } from 'lucide-react';
import type { Note } from '@notehack/shared';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useT } from '../../lib/i18n';
import { copyText } from '../../lib/utils';
import { renderMarkdown } from '../../lib/markdown';
import { Modal } from '../Modal';
import { toast } from '../../stores/toast';

export function SummaryDialog({
  note,
  open,
  onClose,
  onInsert,
}: {
  note: Note;
  open: boolean;
  onClose: () => void;
  onInsert: (summary: string) => void;
}) {
  const t = useT();
  const instance = useAuthStore((state) => state.instance);
  const [summary, setSummary] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState<'local' | 'ai' | null>(null);

  async function generate(kind: 'local' | 'ai') {
    setLoading(kind);
    setSummary(null);
    try {
      const response = await api.post<{ summary: string; provider: string; warning?: string }>(
        kind === 'ai' ? '/api/ai/summarize' : '/api/ai/local-summary',
        { noteId: note.id },
      );
      setSummary(response.summary);
      setProvider(response.provider);
      setWarning(response.warning ?? null);
    } catch (error) {
      toast('error', t('生成摘要失败'), (error as Error).message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('生成摘要')}
      description={t('摘要是按需生成的，不会在后台自动运行。')}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>{t('关闭')}</button>
          {summary && (
            <>
              <button type="button" className="btn btn-secondary btn-sm" onClick={async () => { await copyText(summary); toast('success', t('已复制')); }}>
                <Copy size={13} /> {t('复制')}
              </button>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => { onInsert(summary); onClose(); }}>
                <Wand2 size={13} /> {t('插入到笔记')}
              </button>
            </>
          )}
        </>
      }
    >
      {!summary ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <button type="button" className="share-permission-option" onClick={() => void generate('local')} disabled={Boolean(loading)} style={{ textAlign: 'left' }}>
            <Cpu size={18} style={{ color: 'var(--text-secondary)', marginTop: 1 }} />
            <span>
              <span className="share-permission-name">{t('本地摘要')}</span>
              <span className="share-permission-desc">{t('完全在服务器内部提取关键段落，不发送给任何第三方。')}</span>
            </span>
          </button>
          <button
            type="button"
            className="share-permission-option"
            onClick={() => void generate('ai')}
            disabled={Boolean(loading) || !instance?.aiEnabled}
            style={{ textAlign: 'left', opacity: instance?.aiEnabled ? 1 : 0.55 }}
          >
            <Sparkles size={18} style={{ color: 'var(--blue)', marginTop: 1 }} />
            <span>
              <span className="share-permission-name">{t('AI 摘要')}</span>
              <span className="share-permission-desc">
                {instance?.aiEnabled
                  ? t('将把这篇笔记发送到实例管理员配置的 AI 服务。只有在你点击后才会发送。')
                  : t('实例管理员尚未启用 AI。你仍然可以使用本地摘要。')}
              </span>
            </span>
          </button>
          <div className="banner banner-info" style={{ marginTop: 6 }}>
            <LockKeyhole size={14} />
            <div>{t('AI 服务不会接收你的其他笔记。NoteHack 不使用你的内容训练模型。')}</div>
          </div>
          {loading && (
            <div className="loading-row">
              <span className="spinner" />
              {loading === 'ai' ? t('AI 正在阅读这篇笔记…') : t('正在提取关键内容…')}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="banner banner-info" style={{ marginBottom: 14 }}>
            <Sparkles size={14} />
            <div>{provider} · {warning ?? t('摘要由你主动触发。')}</div>
          </div>
          <div className="prose" style={{ fontSize: 14 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(summary).html }} />
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={() => setSummary(null)}>
            {t('重新生成')}
          </button>
        </div>
      )}
    </Modal>
  );
}
