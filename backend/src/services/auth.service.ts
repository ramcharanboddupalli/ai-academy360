import { randomUUID } from 'node:crypto';
import jwt, { type SignOptions } from 'jsonwebtoken';
import type { AuthRole } from '../types/express.js';

export function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || /REPLACE|CHANGE_ME|YOUR_SECRET/i.test(secret)) return null;
  return secret;
}

export function createAccessToken(userId: number, role: AuthRole): { token: string; tokenId: string } {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error('JWT configuration is unavailable.');
  }

  const tokenId = randomUUID();
  const expiresIn = (process.env.JWT_EXPIRES_IN || '1d') as SignOptions['expiresIn'];
  const token = jwt.sign({ role }, secret, {
    subject: String(userId),
    jwtid: tokenId,
    expiresIn,
    algorithm: 'HS256',
  });

  return { token, tokenId };
}