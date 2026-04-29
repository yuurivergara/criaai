import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { AuthenticatedUser } from './auth.types';

/**
 * Bearer-token guard. Reads `Authorization: Bearer <jwt>` from the request,
 * verifies it with `JwtService` and attaches the decoded user payload to
 * `req.user` so `@CurrentUser()` can pick it up.
 *
 * Token payload shape (signed by AuthService):
 *   { sub: string, email: string, iat, exp }
 *
 * Anything missing/invalid → 401.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    const auth = req.headers.authorization;
    if (!auth || !auth.toLowerCase().startsWith('bearer ')) {
      throw new UnauthorizedException('Bearer token ausente');
    }
    const token = auth.slice('bearer '.length).trim();
    if (!token) {
      throw new UnauthorizedException('Bearer token vazio');
    }
    try {
      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        email: string;
      }>(token);
      const user: AuthenticatedUser = {
        id: payload.sub,
        email: payload.email,
      };
      req.user = user;
      return true;
    } catch (err) {
      this.logger.debug(
        `JWT verify failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      throw new UnauthorizedException('Token inválido ou expirado');
    }
  }
}
