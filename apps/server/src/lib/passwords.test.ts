import { describe, expect, it } from 'vitest';
import { hashPassword, passwordIssues, verifyPassword } from './passwords.js';

describe('passwords', () => {
  it('hashes and verifies without storing plaintext', async () => {
    const hash = await hashPassword('correct horse battery staple');
    expect(hash).not.toContain('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('rejects short and email-derived passwords', () => {
    expect(passwordIssues('short')).not.toHaveLength(0);
    expect(passwordIssues('1234567890')).not.toHaveLength(0);
    expect(passwordIssues('myname-is-safe-2026', 'myname@example.com')).not.toHaveLength(0);
  });
});
