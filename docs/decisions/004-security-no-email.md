# ADR-004: Security baseline and no outbound email

- Status: accepted
- Date: 2026-11-07

## Context

The product must not send any email or pollute domain reputation. Reference projects use email for verification/recovery/notifications; NoteHack cannot. Security must still be credible for a public multi-user service.

## Decision

- scrypt password hashing; HttpOnly/Secure/SameSite cookies; CSRF custom header; rate limits.
- TOTP 2FA + one-time backup codes + replay protection; session/device management; new-device notifications in-app.
- Recovery key generated once, stored hashed; password reset with recovery key; resets 2FA and all sessions.
- Email is only a login identifier; no verification, no marketing, no password-reset email. Invitations are links + in-app notifications.
- Attachments and backups use AES-256-GCM at rest; TLS terminates at Nginx.
- No third-party analytics.
- Audit logs for security/data operations.

## Consequences

- Users must save the recovery key; losing it may make the account unrecoverable.
- No email verification → rate limits and strong passwords are essential; deployment may choose invite-only registration.
- All notifications stay in-app, so users must log in to see them.
