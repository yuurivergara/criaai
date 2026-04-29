import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { DomainsService, type CustomDomainView } from './domains.service';
import { PagesService } from './pages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

class CreateDomainDto {
  @ApiProperty({ example: 'quiz.minhamarca.com' })
  @IsString()
  @MinLength(3)
  @MaxLength(253)
  host!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  label?: string;
}

@ApiTags('domains')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pages/:pageId/domains')
export class DomainsController {
  constructor(
    private readonly domainsService: DomainsService,
    // Used for ownership check on the parent page; throws 404 when the
    // page belongs to someone else, so we don't leak its existence.
    private readonly pagesService: PagesService,
  ) {}

  private async assertOwnership(
    pageId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    await this.pagesService.getPageById(pageId, user.id);
  }

  @ApiOperation({ summary: 'List custom domains attached to a page' })
  @Get()
  async list(
    @Param('pageId') pageId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomDomainView[]> {
    await this.assertOwnership(pageId, user);
    return this.domainsService.list(pageId);
  }

  @ApiOperation({
    summary: 'Attach a new custom domain (status starts as pending)',
  })
  @Post()
  async create(
    @Param('pageId') pageId: string,
    @Body() body: CreateDomainDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomDomainView> {
    await this.assertOwnership(pageId, user);
    return this.domainsService.create(pageId, body.host, body.label);
  }

  @ApiOperation({
    summary:
      'Verify TXT record for the domain. Promotes pending → active when the token matches.',
  })
  @Post(':domainId/verify')
  @HttpCode(200)
  async verify(
    @Param('pageId') pageId: string,
    @Param('domainId') domainId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CustomDomainView> {
    await this.assertOwnership(pageId, user);
    return this.domainsService.verify(pageId, domainId);
  }

  @ApiOperation({ summary: 'Detach a custom domain' })
  @Delete(':domainId')
  @HttpCode(204)
  async remove(
    @Param('pageId') pageId: string,
    @Param('domainId') domainId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.assertOwnership(pageId, user);
    await this.domainsService.remove(pageId, domainId);
  }
}
