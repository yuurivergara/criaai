import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClonePageDto } from './dto/clone-page.dto';
import { GeneratePageDto } from './dto/generate-page.dto';
import { PublishPageDto } from './dto/publish-page.dto';
import { UpdatePageContentDto } from './dto/update-page-content.dto';
import { PagesService } from './pages.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

@ApiTags('pages')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @ApiOperation({ summary: "List the authenticated user's pages" })
  @Get()
  async listMyPages(@CurrentUser() user: AuthenticatedUser) {
    return this.pagesService.listPagesForUser(user.id);
  }

  @ApiOperation({ summary: 'Create generation job' })
  @Post('generate')
  async createGenerateJob(
    @Body() body: GeneratePageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pagesService.createGenerateJob(body, user.id);
  }

  @ApiOperation({ summary: 'Create cloning job' })
  @Post('clone')
  async createCloneJob(
    @Body() body: ClonePageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pagesService.createCloneJob(body, user.id);
  }

  @ApiOperation({
    summary: 'Re-explore the quiz walker for an existing cloned page',
  })
  @Post(':id/re-explore')
  async reExplore(
    @Param('id') id: string,
    @Body() body: Partial<ClonePageDto>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pagesService.reExploreClone(id, body, user.id);
  }

  @ApiOperation({ summary: 'Create publish job' })
  @Post(':id/publish')
  async createPublishJob(
    @Param('id') id: string,
    @Body() body: PublishPageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pagesService.createPublishJob(id, body, user.id);
  }

  @ApiOperation({ summary: 'Update page content (auto-save)' })
  @Patch(':id/content')
  async updatePageContent(
    @Param('id') id: string,
    @Body() body: UpdatePageContentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pagesService.updatePageContent(id, body, user.id);
  }

  @ApiOperation({
    summary:
      'Resolve a clone-vs-edit conflict on a step (accept incoming or reject and keep edit)',
  })
  @Post(':id/conflicts/:stepId/:decision')
  async resolveCloneConflict(
    @Param('id') id: string,
    @Param('stepId') stepId: string,
    @Param('decision') decision: 'accept' | 'reject',
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pagesService.resolveCloneConflict(
      id,
      stepId,
      decision,
      user.id,
    );
  }

  @ApiOperation({ summary: 'Download landing page as ZIP archive' })
  @Get(':id/export.zip')
  async exportZip(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const zip = await this.pagesService.exportZip(id, user.id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="criaai-page-${id}.zip"`,
    );
    res.send(zip);
  }

  @ApiOperation({ summary: 'Get page by id' })
  @Get(':id')
  async getPageById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.pagesService.getPageById(id, user.id);
  }

  @ApiOperation({
    summary: 'Delete page (and all associated domains/versions)',
  })
  @Delete(':id')
  @HttpCode(204)
  async deletePage(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.pagesService.deletePageForUser(id, user.id);
  }
}

@ApiTags('public')
@Controller('public')
export class PublicPagesController {
  constructor(private readonly pagesService: PagesService) {}

  @ApiOperation({ summary: 'Serve published landing page (main step)' })
  @Get(':slug')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getPublicMain(@Param('slug') slug: string) {
    const { html } = await this.pagesService.getPublicStep(slug);
    return html;
  }

  @ApiOperation({ summary: 'Serve published landing page step' })
  @Get(':slug/:stepId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getPublicStep(
    @Param('slug') slug: string,
    @Param('stepId') stepId: string,
  ) {
    const { html } = await this.pagesService.getPublicStep(slug, stepId);
    return html;
  }
}
