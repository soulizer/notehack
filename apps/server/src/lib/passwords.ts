import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>;

const N = 32768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const derived = await scryptAsync(password.normalize('NFKC'), salt, KEY_LENGTH, {
    N,
    r: R,
    p: P,
    maxmem: 128 * 1024 * 1024,
  });
  return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${derived.toString('base64')}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, n, r, p, saltB64, expectedB64] = parts;
  try {
    const expected = Buffer.from(expectedB64, 'base64');
    const derived = await scryptAsync(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * 1024 * 1024,
    });
    return expected.length === derived.length && crypto.timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
}

export function passwordIssues(password: string, email?: string): string[] {
  const issues: string[] = [];
  if (password.length < 10) issues.push('密码至少需要 10 个字符');
  if (password.length > 200) issues.push('密码不能超过 200 个字符');
  if (/^\d+$/.test(password)) issues.push('密码不能全是数字');
  if (email && password.toLowerCase().includes(email.split('@')[0].toLowerCase())) {
    issues.push('密码不能包含邮箱地址');
  }
  return issues;
}

export function passwordStrength(password: string): number {
  let score = 0;
  if (password.length >= 10) score += 30;
  if (password.length >= 14) score += 15;
  if (password.length >= 20) score += 10;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 15;
  if (/\d/.test(password)) score += 10;
  if (/[^A-Za-z0-9]/.test(password)) score += 15;
  if (/(.)\1{2,}/.test(password)) score -= 15;
  return Math.max(0, Math.min(100, score));
}
