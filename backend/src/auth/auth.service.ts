import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthSession {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    createdAt: string;
  };
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const MIN_PASSWORD = 6;
const BCRYPT_ROUNDS = 10;

/**
 * Owns the credential lifecycle: signup, login and JWT issuance.
 *
 * Passwords are stored as bcrypt hashes (never plain). Tokens are signed
 * with `JWT_SECRET` (env) and carry `{ sub, email }`. There's no refresh
 * flow yet — when the access token expires the user just logs in again.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private normalizeEmail(raw: string): string {
    const email = (raw ?? '').trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      throw new BadRequestException('E-mail inválido');
    }
    return email;
  }

  private validatePassword(raw: string): void {
    if (typeof raw !== 'string' || raw.length < MIN_PASSWORD) {
      throw new BadRequestException(
        `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres`,
      );
    }
  }

  private async issueToken(user: {
    id: string;
    email: string;
  }): Promise<string> {
    return this.jwtService.signAsync({ sub: user.id, email: user.email });
  }

  async signup(input: {
    email: string;
    password: string;
    name?: string;
  }): Promise<AuthSession> {
    const email = this.normalizeEmail(input.email);
    this.validatePassword(input.password);

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Já existe uma conta com esse e-mail');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
    const now = new Date();
    const created = await this.prisma.user.create({
      data: {
        id: randomUUID(),
        email,
        passwordHash,
        name: input.name?.trim() || null,
        createdAt: now,
        updatedAt: now,
      },
    });

    const token = await this.issueToken(created);
    return {
      token,
      user: {
        id: created.id,
        email: created.email,
        name: created.name,
        createdAt: created.createdAt.toISOString(),
      },
    };
  }

  async login(input: {
    email: string;
    password: string;
  }): Promise<AuthSession> {
    const email = this.normalizeEmail(input.email);
    if (!input.password) {
      throw new BadRequestException('Senha obrigatória');
    }
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Same message for missing user / wrong password to avoid leaking
      // which side is wrong.
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    const ok = await bcrypt.compare(input.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('E-mail ou senha inválidos');
    }
    const token = await this.issueToken(user);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  async getProfile(userId: string): Promise<AuthSession['user']> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
    };
  }
}
