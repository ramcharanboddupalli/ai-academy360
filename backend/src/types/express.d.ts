export type AuthRole = 'ADMIN' | 'STUDENT';

export interface AuthenticatedIdentity {
  id: number;
  role: AuthRole;
  tokenId: string;
  expiresAt: number;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthenticatedIdentity;
    }
  }
}