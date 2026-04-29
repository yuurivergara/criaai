import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { AuthService, type AuthSession } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from './current-user.decorator';
import type { AuthenticatedUser } from './auth.types';

class SignupDto {
  @ApiProperty({ example: 'voce@empresa.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @ApiProperty({ example: 'senha-forte' })
  @IsString()
  @MinLength(6, { message: 'A senha precisa ter pelo menos 6 caracteres' })
  @MaxLength(200)
  password!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

class LoginDto {
  @ApiProperty({ example: 'voce@empresa.com' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Senha obrigatória' })
  password!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @ApiOperation({ summary: 'Create a new account' })
  @Post('signup')
  @HttpCode(201)
  async signup(@Body() body: SignupDto): Promise<AuthSession> {
    return this.authService.signup(body);
  }

  @ApiOperation({ summary: 'Login with e-mail and password' })
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginDto): Promise<AuthSession> {
    return this.authService.login(body);
  }

  @ApiOperation({ summary: 'Return the authenticated user profile' })
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthSession['user']> {
    return this.authService.getProfile(user.id);
  }
}
