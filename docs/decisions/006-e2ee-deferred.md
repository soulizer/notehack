# ADR-006: End-to-end encryption is not offered in v0.1

- Status: accepted (revisit)
- Date: 2026-11-07

## Context

E2EE is attractive for privacy but breaks or severely limits server-side full-text search, share rendering, AI summaries, backup-by-server, and password recovery. Reference projects (Standard Notes/Joplin/Trilium) show a proper E2EE design requires key hierarchy, per-item keys, client-side search/index, recovery, and explicit trade-offs. Shipping a half-implemented E2EE would be worse than none.

## Decision

Do not claim or implement E2EE in v0.1. The server can technically read note bodies for search/share/backup/import. Attachments and backups are AES-256-GCM encrypted at rest, which is not E2EE. The privacy policy and Security settings disclose this clearly. The recovery-key mechanism is real and independent of E2EE.

If implemented later: password → Argon2id → root key → items key → per-note key; XChaCha20-Poly1305 + AAD; client-side encrypted index; recovery key; explicitly disable server search/sharing/AI/password reset for encrypted notes; document recovery drills.

## Consequences

- Privacy-conscious users may reject the service; that is honest.
- No false security claims; simpler v1.
- The `users.enc_*` and `notes.encrypted` columns are reserved for future migration.
