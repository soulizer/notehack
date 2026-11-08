// Small, dependency-light text utilities used by search, exports and the API.

const MD_IMAGE = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const MD_LINK = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const MD_CODE = /```[\s\S]*?```/g;

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(MD_CODE, (block) => block.replace(/```\w*/g, ''))
    .replace(MD_IMAGE, '$1')
    .replace(MD_LINK, '$1')
    .replace(/^[ \t|:-]{3,}$/gm, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[(?:x| )\]\s*/gi, '')
    .replace(/[*_~`>#|]/g, '')
    .replace(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Remove a leading H1 that duplicates the note's title field. */
export function stripTitleHeading(markdown: string, title: string): string {
  const cleanTitle = title.trim();
  if (!cleanTitle) return markdown;
  const escaped = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\s*#\\s+${escaped}\\s*(?:\\r?\\n)+`, 'i');
  return markdown.replace(pattern, '').replace(/^\s*\n+/, '');
}

export function excerpt(markdown: string, max = 220): string {
  // Keep excerpts clean even for legacy notes whose content was accidentally
  // stored as HTML by older rich-text saves. Strip tags before the Markdown
  // cleaner removes '>', otherwise malformed HTML attributes leak through.
  const text = markdownToPlainText(markdown.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export function wordCount(markdown: string): number {
  const text = markdownToPlainText(markdown);
  const cjk = (text.match(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length;
  const words = text
    .replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + words;
}

export function extractWikiLinks(markdown: string): string[] {
  const links = new Set<string>();
  const regex = /\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown))) {
    const title = match[1].trim();
    if (title) links.add(title);
  }
  return [...links];
}

export function snippetFor(markdown: string, q: string, radius = 90): string | null {
  if (!q) return null;
  const text = markdownToPlainText(markdown);
  const haystack = text.toLowerCase();
  const needle = q.toLowerCase().trim();
  if (!needle) return null;
  let index = haystack.indexOf(needle);
  if (index === -1) {
    // For CJK queries, Postgres ILIKE can match across punctuation stripped above.
    const compact = text.replace(/\s+/g, '');
    const compactIndex = compact.toLowerCase().indexOf(needle.replace(/\s+/g, ''));
    if (compactIndex === -1) return null;
    index = Math.max(0, compactIndex - radius);
    return compact.slice(index, compactIndex + needle.length + radius);
  }
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + needle.length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ')}${end < text.length ? '…' : ''}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function titleFromMarkdown(markdown: string): string {
  const heading = markdown.match(/^#\s+(.+)$/m);
  if (heading) return heading[1].trim();
  const firstLine = markdown
    .replace(/^---[\s\S]*?---\s*/, '')
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('```'));
  return firstLine ? firstLine.replace(/^[#>*+-]\s*/, '').slice(0, 120) : '未命名笔记';
}

export function isoDate(value: Date | string): string {
  return new Date(value).toISOString();
}
