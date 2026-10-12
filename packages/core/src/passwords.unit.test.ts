import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './passwords.js';

describe('password hashes', () => {
  it('stores scrypt output and not the password', async () => {
    const password = 'correct-horse-battery';
    const stored = await hashPassword(password);
    expect(stored.startsWith('scrypt$16384$8$1$')).toBe(true);
    expect(stored).not.toContain(password);
    expect(await verifyPassword(password, stored)).toBe(true);
    expect(await verifyPassword('wrong-password', stored)).toBe(false);
    expect(await verifyPassword(password, 'plain-text')).toBe(false);
  });
});
