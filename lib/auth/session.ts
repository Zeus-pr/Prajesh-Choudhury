/** Secure session-based auth (§7/§38): httpOnly, sameSite=lax, signed random tokens stored hashed server-side. */
import { cookies } from 'next/headers';
import { createHash, randomBytes } from 'crypto';

export const SESSION_COOKIE = 'taxos_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export async function setSessionCookie(token: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export function sessionExpiry() {
  return new Date(Date.now() + SESSION_TTL_MS);
}
