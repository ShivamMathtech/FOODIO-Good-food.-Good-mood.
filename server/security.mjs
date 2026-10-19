import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
export const token = () => randomBytes(32).toString('hex');
export const digest = (s) => createHash('sha256').update(s).digest('hex');
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [, salt, hex] = encoded.split(':');
  const expected = Buffer.from(hex, 'hex');
  const actual = await derive(password, salt, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export function sessionCookie(raw, secure, remove = false) {
  return `foodio_session=${raw}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${remove ? 0 : 604800}${secure ? '; Secure' : ''}`;
}
export function cookieToken(req) {
  const value = (req.headers.cookie || '')
    .split(';')
    .map((x) => x.trim())
    .find((x) => x.startsWith('foodio_session='));
  const raw = value?.slice(15);
  return raw && /^[a-f0-9]{64}$/.test(raw) ? raw : null;
}
