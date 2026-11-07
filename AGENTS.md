# AGENTS.md — Working on NoteHack

You are working on NoteHack, a production note application at `notehack.com`. Read this before changing code. The server is dedicated to this project; still treat all data and credentials with care.

## First reads

1. `README.md`
2. `docs/DESIGN_SYSTEM.md` — UI changes must follow it
3. `docs/ARCHITECTURE.md` — data model, sync, security, backup
4. `docs/FEATURES.md` — priority/placement; do not add features without updating it
5. `docs/QUALITY.md` — tests, security checklist, release gates
6. `docs/MEMORY.md` — current state, known bugs, decisions
7. `docs/decisions/` — ADRs; do not silently reverse a decision

## Hard constraints

- **Never send email.** No SMTP, no email APIs, no verification/recovery/marketing email. Notifications are in-app only.
- **Do not pollute the domain.** No spam, no public pages for test content, no third-party analytics/ads.
- **Do not lose user data.** Before destructive changes: backup, preview, preserve a copy. Never silently overwrite notes.
- **Do not weaken auth/security** (CSRF, rate limits, password hashing, 2FA replay protection, share token hashing, path traversal checks, CSP).
- **Do not commit secrets** (`/etc/notehack/notehack.env`, `NOTEHACK_MASTER_KEY`, database passwords, admin recovery key, user data).
- **Do not claim E2EE.** Current version does not provide it; docs and UI must say the server can read note bodies.
- **Do not add a second visual language.** Use tokens/components in `apps/web/src/styles/`; update `DESIGN_SYSTEM.md` first if needed.
- **Do not cram every feature into the main screen.** High frequency → main path; medium → context/panel; low → settings; extremely low → command palette + wizard.

## Repo map

- `apps/server` — Fastify API, PostgreSQL migrations, services, routes.
- `apps/web` — React 19 + Vite PWA, TipTap, Zustand, IndexedDB.
- `packages/shared` — shared types/permissions.
- `docs` — the source of truth for design/features/quality/memory.
- `deploy` — systemd/nginx/env templates.
- `scripts` — manual/e2e/verification scripts (some are local test helpers).

## Development

```bash
npm install
cp deploy/notehack.env.example .env   # for dev, use local DB/origin
npm run dev
npm run typecheck
npm run build
```

- Dev origin can be `http://localhost:5173`; production `PUBLIC_ORIGIN=https://notehack.com`.
- After every web build, restart the API if you are testing against Fastify static (new hashed assets).
- Manual Playwright checks live in `tests/manual/`; they require `NH_TEST_EMAIL` / `NH_TEST_PASSWORD` (or `NH_ADMIN_*`) and a running server. Never run destructive backup/replace checks against production data.
- Migrations run at server start; add new numbered SQL files, never edit an applied migration.

## Before you finish

- [ ] Typecheck + build pass.
- [ ] Relevant e2e/manual checks done.
- [ ] Security-sensitive changes reviewed against `QUALITY.md`.
- [ ] Docs updated: `CHANGELOG.md`, `MEMORY.md`, and `FEATURES.md` if behavior changes.
- [ ] No test data/secrets left in the production database or repo.
- [ ] If deployment changed: update `OPERATIONS.md`, restart systemd, health check.
- [ ] If a decision changed: add/update an ADR.

## Production notes

- App: `/opt/notehack`; service `notehack.service`; env `/etc/notehack/notehack.env`; data `/var/lib/notehack`.
- Nginx terminates TLS; Node listens on `127.0.0.1:8787`.
- Health: `https://notehack.com/health`.
- Backups are encrypted at rest and downloadable; do not delete without a verified replacement.
- The first registered user is the instance admin. Do not create test users in production without permission and clean up afterward.
