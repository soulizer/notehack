import { describe, expect, it } from 'vitest';
import { currentStep, generateTotpSecret, totpCode, verifyTotp } from './totp.js';

describe('totp', () => {
  it('generates a base32 secret and verifies its current code once', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    const code = totpCode(secret);
    expect(verifyTotp(secret, code).valid).toBe(true);
    expect(verifyTotp(secret, code === '000000' ? '000001' : '000000').valid).toBe(false);
    expect(currentStep()).toBeGreaterThan(0);
    expect(verifyTotp(secret, 'abcdef').valid).toBe(false);
  });
});
