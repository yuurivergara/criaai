import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Global module so any feature can `@UseGuards(JwtAuthGuard)` and
 * `@CurrentUser()` without extra wiring.
 *
 * `JWT_SECRET` env var is required in production. In dev we fall back to
 * a fixed string so local boots work without setup, but logs a warning
 * because that secret would be insecure if exposed.
 */
@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET ?? 'criaai-dev-insecure-secret';
        if (!process.env.JWT_SECRET) {
          console.warn(
            '[auth] JWT_SECRET not set — using insecure dev secret. Set JWT_SECRET in .env for production.',
          );
        }
        const expiresIn = process.env.JWT_EXPIRES_IN ?? '7d';
        return {
          secret,
          signOptions: {
            // Cast to any to bypass overly strict StringValue typing in jsonwebtoken,
            // which doesn't recognize plain "7d"/"24h" literals at the type level.
            expiresIn: expiresIn as unknown as number,
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}
