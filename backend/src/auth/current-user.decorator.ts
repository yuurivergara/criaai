import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedUser } from './auth.types';

/**
 * Inject the authenticated user into a controller method.
 *
 *   @Post()
 *   create(@CurrentUser() user: AuthenticatedUser) { ... }
 *
 * Throws 401 when the JwtAuthGuard hasn't populated `req.user`. Use only
 * on routes guarded by `JwtAuthGuard`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (!req.user) {
      throw new UnauthorizedException('Usuário não autenticado');
    }
    return req.user;
  },
);
