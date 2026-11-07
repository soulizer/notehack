# ADR-002: Markdown is the only editable truth; title is separate

- Status: accepted
- Date: 2026-11-07

## Context

Rich HTML is more expressive but poor for portability/diff; Markdown is readable and exportable but weaker for rich layout. Some apps store both HTML and Markdown, creating two truths. Reference projects diverge: Trilium uses HTML, Joplin/SilverBullet use Markdown, Standard Notes uses item types.

## Decision

Store Markdown (`content_md`) as the canonical content. Use TipTap for WYSIWYG and convert HTML→Markdown on save. Store the title in a separate `title` column. Strip a leading H1 that exactly duplicates the title on create/update, client load, share rendering, HTML/PDF export. Export Markdown with YAML frontmatter (including title).

## Consequences

- Portable, diffable, easy to export/import; PDF/HTML are projections.
- Some rich formatting (underline/highlight) is represented as inline HTML; tables/task lists use GFM.
- Title and body cannot drift into duplicate H1; older notes are normalized on next save or display.
