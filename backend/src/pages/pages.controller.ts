import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ClonePageDto } from './dto/clone-page.dto';
import { GeneratePageDto } from './dto/generate-page.dto';
import { PublishPageDto } from './dto/publish-page.dto';
import { UpdatePageContentDto } from './dto/update-page-content.dto';
import { PagesService } from './pages.service';

@ApiTags('pages')
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @ApiOperation({ summary: 'Create generation job' })
  @Post('generate')
  async createGenerateJob(@Body() body: GeneratePageDto) {
    return this.pagesService.createGenerateJob(body);
  }

  @ApiOperation({ summary: 'Create cloning job' })
  @Post('clone')
  async createCloneJob(@Body() body: ClonePageDto) {
    return this.pagesService.createCloneJob(body);
  }

  @ApiOperation({
    summary: 'Re-explore the quiz walker for an existing cloned page',
  })
  @Post(':id/re-explore')
  async reExplore(
    @Param('id') id: string,
    @Body() body: Partial<ClonePageDto>,
  ) {
    return this.pagesService.reExploreClone(id, body);
  }

  @ApiOperation({ summary: 'Create publish job' })
  @Post(':id/publish')
  async createPublishJob(
    @Param('id') id: string,
    @Body() body: PublishPageDto,
  ) {
    return this.pagesService.createPublishJob(id, body);
  }

  @ApiOperation({ summary: 'Update page content (auto-save)' })
  @Patch(':id/content')
  async updatePageContent(
    @Param('id') id: string,
    @Body() body: UpdatePageContentDto,
  ) {
    return this.pagesService.updatePageContent(id, body);
  }

  @ApiOperation({ summary: 'Download landing page as ZIP archive' })
  @Get(':id/export.zip')
  async exportZip(@Param('id') id: string, @Res() res: Response) {
    const zip = await this.pagesService.exportZip(id);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="criaai-page-${id}.zip"`,
    );
    res.send(zip);
  }

  @ApiOperation({ summary: 'Get page by id' })
  @Get(':id')
  async getPageById(@Param('id') id: string) {
    return this.pagesService.getPageById(id);
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
