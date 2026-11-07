# Manual / E2E checks

These scripts are for development and release verification, not production automation. They create data and some perform destructive tests.

Requirements:
- a running NoteHack (default `https://notehack.com`, override `NH_BASE_URL`; many scripts still contain localhost URLs for dev)
- Playwright Chromium installed (`npx playwright install chromium`)
- credentials via environment:
  - `NH_TEST_EMAIL`, `NH_TEST_PASSWORD` for a dev/demo user
  - or `NH_ADMIN_EMAIL`, `NH_ADMIN_PASSWORD` for an admin-only check

Examples:

```bash
NH_TEST_EMAIL=test@example.com NH_TEST_PASSWORD=... node tests/manual/e2e-smoke.mjs
NH_ADMIN_EMAIL=admin@notehack.com NH_ADMIN_PASSWORD=... node tests/manual/prod-smoke.mjs
```

Do **not** run `backup-test`, `ui-qa`, or destructive scripts against a production instance unless you understand the cleanup steps. Some early scripts still target `http://127.0.0.1:8787`; set them up for local testing first or adjust with `NH_BASE_URL` where supported.
