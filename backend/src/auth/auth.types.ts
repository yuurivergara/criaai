/**
 * Shape attached to `req.user` once the JWT guard authenticates a request.
 * Kept tiny on purpose — we only carry what controllers/services need to
 * scope queries. Anything else (name, email) gets fetched from DB on demand.
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
  }
}
