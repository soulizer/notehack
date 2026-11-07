# Contributing

NoteHack is a production note app. Before changing code, read `AGENTS.md` and the docs it references.

## Ground rules

- No email sending, no third-party analytics, no tracking.
- Do not silently overwrite notes or weaken authentication/security.
- Use the design system; do not introduce a second visual language.
- Add features to `docs/FEATURES.md` (priority, placement, frequency) before implementing.
- Update `docs/CHANGELOG.md` and `docs/MEMORY.md` for meaningful changes.
- Add an ADR for architecture/security decisions.
- Keep user data exportable; never create a proprietary-only format.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

## Pull requests

- Small, focused changes.
- Include tests when touching auth, sync/conflict, import/export, backup/restore, or permissions.
- Do not commit secrets, `.env`, backups, uploads, or user content.
- Never test destructive restore/delete operations against production.
