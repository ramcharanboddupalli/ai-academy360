import type { RequestHandler } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import type { RowDataPacket } from 'mysql2';
import { getDatabasePool } from '../config/database.js';
import { getJwtSecret } from '../services/auth.service.js';
import type { AuthRole } from '../types/express.js';

function sendUnauthorized(res: Parameters<RequestHandler>[1], message = 'Authentication required.') {
  return res.status(401).json({ success: false, message });
}

export const authenticateToken: RequestHandler = async (req, res, next) => {
  const authorization = req.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return sendUnauthorized(res);

  const secret = getJwtSecret();
  if (!secret) {
    return res.status(503).json({ success: false, message: 'Authentication is not configured.' });
  }

  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as JwtPayload;
    const userId = Number(payload.sub);
    const role = payload.role;
    const tokenId = payload.jti;
    const expiresAt = payload.exp;
    if (!Number.isSafeInteger(userId) || (role !== 'ADMIN' && role !== 'STUDENT') || !tokenId || !expiresAt) {
      return sendUnauthorized(res, 'Invalid or expired token.');
    }

    const [accounts] = await getDatabasePool().execute<RowDataPacket[]>(
      `SELECT u.role, u.is_active AS isActive, r.token_id AS revokedToken
       FROM users u
       LEFT JOIN token_revocations r ON r.token_id = ? AND r.expires_at > CURRENT_TIMESTAMP
       WHERE u.id = ? LIMIT 1`,
      [tokenId, userId],
    );
    const account = accounts[0];
    if (!account || !account.isActive || account.role !== role || account.revokedToken) {
      return sendUnauthorized(res, 'Invalid or expired token.');
    }

    req.authUser = { id: userId, role: role as AuthRole, tokenId, expiresAt };
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.TokenExpiredError) {
      return sendUnauthorized(res, 'Invalid or expired token.');
    }
    if (error instanceof Error && error.name === 'DatabaseConfigurationError') {
      return res.status(503).json({ success: false, message: 'Database is not configured.' });
    }
    return res.status(503).json({ success: false, message: 'Authentication service is unavailable.' });
  }
};

function requireRole(role: AuthRole): RequestHandler {
  return (req, res, next) => {
    if (!req.authUser) return sendUnauthorized(res);
    if (req.authUser.role !== role) {
      return res.status(403).json({ success: false, message: 'You are not authorized to access this resource.' });
    }
    next();
  };
}

export const requireAdmin = requireRole('ADMIN');
export const requireStudent = requireRole('STUDENT');