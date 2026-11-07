# Security policy

## Reporting

Do not open a public issue for a vulnerability involving user data, authentication, sharing, or backups. Contact the instance administrator through a private channel and include:
- affected version/URL,
- reproduction steps,
- impact,
- whether data was accessed.

This project does not use email; there is no security@ mailbox. Use the repository owner's private contact or the instance's in-app administrator channel.

## Scope

- authentication/session/2FA/recovery keys
- workspace permissions and share links
- attachment upload/read and path traversal
- backup/restore and data deletion
- XSS/CSRF/CSP
- rate limiting/abuse
- AI data handling

## Known stance

- v0.1 does **not** provide E2EE; the server can read note bodies for search/share/backup.
- Attachments and backups are AES-256-GCM encrypted at rest.
- No emails are sent; recovery keys are the self-service recovery mechanism.
