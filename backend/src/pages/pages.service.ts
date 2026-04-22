import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { load } from 'cheerio';
import { Page, Prisma } from '../../generated/prisma-v2';
import { JobsService } from '../jobs/jobs.service';
import { LlmOrchestratorService } from '../llm/llm-orchestrator.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { ClonePageDto } from './dto/clone-page.dto';
import { GeneratePageDto } from './dto/generate-page.dto';
import { PublishPageDto } from './dto/publish-page.dto';
import { mhtmlToSelfContainedHtml } from './mhtml.util';
import {
  rewriteNavigation,
  stepIdToFilename,
  type StepResolver,
} from './navmap.util';
import {
  applyCustomizationValues,
  detectCustomizationAnchors,
  expandValuesAcrossGroups,
  type CustomizationAnchor,
  type CustomizationValues,
} from './customization.util';
import { UpdatePageContentDto } from './dto/update-page-content.dto';
import { PageSourceType } from './pages.types';
import { LlmAssistService } from '../llm/llm-assist.service';
import { SalesPageGeneratorService } from './sales-page-generator.service';
import {
  CRIAAI_ID_ATTR,
  STABLE_ID_BROWSER_JS,
  injectStableIdsOnCheerio,
} from './stable-id.util';
import {
  QUIZ_STATE_BROWSER_JS,
  computeQuizFingerprint,
  type QuizAction,
  type QuizStateSnapshot,
} from './quiz-state.util';

interface CapturedPublicPage {
  url: string;
  title: string;
  html: string;
  renderMode?: 'runtime' | 'frozen';
  stepId?: string;
  sourceStepId?: string;
  triggerText?: string;
  triggerSelector?: string;
}

interface NavigationEdge {
  fromStepId: string;
  selector: string;
  toStepId: string;
  triggerText?: string;
  actionId?: string;
}

@Injectable()
export class PagesService implements OnModuleInit {
  private readonly blockedTerms = ['phishing', 'malware', 'fake login'];
  private readonly logger = new Logger(PagesService.name);

  constructor(
    private readonly jobsService: JobsService,
    private readonly llmOrchestratorService: LlmOrchestratorService,
    private readonly prismaService: PrismaService,
    private readonly queueService: QueueService,
    private readonly llmAssistService: LlmAssistService,
    private readonly salesPageGeneratorService: SalesPageGeneratorService,
  ) {}

  onModuleInit() {
    this.queueService.registerHandler('pages.generate', async (payload) => {
      await this.processGenerateJob(
        String(payload.jobId),
        payload.data as GeneratePageDto,
      );
    });
    this.queueService.registerHandler('pages.clone', async (payload) => {
      await this.processCloneJob(
        String(payload.jobId),
        payload.data as ClonePageDto,
      );
    });
    this.queueService.registerHandler('pages.publish', async (payload) => {
      await this.processPublishJob(
        String(payload.jobId),
        String(payload.pageId),
        payload.data as PublishPageDto,
      );
    });
  }

  async createGenerateJob(payload: GeneratePageDto) {
    const job = await this.jobsService.create('generate', { ...payload });
    await this.queueService.enqueue('pages.generate', {
      jobId: job.id,
      data: payload as unknown as Record<string, unknown>,
    });
    return {
      jobId: job.id,
      status: job.status,
    };
  }

  async createCloneJob(payload: ClonePageDto) {
    const job = await this.jobsService.create('clone', { ...payload });
    await this.queueService.enqueue('pages.clone', {
      jobId: job.id,
      data: payload as unknown as Record<string, unknown>,
    });
    return {
      jobId: job.id,
      status: job.status,
    };
  }

  /**
   * Re-runs the capture + quiz-walker pipeline for an already-created page.
   * Keeps the page record (and slug/publicUrl) so public links don't break;
   * only creates a new PageVersion with the fresh walk results.
   */
  async reExploreClone(pageId: string, overrides: Partial<ClonePageDto> = {}) {
    const page = await this.prismaService.page.findUnique({
      where: { id: pageId },
    });
    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    if (!page.sourceUrl) {
      throw new BadRequestException('Page has no sourceUrl to re-explore');
    }
    const payload: ClonePageDto = {
      sourceUrl: page.sourceUrl,
      ...overrides,
    } as ClonePageDto;
    const job = await this.jobsService.create('clone', {
      ...payload,
      reExploreOfPageId: pageId,
    });
    await this.queueService.enqueue('pages.clone', {
      jobId: job.id,
      data: payload as unknown as Record<string, unknown>,
      reExploreOfPageId: pageId,
    });
    return {
      jobId: job.id,
      status: job.status,
      pageId,
    };
  }

  async createPublishJob(pageId: string, payload: PublishPageDto) {
    await this.getPageById(pageId);
    const job = await this.jobsService.create('publish', {
      pageId,
      ...payload,
    });
    await this.queueService.enqueue('pages.publish', {
      jobId: job.id,
      pageId,
      data: payload as unknown as Record<string, unknown>,
    });
    return {
      jobId: job.id,
      status: job.status,
    };
  }

  async getPageById(pageId: string) {
    const page = await this.prismaService.page.findUnique({
      where: { id: pageId },
    });
    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    const latestVersion = page.latestVersionId
      ? await this.prismaService.pageVersion.findUnique({
          where: { id: page.latestVersionId },
        })
      : null;
    return {
      ...this.mapPage(page),
      latestVersion,
    };
  }

  private async processGenerateJob(jobId: string, payload: GeneratePageDto) {
    await this.jobsService.updateStatus(jobId, 'processing');
    try {
      this.logger.log(
        `[generate:${jobId}] starting product="${payload.productName ?? ''}" tone=${payload.tone ?? 'confident'} language=${payload.language ?? 'pt-BR'} niche="${payload.niche ?? ''}" hasVsl=${Boolean(payload.vslUrl)} hasCheckout=${Boolean(payload.checkoutUrl)}`,
      );

      const result = await this.salesPageGeneratorService.generate({
        prompt: payload.prompt,
        productName: payload.productName,
        title: payload.title,
        cta: payload.cta,
        audience: payload.audience,
        niche: payload.niche,
        promise: payload.promise,
        uniqueMechanism: payload.uniqueMechanism,
        objections: payload.objections,
        proofPoints: payload.proofPoints,
        bonuses: payload.bonuses,
        authorName: payload.authorName,
        authorRole: payload.authorRole,
        authorBio: payload.authorBio,
        urgencyHook: payload.urgencyHook,
        priceOffer: payload.priceOffer,
        guarantee: payload.guarantee,
        tone: payload.tone,
        language: payload.language,
        layoutPreference: payload.layoutPreference,
        palettePreference: payload.palettePreference,
        typographyPreference: payload.typographyPreference,
        vslUrl: payload.vslUrl,
        checkoutUrl: payload.checkoutUrl,
        workspaceId: payload.workspaceId,
      });

      // Reuse the clone pipeline: inject stable ids + normalize + detect
      // customization anchors. We feed a synthetic base href so the cloned
      // editor works the same way it does for real captures.
      const syntheticSource = 'https://generated.criaai.local/sales/';
      const preparedHtml = this.prepareCloneHtml(result.html, syntheticSource);

      const mainPage: CapturedPublicPage = {
        url: syntheticSource,
        title: result.title,
        html: preparedHtml,
        renderMode: 'runtime',
        stepId: 'main',
      };

      const publicPages: CapturedPublicPage[] = [mainPage];
      const customizationAnchors = this.buildCustomizationAnchors(
        publicPages,
        [],
      );

      // Pre-seed customization values the user already supplied, so the first
      // render already shows their VSL / checkout.
      const customizationValues: CustomizationValues = {};
      if (payload.vslUrl) {
        const vslAnchor = customizationAnchors.find((a) => a.kind === 'video');
        if (vslAnchor) customizationValues[vslAnchor.id] = payload.vslUrl;
      }
      if (payload.checkoutUrl) {
        for (const anchor of customizationAnchors) {
          if (anchor.kind === 'checkout') {
            customizationValues[anchor.id] = payload.checkoutUrl;
          }
        }
      }

      this.logger.log(
        `[generate:${jobId}] built page htmlLength=${preparedHtml.length} anchors=${customizationAnchors.length} (ck=${customizationAnchors.filter((a) => a.kind === 'checkout').length}, vsl=${customizationAnchors.filter((a) => a.kind === 'video').length})`,
      );

      const page = await this.persistPage(
        'generate',
        result.title,
        preparedHtml,
        {
          objective: payload.prompt,
          cta: payload.cta ?? result.copy.primaryCta,
          productName: result.copy.productName,
          audience: payload.audience,
          niche: payload.niche,
          priceOffer: payload.priceOffer,
          tone: result.meta.tone,
          language: result.meta.language,
          generatorProvider: result.meta.provider,
          generatorModel: result.meta.model,
          design: {
            layout: result.meta.layout,
            palette: result.meta.palette,
            typography: result.meta.typography,
            seed: result.design.seed,
          },
          copy: result.copy,
          publicPages,
          navigationMap: [],
          customizationAnchors,
          customizationValues,
        },
      );

      // Auto-publish so the customer already gets a public URL shipped with
      // the job result. The slug is derived from productName (+niche) with a
      // random suffix fallback to escape uniqueness collisions.
      let published: { slug: string; publicUrl: string } | null = null;
      try {
        const baseSlug = this.slugify(
          [result.copy.productName, payload.niche].filter(Boolean).join(' ') ||
            result.title ||
            'sales',
        );
        published = await this.publishPageToSlug(page.id, baseSlug);
        this.logger.log(
          `[generate:${jobId}] auto-published slug=${published.slug} url=${published.publicUrl}`,
        );
      } catch (err) {
        // Don't fail the whole job if publishing fails — the user can still
        // edit and publish manually from the editor.
        this.logger.warn(
          `[generate:${jobId}] auto-publish failed: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      }

      await this.jobsService.updateStatus(jobId, 'completed', {
        result: {
          pageId: page.id,
          versionId: page.latestVersionId,
          provider: result.meta.provider,
          publicUrl: published?.publicUrl,
          slug: published?.slug,
        },
      });
    } catch (error) {
      this.logger.error(
        `[generate:${jobId}] failed: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      await this.jobsService.updateStatus(jobId, 'failed', {
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected generation error',
      });
    }
  }

  private async processCloneJob(jobId: string, payload: ClonePageDto) {
    await this.jobsService.updateStatus(jobId, 'processing');
    try {
      const source = await this.fetchSource(payload.sourceUrl, jobId);
      const extracted = this.extractSourceData(source.html);
      this.logger.log(
        `[clone:${jobId}] strategy=${source.strategy} htmlLength=${source.html.length} title="${extracted.title}" headings=${extracted.sections.length} textLength=${extracted.text.length}`,
      );
      this.logger.debug(
        `[clone:${jobId}] debug=${JSON.stringify(source.debug)}`,
      );
      const complianceState = this.runComplianceChecks(
        extracted.text,
        payload.sourceUrl,
      );
      if (complianceState.isBlocked) {
        this.logger.warn(
          `[clone:${jobId}] blocked reason="${complianceState.reason}"`,
        );
        await this.jobsService.updateStatus(jobId, 'blocked', {
          error: complianceState.reason,
        });
        return;
      }

      const clonedHtml = this.prepareCloneHtml(source.html, payload.sourceUrl);

      const page = await this.persistPage(
        'clone',
        extracted.title,
        clonedHtml,
        {
          sourceUrl: payload.sourceUrl,
          objective: payload.objective,
          cta: payload.cta,
          cloneMode: 'full-html',
          fetchStrategy: source.strategy,
          fetchDebug: source.debug,
          publicPages: source.publicPages,
          navigationMap: source.navigationMap,
          customizationAnchors: this.buildCustomizationAnchors(
            source.publicPages,
            source.navigationMap ?? [],
          ),
          customizationValues: {},
        },
      );

      await this.jobsService.updateStatus(jobId, 'completed', {
        result: {
          pageId: page.id,
          versionId: page.latestVersionId,
          sourceUrl: payload.sourceUrl,
        },
      });
    } catch (error) {
      await this.jobsService.updateStatus(jobId, 'failed', {
        error:
          error instanceof Error ? error.message : 'Unexpected clone error',
      });
    }
  }

  private async processPublishJob(
    jobId: string,
    pageId: string,
    payload: PublishPageDto,
  ) {
    await this.jobsService.updateStatus(jobId, 'processing');
    try {
      const page = await this.prismaService.page.findUnique({
        where: { id: pageId },
      });
      if (!page) {
        throw new NotFoundException(`Page ${pageId} not found`);
      }
      if (!page.latestVersionId) {
        throw new BadRequestException('Page has no version to publish');
      }
      const version = await this.prismaService.pageVersion.findUnique({
        where: { id: page.latestVersionId },
      });
      if (!version) {
        throw new NotFoundException('Version not found');
      }
      const meta =
        version.meta && typeof version.meta === 'object'
          ? (version.meta as Record<string, unknown>)
          : {};
      const publicPages = Array.isArray(meta.publicPages)
        ? (meta.publicPages as CapturedPublicPage[])
        : [];
      const navigationMap = Array.isArray(meta.navigationMap)
        ? (meta.navigationMap as NavigationEdge[])
        : [];
      const customizationAnchors = Array.isArray(meta.customizationAnchors)
        ? (meta.customizationAnchors as CustomizationAnchor[])
        : [];
      const rawCustomizationValues =
        meta.customizationValues && typeof meta.customizationValues === 'object'
          ? (meta.customizationValues as CustomizationValues)
          : {};
      // Expand per-step values across groupId so the user editing the
      // checkout URL on q05 propagates to q12, q18, and every other step
      // where the SAME button appears.
      const customizationValues = expandValuesAcrossGroups(
        customizationAnchors,
        rawCustomizationValues,
      );

      const steps = publicPages.length
        ? publicPages
        : [
            {
              url: page.sourceUrl ?? 'about:blank',
              title: version.title,
              html: version.html,
              stepId: 'main',
            } as CapturedPublicPage,
          ];

      const publicBase =
        process.env.PUBLIC_BASE_URL ??
        `http://localhost:${process.env.PORT ?? 3000}/v1/public`;

      const publishedSteps = steps.map((step) => {
        const stepId = step.stepId ?? 'main';
        const resolver: StepResolver = (toStepId) => {
          const normalized =
            toStepId === 'main' ? '' : `/${encodeURIComponent(toStepId)}`;
          return `${publicBase}/${payload.subdomain}${normalized}`;
        };
        const stepAnchors = customizationAnchors.filter(
          (a) => a.stepId === stepId,
        );
        const customized = applyCustomizationValues(
          step.html,
          stepAnchors,
          customizationValues,
        );
        const rewritten = rewriteNavigation(
          customized,
          stepId,
          navigationMap,
          resolver,
          { neutralizeExternal: true },
        );
        return {
          stepId,
          title: step.title,
          html: rewritten,
          renderMode: step.renderMode ?? 'runtime',
        };
      });

      const publishedBundle = {
        mainStepId: 'main',
        steps: publishedSteps,
        publishedAt: new Date().toISOString(),
      };

      const publicUrl = `${publicBase}/${payload.subdomain}`;
      await this.prismaService.page.update({
        where: { id: pageId },
        data: {
          status: 'published',
          publicUrl,
          slug: payload.subdomain,
          publishedBundle: publishedBundle as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
      await this.jobsService.updateStatus(jobId, 'completed', {
        result: {
          pageId,
          publicUrl,
        },
      });
    } catch (error) {
      await this.jobsService.updateStatus(jobId, 'failed', {
        error:
          error instanceof Error ? error.message : 'Unexpected publish error',
      });
    }
  }

  /**
   * Slugify arbitrary text into a URL-safe fragment: lowercase, latin-only,
   * dashes between words, no consecutive dashes, bounded length.
   */
  private slugify(raw: string, maxLength = 40): string {
    const normalized = (raw || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const trimmed = normalized.slice(0, maxLength).replace(/-+$/, '');
    return trimmed || 'sales';
  }

  /**
   * Publish a page inline (no queue). Used by the generate flow to auto-
   * publish the freshly-created page to a unique public slug so the customer
   * immediately has a shareable URL.
   *
   * Retries on slug collisions up to `maxAttempts` times by swapping the
   * random suffix — after that it bubbles the last error up.
   */
  private async publishPageToSlug(
    pageId: string,
    baseSlug: string,
    maxAttempts = 5,
  ): Promise<{ slug: string; publicUrl: string }> {
    const page = await this.prismaService.page.findUnique({
      where: { id: pageId },
    });
    if (!page) throw new NotFoundException(`Page ${pageId} not found`);
    if (!page.latestVersionId) {
      throw new BadRequestException('Page has no version to publish');
    }
    const version = await this.prismaService.pageVersion.findUnique({
      where: { id: page.latestVersionId },
    });
    if (!version) throw new NotFoundException('Version not found');

    const meta =
      version.meta && typeof version.meta === 'object'
        ? (version.meta as Record<string, unknown>)
        : {};
    const publicPages = Array.isArray(meta.publicPages)
      ? (meta.publicPages as CapturedPublicPage[])
      : [];
    const navigationMap = Array.isArray(meta.navigationMap)
      ? (meta.navigationMap as NavigationEdge[])
      : [];
    const customizationAnchors = Array.isArray(meta.customizationAnchors)
      ? (meta.customizationAnchors as CustomizationAnchor[])
      : [];
    const rawCustomizationValues =
      meta.customizationValues && typeof meta.customizationValues === 'object'
        ? (meta.customizationValues as CustomizationValues)
        : {};
    const customizationValues = expandValuesAcrossGroups(
      customizationAnchors,
      rawCustomizationValues,
    );

    const steps = publicPages.length
      ? publicPages
      : [
          {
            url: page.sourceUrl ?? 'about:blank',
            title: version.title,
            html: version.html,
            stepId: 'main',
          } as CapturedPublicPage,
        ];

    const publicBase =
      process.env.PUBLIC_BASE_URL ??
      `http://localhost:${process.env.PORT ?? 3000}/v1/public`;

    const sanitizedBase = this.slugify(baseSlug).slice(0, 40) || 'sales';

    const buildBundle = (slug: string) => {
      const publishedSteps = steps.map((step) => {
        const stepId = step.stepId ?? 'main';
        const resolver: StepResolver = (toStepId) => {
          const normalized =
            toStepId === 'main' ? '' : `/${encodeURIComponent(toStepId)}`;
          return `${publicBase}/${slug}${normalized}`;
        };
        const stepAnchors = customizationAnchors.filter(
          (a) => a.stepId === stepId,
        );
        const customized = applyCustomizationValues(
          step.html,
          stepAnchors,
          customizationValues,
        );
        const rewritten = rewriteNavigation(
          customized,
          stepId,
          navigationMap,
          resolver,
          { neutralizeExternal: true },
        );
        return {
          stepId,
          title: step.title,
          html: rewritten,
          renderMode: step.renderMode ?? 'runtime',
        };
      });
      return {
        mainStepId: 'main',
        steps: publishedSteps,
        publishedAt: new Date().toISOString(),
      };
    };

    let lastError: unknown;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      // First attempt uses base slug alone; next attempts add a random suffix
      // to escape uniqueness collisions on Page.slug.
      const suffix =
        attempt === 0
          ? ''
          : `-${Math.random().toString(36).slice(2, 7).toLowerCase()}`;
      const slug = `${sanitizedBase}${suffix}`.slice(0, 50);
      const publicUrl = `${publicBase}/${slug}`;
      try {
        const bundle = buildBundle(slug);
        await this.prismaService.page.update({
          where: { id: pageId },
          data: {
            status: 'published',
            publicUrl,
            slug,
            publishedBundle: bundle as unknown as Prisma.InputJsonValue,
            updatedAt: new Date(),
          },
        });
        return { slug, publicUrl };
      } catch (err) {
        lastError = err;
        // Prisma throws P2002 on unique constraint violation; retry on anything
        // looking like a uniqueness collision, otherwise bail out immediately.
        const msg = err instanceof Error ? err.message : String(err);
        const looksLikeUniqueCollision =
          /Unique constraint|P2002|duplicate key|unique/i.test(msg);
        if (!looksLikeUniqueCollision) break;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('Unable to allocate a unique public slug');
  }

  private persistPage(
    sourceType: PageSourceType,
    title: string,
    html: string,
    meta: Record<string, unknown>,
  ) {
    const pageId = randomUUID();
    const versionId = randomUUID();
    const now = new Date();
    return (async () => {
      await this.prismaService.page.create({
        data: {
          id: pageId,
          sourceType,
          status: 'draft',
          sourceUrl:
            typeof meta.sourceUrl === 'string' ? meta.sourceUrl : undefined,
          createdAt: now,
          updatedAt: now,
        },
      });
      const maxAttempts = 3;
      let lastError: unknown;
      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          await this.prismaService.pageVersion.create({
            data: {
              id: versionId,
              pageId,
              title,
              html,
              meta: meta as Prisma.InputJsonValue,
              createdAt: now,
            },
          });
          lastError = undefined;
          break;
        } catch (error) {
          lastError = error;
          if (attempt === maxAttempts) {
            throw error;
          }
          await new Promise((resolve) => {
            setTimeout(resolve, 30 * attempt);
          });
        }
      }
      if (lastError) {
        if (lastError instanceof Error) {
          throw lastError;
        }
        throw new Error('Failed to persist page version');
      }
      const page = await this.prismaService.page.update({
        where: { id: pageId },
        data: { latestVersionId: versionId },
      });
      return this.mapPage(page);
    })();
  }

  private async fetchSource(
    url: string,
    jobId?: string,
  ): Promise<{
    html: string;
    strategy: 'static' | 'rendered';
    debug: Record<string, unknown>;
    publicPages: CapturedPublicPage[];
    navigationMap: NavigationEdge[];
  }> {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new BadRequestException('Source URL must use http or https');
    }
    const staticHtml = await this.fetchSourceStatic(url);
    const staticExtracted = this.extractSourceData(staticHtml);
    const staticSignals = this.inspectCloneSignals(staticHtml, staticExtracted);
    if (!staticSignals.needsRender) {
      return {
        html: staticHtml,
        strategy: 'static',
        debug: {
          stage: 'static-ok',
          staticSignals,
        },
        publicPages: [
          {
            url,
            title: staticExtracted.title,
            html: this.prepareCloneHtml(staticHtml, url),
            stepId: 'main',
          },
        ],
        navigationMap: [],
      };
    }

    try {
      const rendered = await this.fetchSourceRendered(url, jobId);
      const renderedHtml = rendered.html;
      const renderedExtracted = this.extractSourceData(renderedHtml);
      const renderedSignals = this.inspectCloneSignals(
        renderedHtml,
        renderedExtracted,
      );
      const renderedHasMoreContent =
        renderedSignals.bodyTextLength >= staticSignals.bodyTextLength ||
        renderedSignals.headingCount >= staticSignals.headingCount;
      if (renderedHasMoreContent) {
        return {
          html: renderedHtml,
          strategy: 'rendered',
          debug: {
            stage: 'rendered-selected',
            staticSignals,
            renderedSignals,
          },
          publicPages: rendered.publicPages,
          navigationMap: rendered.navigationMap,
        };
      }

      return {
        html: staticHtml,
        strategy: 'static',
        debug: {
          stage: 'rendered-not-better',
          staticSignals,
          renderedSignals,
        },
        publicPages: [
          {
            url,
            title: staticExtracted.title,
            html: this.prepareCloneHtml(staticHtml, url),
            stepId: 'main',
          },
        ],
        navigationMap: [],
      };
    } catch (error) {
      const renderError =
        error instanceof Error ? error.message : 'Unknown render error';
      this.logger.warn(
        `[clone] rendered fetch failed, falling back to static: ${renderError}`,
      );
      return {
        html: staticHtml,
        strategy: 'static',
        debug: {
          stage: 'rendered-failed-fallback-static',
          staticSignals,
          renderError,
        },
        publicPages: [
          {
            url,
            title: staticExtracted.title,
            html: this.prepareCloneHtml(staticHtml, url),
            stepId: 'main',
          },
        ],
        navigationMap: [],
      };
    }
  }

  private async fetchSourceStatic(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      if (!response.ok) {
        throw new BadRequestException(
          `Failed to fetch source URL with status ${response.status}`,
        );
      }
      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchSourceRendered(
    url: string,
    jobId?: string,
  ): Promise<{
    html: string;
    publicPages: CapturedPublicPage[];
    navigationMap: NavigationEdge[];
  }> {
    const playwright = await import('playwright');
    const browser = await playwright.chromium.launch({
      headless: true,
    });
    try {
      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
        locale: 'pt-BR',
      });
      const page = await context.newPage();
      await page.addInitScript(() => {
        // Force most lazy-load observers to treat targets as visible.
        class ImmediateIntersectionObserver implements IntersectionObserver {
          readonly root = null;
          readonly rootMargin = '0px';
          readonly thresholds = [0];
          private callback: IntersectionObserverCallback;
          constructor(callback: IntersectionObserverCallback) {
            this.callback = callback;
          }
          disconnect() {}
          observe(target: Element) {
            this.callback(
              [
                {
                  time: Date.now(),
                  target,
                  rootBounds: null,
                  boundingClientRect: target.getBoundingClientRect(),
                  intersectionRect: target.getBoundingClientRect(),
                  isIntersecting: true,
                  intersectionRatio: 1,
                } as IntersectionObserverEntry,
              ],
              this,
            );
          }
          takeRecords(): IntersectionObserverEntry[] {
            return [];
          }
          unobserve() {}
        }
        Object.defineProperty(window, 'IntersectionObserver', {
          configurable: true,
          writable: true,
          value: ImmediateIntersectionObserver,
        });
      });
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await page
        .waitForLoadState('networkidle', { timeout: 7000 })
        .catch(() => undefined);
      await this.scrollPageForLazyContent(page);
      const baselineHtml = await page.content();
      const baselineUrl = page.url();
      await this.exploreInteractiveFlow(page, url, jobId);
      await this.clickQuizProgressiveActions(page);
      await this.scrollPageForLazyContent(page);
      await this.waitForLazyHydration(page, jobId);
      await page.evaluate(() => {
        const resolveFromDataAttrs = (el: Element, targetAttr: string) => {
          if (el.getAttribute(targetAttr)) {
            return;
          }
          const candidates = [
            'data-src',
            'data-lazy-src',
            'data-original',
            'data-url',
            'data-background-image',
            'data-bg',
          ];
          for (const attr of candidates) {
            const value = el.getAttribute(attr);
            if (value) {
              el.setAttribute(targetAttr, value);
              break;
            }
          }
        };

        document.querySelectorAll('[loading="lazy"]').forEach((node) => {
          node.setAttribute('loading', 'eager');
        });
        document.querySelectorAll('img').forEach((img) => {
          resolveFromDataAttrs(img, 'src');
          const srcset = img.getAttribute('data-srcset');
          if (srcset && !img.getAttribute('srcset')) {
            img.setAttribute('srcset', srcset);
          }
        });
        document.querySelectorAll('iframe').forEach((iframe) => {
          resolveFromDataAttrs(iframe, 'src');
        });
        document.querySelectorAll('video').forEach((video) => {
          resolveFromDataAttrs(video, 'src');
          const poster = video.getAttribute('data-poster');
          if (poster && !video.getAttribute('poster')) {
            video.setAttribute('poster', poster);
          }
        });
        document.querySelectorAll('source').forEach((source) => {
          resolveFromDataAttrs(source, 'src');
          const srcset = source.getAttribute('data-srcset');
          if (srcset && !source.getAttribute('srcset')) {
            source.setAttribute('srcset', srcset);
          }
        });
      });
      await this.materializeDynamicAssets(page);
      await this.scrollPageForLazyContent(page);
      await page.waitForTimeout(1200);

      const mhtmlHtml = await this.captureMhtmlSelfContained(page, jobId);

      let selectedHtml: string;
      let selectedUrl: string;
      if (mhtmlHtml) {
        selectedHtml = mhtmlHtml;
        selectedUrl = page.url();
      } else {
        await this.inlineExternalStylesheets(page);
        const bestSnapshot = await this.captureBestRenderedSnapshot(
          page,
          jobId,
        );
        selectedHtml = bestSnapshot.html;
        selectedUrl = bestSnapshot.url;
      }
      if (this.isAuthLikeUrl(selectedUrl) && !this.isAuthLikeUrl(url)) {
        this.logger.warn(
          `[clone:${jobId ?? 'n/a'}] best snapshot moved to auth route (${selectedUrl}); keeping baseline capture from ${baselineUrl}`,
        );
        selectedHtml = baselineHtml;
        selectedUrl = baselineUrl;
      }
      const publicPages = await this.capturePublicPages(
        context,
        selectedUrl,
        selectedHtml,
        jobId,
      );
      const quizResult = await this.captureQuizBranches(
        context,
        selectedUrl,
        jobId,
      );
      const mergedPublicPages = this.mergeCapturedPages([
        ...publicPages,
        ...quizResult.variants,
      ]);
      return {
        html: selectedHtml,
        publicPages: mergedPublicPages,
        navigationMap: quizResult.navigationMap,
      };
    } finally {
      await browser.close();
    }
  }

  private mergeCapturedPages(
    pages: CapturedPublicPage[],
  ): CapturedPublicPage[] {
    const seenByUrl = new Set<string>();
    const seenBySignature = new Set<string>();
    const seenByStepId = new Set<string>();
    const merged: CapturedPublicPage[] = [];
    for (const page of pages) {
      const signature = `${page.title}|${page.html.slice(0, 260)}`;
      if (page.stepId && seenByStepId.has(page.stepId)) continue;
      if (seenByUrl.has(page.url) || seenBySignature.has(signature)) {
        continue;
      }
      seenByUrl.add(page.url);
      seenBySignature.add(signature);
      if (page.stepId) seenByStepId.add(page.stepId);
      merged.push(page);
    }
    return merged.slice(0, 80);
  }

  private async capturePublicPages(
    context: {
      newPage: () => Promise<{
        goto: (
          url: string,
          options?: { waitUntil?: 'domcontentloaded'; timeout?: number },
        ) => Promise<unknown>;
        waitForLoadState: (
          state: 'networkidle',
          options?: { timeout?: number },
        ) => Promise<unknown>;
        waitForTimeout: (ms: number) => Promise<void>;
        content: () => Promise<string>;
        close: () => Promise<void>;
        url: () => string;
        evaluate: (...args: unknown[]) => Promise<unknown>;
      }>;
    },
    baseUrl: string,
    baseHtml: string,
    jobId?: string,
  ): Promise<CapturedPublicPage[]> {
    const baseRenderMode: 'runtime' | 'frozen' = baseUrl.includes('qz=')
      ? 'frozen'
      : 'runtime';
    const primaryTitle = this.extractSourceData(baseHtml).title;
    const collected: CapturedPublicPage[] = [
      {
        url: baseUrl,
        title: primaryTitle,
        html: this.prepareCloneHtml(baseHtml, baseUrl),
        renderMode: baseRenderMode,
        stepId: 'main',
      },
    ];
    const baseHost = new URL(baseUrl).host;
    const discovered = this.extractPublicLinks(baseHtml, baseUrl).slice(0, 7);
    let publicIndex = 0;

    for (const url of discovered) {
      if (collected.some((item) => item.url === url)) {
        continue;
      }
      if (this.isAuthLikeUrl(url) || this.isBoilerplateUrl(url)) {
        continue;
      }
      try {
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 18000 });
        await page
          .waitForLoadState('networkidle', { timeout: 5000 })
          .catch(() => undefined);
        await page.waitForTimeout(800);
        const finalUrl = page.url();
        if (
          new URL(finalUrl).host !== baseHost ||
          this.isAuthLikeUrl(finalUrl) ||
          this.isBoilerplateUrl(finalUrl)
        ) {
          await page.close();
          continue;
        }
        const mhtmlHtml = await this.captureMhtmlSelfContained(page, jobId);
        let html: string;
        if (mhtmlHtml) {
          html = mhtmlHtml;
        } else {
          await this.inlineExternalStylesheets(page);
          html = await page.content();
        }
        const title = this.extractSourceData(html).title;
        if (this.isBoilerplateTitle(title)) {
          await page.close();
          continue;
        }
        publicIndex += 1;
        collected.push({
          url: finalUrl,
          title,
          html: this.prepareCloneHtml(html, finalUrl),
          renderMode: baseRenderMode,
          stepId: `page-${publicIndex}`,
        });
        await page.close();
      } catch (error) {
        this.logger.warn(
          `[clone:${jobId ?? 'n/a'}] failed to capture public page ${url}: ${error instanceof Error ? error.message : 'unknown error'}`,
        );
      }
    }

    this.logger.log(
      `[clone:${jobId ?? 'n/a'}] captured public pages=${collected.length}`,
    );
    return collected.slice(0, 12);
  }

  private async captureQuizBranches(
    context: {
      newPage: () => Promise<{
        goto: (
          url: string,
          options?: { waitUntil?: 'domcontentloaded'; timeout?: number },
        ) => Promise<unknown>;
        waitForLoadState: (
          state: 'networkidle',
          options?: { timeout?: number },
        ) => Promise<unknown>;
        waitForTimeout: (ms: number) => Promise<void>;
        content: () => Promise<string>;
        url: () => string;
        close: () => Promise<void>;
        evaluate: <T, A>(
          pageFunction: (arg: A) => Promise<T> | T,
          arg: A,
        ) => Promise<T>;
        click: (
          selector: string,
          options?: {
            timeout?: number;
            force?: boolean;
            delay?: number;
            button?: 'left' | 'right' | 'middle';
            clickCount?: number;
            position?: { x: number; y: number };
            noWaitAfter?: boolean;
          },
        ) => Promise<void>;
        waitForFunction: <T>(
          pageFunction: string | ((arg: unknown) => T),
          arg?: unknown,
          options?: { timeout?: number; polling?: number | 'raf' },
        ) => Promise<unknown>;
      }>;
    },
    sourceUrl: string,
    jobId?: string,
  ): Promise<{
    variants: CapturedPublicPage[];
    navigationMap: NavigationEdge[];
  }> {
    return this.runQuizWalkers(context, sourceUrl, jobId);
  }

  /**
   * Quiz exploration based on a "linear walker" simulating a real user.
   *
   * Strategy
   * --------
   * 1. Run a SINGLE Playwright page that walks through the quiz step by step:
   *    capture state, auto-fill any pending radio/checkbox group, pick the
   *    best "advance" action, click, wait, repeat. This avoids the brittle
   *    BFS replay we had before (SPA frameworks regenerate selectors on
   *    every reload, so replay-from-source quickly fails).
   *
   * 2. While walking, every state also reports its visible OPTIONS (radio
   *    cards, alternative buttons). The first one is the "default" we'll
   *    click; the rest are recorded as ForkPoints to explore later.
   *
   * 3. After the linear walk finishes, fan-out: for each ForkPoint we run a
   *    new walker that takes the alternative answer at that state and then
   *    walks linearly until the end. Newly discovered states are merged in.
   *
   * Deduplication is by content signature (title + base URL + visible text),
   * which ignores attributes/classes that change with selection state.
   */
  private async runQuizWalkers(
    context: {
      newPage: () => Promise<{
        goto: (
          url: string,
          options?: { waitUntil?: 'domcontentloaded'; timeout?: number },
        ) => Promise<unknown>;
        waitForLoadState: (
          state: 'networkidle',
          options?: { timeout?: number },
        ) => Promise<unknown>;
        waitForTimeout: (ms: number) => Promise<void>;
        content: () => Promise<string>;
        url: () => string;
        close: () => Promise<void>;
        evaluate: <T, A>(
          pageFunction: (arg: A) => Promise<T> | T,
          arg: A,
        ) => Promise<T>;
        click: (
          selector: string,
          options?: {
            timeout?: number;
            force?: boolean;
            delay?: number;
            button?: 'left' | 'right' | 'middle';
            clickCount?: number;
            position?: { x: number; y: number };
            noWaitAfter?: boolean;
          },
        ) => Promise<void>;
        waitForFunction: <T>(
          pageFunction: string | ((arg: unknown) => T),
          arg?: unknown,
          options?: { timeout?: number; polling?: number | 'raf' },
        ) => Promise<unknown>;
      }>;
    },
    sourceUrl: string,
    jobId?: string,
  ): Promise<{
    variants: CapturedPublicPage[];
    navigationMap: NavigationEdge[];
  }> {
    const MAX_STEPS_PER_WALK = 180;
    const MAX_TOTAL_STATES = 600;
    const MAX_FORKS_TO_EXPLORE = 140;
    const MAX_TIME_MS = 22 * 60 * 1000;

    const baseHost = (() => {
      try {
        return new URL(sourceUrl).host;
      } catch {
        return '';
      }
    })();

    const startedAt = Date.now();
    const deadlineAt = startedAt + MAX_TIME_MS;

    type Action = QuizAction;
    type ForkPoint = {
      atSignature: string;
      sourceStepId: string;
      alternative: Action;
      sourceUrl: string;
    };

    const allStates = new Map<
      string,
      {
        stepId: string;
        title: string;
        url: string;
        html: string;
      }
    >();
    const navigationMap: NavigationEdge[] = [];
    const exploredForks = new Set<string>();
    const pendingForks: ForkPoint[] = [];
    let stepCounter = 0;
    let walksRun = 0;

    const ensureStepId = (signature: string): string => {
      const existing = allStates.get(signature);
      if (existing) return existing.stepId;
      stepCounter += 1;
      return `q${stepCounter.toString().padStart(2, '0')}`;
    };

    const runWalker = async (
      override?: ForkPoint,
    ): Promise<{
      states: Array<{ signature: string; stepId: string }>;
      forks: ForkPoint[];
    }> => {
      walksRun += 1;
      const walkLabel = override
        ? `walker#${walksRun} (alt @${override.sourceStepId} -> "${override.alternative.triggerText.slice(0, 40)}")`
        : `walker#${walksRun} (linear)`;
      this.logger.log(`[clone:${jobId ?? 'n/a'}] ${walkLabel} starting`);

      const states: Array<{ signature: string; stepId: string }> = [];
      const forks: ForkPoint[] = [];

      const page = await context.newPage();
      let prevStepId: string | null = null;
      let prevAction: Action | null = null;
      const seenInThisWalk = new Set<string>();
      const clickedActionsThisWalk = new Set<string>();
      let overrideConsumed = !override;
      let consecutiveFakeLoaders = 0;

      try {
        await page.goto(sourceUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        });
        await page
          .waitForLoadState('networkidle', { timeout: 6000 })
          .catch(() => undefined);
        await page.waitForTimeout(700);

        for (let step = 0; step < MAX_STEPS_PER_WALK; step += 1) {
          if (Date.now() > deadlineAt) {
            this.logger.warn(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} time budget reached at step=${step}`,
            );
            break;
          }
          if (allStates.size >= MAX_TOTAL_STATES) {
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} reached state cap (${MAX_TOTAL_STATES})`,
            );
            break;
          }

          const currentUrl = page.url();
          if (baseHost) {
            try {
              if (new URL(currentUrl).host !== baseHost) {
                this.logger.log(
                  `[clone:${jobId ?? 'n/a'}] ${walkLabel} navigated off-host to ${currentUrl}, stopping`,
                );
                break;
              }
            } catch {
              break;
            }
          }

          // Inject stable ids into the live DOM BEFORE extracting anything.
          // This keeps ids identical across capture + signature + cheerio +
          // editor. We do this every step because React/Vue mount new
          // elements on transition; already-tagged nodes are preserved.
          await page
            .evaluate((script: string) => {
              try {
                // eslint-disable-next-line no-eval
                eval(script);
              } catch {
                /* swallow */
              }
            }, STABLE_ID_BROWSER_JS)
            .catch(() => undefined);

          // Fast quiz-aware readiness probe. Replaces the generic
          // waitForLazyHydration (6-8s per step) with a 400-1400ms poll that
          // checks the three things that actually matter: 1+ interactive
          // element visible, body has text, no loader present. Also returns
          // the SAME payload we need for fingerprint + action enumeration,
          // so one page.evaluate replaces three.
          const snapshot = await this.waitForQuizStepReady(page);
          if (!snapshot) {
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} readiness probe returned null at step=${step}, stopping`,
            );
            break;
          }

          // Fake-loader screens (spinner/skeleton only, zero interactives)
          // are NOT real quiz steps — they're transient frames between real
          // steps. Record nothing, wait a bit longer, and re-probe.
          if (
            snapshot.stepType === 'fake_loader' &&
            snapshot.readiness.interactiveCount === 0
          ) {
            consecutiveFakeLoaders += 1;
            if (consecutiveFakeLoaders >= 6) {
              this.logger.log(
                `[clone:${jobId ?? 'n/a'}] ${walkLabel} loader never resolved after ${consecutiveFakeLoaders} polls, stopping`,
              );
              break;
            }
            this.logger.debug(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} fake loader at step ${step} (#${consecutiveFakeLoaders}), waiting`,
            );
            await page.waitForTimeout(1500);
            continue;
          }
          consecutiveFakeLoaders = 0;

          // Multi-signal fingerprint: path + step type + question-text hash +
          // option-labels hash + counts of each interactive kind. Resilient
          // to React re-renders, progress bar injections, and "selected"
          // class toggles — AND distinct between questions that share the
          // same Continue button (the #1 bug that made no.diet cap at 18).
          const fp = computeQuizFingerprint(snapshot, currentUrl);
          const signature = fp.signature;

          const isFirstSeenInWalk = !seenInThisWalk.has(signature);
          const isFirstSeenGlobal = !allStates.has(signature);
          seenInThisWalk.add(signature);

          // Heavy MHTML capture is done ONLY for newly discovered states —
          // this makes fork exploration dramatically faster (and avoids the
          // "mid-transition MHTML returns stale markup" class of bugs).
          let stateHtml: string;
          if (isFirstSeenGlobal) {
            const mhtmlState = await this.captureMhtmlSelfContained(
              page,
              jobId,
            );
            if (mhtmlState) {
              stateHtml = mhtmlState;
            } else {
              await this.inlineExternalStylesheets(page);
              stateHtml = await page.content();
            }
          } else {
            stateHtml = await page.content();
          }

          const stateTitle = this.extractSourceData(stateHtml).title;
          if (
            this.isBoilerplateTitle(stateTitle) ||
            this.isBoilerplateUrl(currentUrl)
          ) {
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} skipping boilerplate "${stateTitle}"`,
            );
            break;
          }

          let currentStepId: string;
          if (allStates.has(signature)) {
            currentStepId = allStates.get(signature)!.stepId;
          } else if (step === 0) {
            currentStepId = 'main';
            allStates.set(signature, {
              stepId: currentStepId,
              title: stateTitle,
              url: currentUrl,
              html: stateHtml,
            });
          } else {
            currentStepId = ensureStepId(signature);
            allStates.set(signature, {
              stepId: currentStepId,
              title: stateTitle,
              url: currentUrl,
              html: stateHtml,
            });
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} captured step ${currentStepId} "${stateTitle.slice(0, 60)}" (total=${allStates.size})`,
            );
          }

          if (isFirstSeenInWalk) {
            states.push({ signature, stepId: currentStepId });
          }

          // Always record the edge that brought us here, even if the
          // destination state was already seen by another walker. Each
          // option (Solo un par / Esbelto / Atlético / ...) on a quiz
          // screen needs its own edge so the editor can show every
          // navigation chip. We only dedupe by exact (from, selector, to).
          if (prevAction && prevStepId && prevStepId !== currentStepId) {
            const actionKey = prevAction.actionId ?? prevAction.selector;
            const dupKey = `${prevStepId}|${actionKey}|${currentStepId}`;
            const exists = navigationMap.some(
              (e) =>
                `${e.fromStepId}|${e.actionId ?? e.selector}|${e.toStepId}` ===
                dupKey,
            );
            if (!exists) {
              navigationMap.push({
                fromStepId: prevStepId,
                toStepId: currentStepId,
                selector: prevAction.actionId
                  ? `[${CRIAAI_ID_ATTR}="${prevAction.actionId}"]`
                  : prevAction.selector,
                actionId: prevAction.actionId,
                triggerText: prevAction.triggerText,
              });
            }
          }

          // Terminal state: checkout CTA detected. Stop exploring — we do NOT
          // want to actually navigate off-site. The customization pass will
          // pick the checkout button up later and let the user wire their own
          // URL in the editor.
          if (snapshot.stepType === 'checkout_end') {
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} reached checkout-end at ${currentStepId} "${fp.humanTitle.slice(0, 60)}", stopping exploration`,
            );
            break;
          }

          // Actions already came from the same snapshot — zero extra evaluate.
          // This replaces ~230 lines of inline page.evaluate with a single
          // reference, and keeps classification consistent with the fingerprint.
          const actions: Action[] = snapshot.actions;

          if (!actions.length) {
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} no actions on step ${step} (type=${snapshot.stepType}), stopping`,
            );
            break;
          }

          // Loop-protection: if we revisit a signature AND all candidate
          // actions here were already clicked in this walk, we're in a
          // stable cycle. Bail out instead of looping forever.
          if (!isFirstSeenInWalk) {
            const allClicked = actions.every((a) =>
              clickedActionsThisWalk.has(
                `${signature}|${a.actionId ?? a.selector}`,
              ),
            );
            if (allClicked) {
              this.logger.log(
                `[clone:${jobId ?? 'n/a'}] ${walkLabel} revisit with no fresh actions left, stopping`,
              );
              break;
            }
          }

          // Choose action: override has priority once we hit its source
          // signature; otherwise pick the first ranked.
          let chosen: Action;
          if (
            override &&
            !overrideConsumed &&
            override.atSignature === signature
          ) {
            // 1) Try exact selector match (works when DOM is stable).
            // 2) Fallback to matching by trigger text (works even when
            //    the SPA regenerated IDs/classes between visits — very
            //    common for React/Vue quizzes).
            // 3) Last resort: the literal recorded action.
            const exact = actions.find(
              (a) => a.selector === override.alternative.selector,
            );
            const overrideText = (override.alternative.triggerText || '')
              .toLowerCase()
              .trim();
            const byText =
              !exact && overrideText
                ? actions.find(
                    (a) =>
                      (a.triggerText || '').toLowerCase().trim() ===
                      overrideText,
                  )
                : null;
            chosen = exact ?? byText ?? override.alternative;
            overrideConsumed = true;
            const matchedBy = exact ? 'selector' : byText ? 'text' : 'literal';
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} taking override at ${currentStepId} (matched by ${matchedBy}): "${chosen.triggerText.slice(0, 40)}"`,
            );
          } else {
            chosen = actions[0];
          }

          // Record alternatives as forks to explore later (only on first
          // visit to this state — no point re-recording). Fork selection is
          // step-type aware:
          //  - radio/checkbox: forks are the OTHER options (not advance)
          //  - branching:      forks are the other branch buttons
          //  - generic:        any other option/advance candidate
          if (isFirstSeenGlobal) {
            const forkFilter = (a: Action): boolean => {
              if (a.selector === chosen.selector) return false;
              if (
                snapshot.stepType === 'radio_then_continue' ||
                snapshot.stepType === 'checkbox_then_continue'
              ) {
                return a.isOption && !a.isAdvance;
              }
              if (snapshot.stepType === 'branching') {
                return a.isOption;
              }
              return a.isOption || a.isAdvance;
            };
            const alternatives = actions.filter(forkFilter).slice(0, 8);
            for (const alt of alternatives) {
              pendingForks.push({
                atSignature: signature,
                sourceStepId: currentStepId,
                alternative: alt,
                sourceUrl,
              });
            }
          }

          clickedActionsThisWalk.add(
            `${signature}|${chosen.actionId ?? chosen.selector}`,
          );

          // Auto-fill before advancing: ensures any gating selection is made.
          // We only do this when the chosen action is the advance button AND
          // the step type expects a gating selection (radio/checkbox types
          // or generic). On pure BRANCHING screens (no Continue button, each
          // option is its own next-state trigger) autofill would spuriously
          // click a sibling — skip it.
          const needsPreSelect =
            chosen.isAdvance &&
            (snapshot.stepType === 'radio_then_continue' ||
              snapshot.stepType === 'checkbox_then_continue' ||
              snapshot.stepType === 'generic');
          if (needsPreSelect) {
            await this.autoFillSelections(page);
            await this.preSelectClickableOption(page, chosen.selector);
          }

          const beforeUrl = page.url();
          const beforeSnapshot = await page
            .evaluate((_arg: unknown) => {
              const txt =
                document.body && document.body.innerText
                  ? document.body.innerText.slice(0, 800)
                  : '';
              const childCount = document.body
                ? document.body.childElementCount
                : 0;
              return { text: txt, childCount };
            }, null)
            .catch(() => ({ text: '', childCount: 0 }));

          // Click using Playwright's native click — this dispatches real
          // mouse events (scrollIntoView, hover, mousedown, mouseup) which
          // React/Vue/SPA frameworks recognize. The JS-only `el.click()` we
          // had before doesn't trigger React synthetic events on overlays.
          let clickedOk = false;
          try {
            await page.click(chosen.selector, {
              timeout: 4000,
              delay: 30,
            });
            clickedOk = true;
          } catch (err) {
            // Try forcing the click (skips actionability checks)
            try {
              await page.click(chosen.selector, {
                timeout: 2500,
                force: true,
                delay: 30,
              });
              clickedOk = true;
            } catch {
              // Final fallback: native JS click via evaluate
              clickedOk = (await page
                .evaluate((sel: string) => {
                  try {
                    const target = document.querySelector(
                      sel,
                    ) as HTMLElement | null;
                    if (!target) return false;
                    target.scrollIntoView({ block: 'center' });
                    target.click();
                    return true;
                  } catch {
                    return false;
                  }
                }, chosen.selector)
                .catch(() => false)) as boolean;
            }
            void err;
          }

          if (!clickedOk) {
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} click failed at step ${step}, trying next action`,
            );
            // Try the next-best action instead of giving up.
            const fallback = actions.find(
              (a) => a.selector !== chosen.selector,
            );
            if (!fallback) break;
            try {
              await page.click(fallback.selector, {
                timeout: 3000,
                force: true,
                delay: 30,
              });
              chosen = fallback;
              clickedOk = true;
            } catch {
              break;
            }
          }

          // Step-type-aware follow-up: on radio/checkbox quizzes where the
          // fork override picked an OPTION (not the advance button), clicking
          // the option only toggles selection — we still need to click
          // Continue afterwards. Without this, fork-driven walks on multi-
          // step radio quizzes stall because the signature never changes.
          if (
            clickedOk &&
            !chosen.isAdvance &&
            chosen.isOption &&
            (snapshot.stepType === 'radio_then_continue' ||
              snapshot.stepType === 'checkbox_then_continue')
          ) {
            const advanceAction = actions.find((a) => a.isAdvance);
            if (advanceAction && advanceAction.selector !== chosen.selector) {
              await page.waitForTimeout(250);
              try {
                await page.click(advanceAction.selector, {
                  timeout: 3000,
                  force: true,
                  delay: 30,
                });
              } catch {
                /* swallow — main advance-wait below will try alt paths */
              }
            }
          }

          // Wait for the page to actually advance: URL change OR significant
          // body text change OR DOM child count change (React swap).
          const waitDeadline = Date.now() + 6000;
          let advanced = false;
          while (Date.now() < waitDeadline) {
            await page.waitForTimeout(200);
            const newUrl = page.url();
            if (newUrl !== beforeUrl) {
              advanced = true;
              break;
            }
            const after = await page
              .evaluate((_arg: unknown) => {
                const txt =
                  document.body && document.body.innerText
                    ? document.body.innerText.slice(0, 800)
                    : '';
                const childCount = document.body
                  ? document.body.childElementCount
                  : 0;
                return { text: txt, childCount };
              }, null)
              .catch(() => ({ text: '', childCount: 0 }));
            if (
              (after.text && after.text !== beforeSnapshot.text) ||
              after.childCount !== beforeSnapshot.childCount
            ) {
              advanced = true;
              break;
            }
          }
          if (!advanced) {
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} click did not advance at step ${step}, retrying with selection + alt actions`,
            );
            // Strategy: auto-fill again, click any visible option (label/
            // radio/checkbox card) that isn't the advance button, then click
            // the advance button again. This handles multi-select gates and
            // option cards that need to be marked first.
            await this.autoFillSelections(page);
            await this.clickAnyVisibleOption(page, chosen.selector);
            await page.waitForTimeout(400);
            try {
              await page.click(chosen.selector, {
                timeout: 3000,
                force: true,
                delay: 30,
              });
            } catch {
              /* swallow */
            }
            await page.waitForTimeout(900);

            // Re-check advance
            const newUrl2 = page.url();
            if (newUrl2 !== beforeUrl) {
              advanced = true;
            } else {
              const after2 = await page
                .evaluate((_arg: unknown) => {
                  const txt =
                    document.body && document.body.innerText
                      ? document.body.innerText.slice(0, 800)
                      : '';
                  const childCount = document.body
                    ? document.body.childElementCount
                    : 0;
                  return { text: txt, childCount };
                }, null)
                .catch(() => ({ text: '', childCount: 0 }));
              if (
                (after2.text && after2.text !== beforeSnapshot.text) ||
                after2.childCount !== beforeSnapshot.childCount
              ) {
                advanced = true;
              }
            }

            if (!advanced) {
              // Last resort: pick a different advance candidate from the
              // ranked list and try it.
              const altCandidates = actions
                .filter(
                  (a) =>
                    a.selector !== chosen.selector &&
                    (a.kind === 'advance' || a.kind === 'option'),
                )
                .slice(0, 3);
              for (const alt of altCandidates) {
                try {
                  await page.click(alt.selector, {
                    timeout: 2500,
                    force: true,
                    delay: 30,
                  });
                  await page.waitForTimeout(900);
                  const u3 = page.url();
                  const a3 = await page
                    .evaluate((_arg: unknown) => {
                      const txt =
                        document.body && document.body.innerText
                          ? document.body.innerText.slice(0, 800)
                          : '';
                      const cc = document.body
                        ? document.body.childElementCount
                        : 0;
                      return { text: txt, childCount: cc };
                    }, null)
                    .catch(() => ({ text: '', childCount: 0 }));
                  if (
                    u3 !== beforeUrl ||
                    (a3.text && a3.text !== beforeSnapshot.text) ||
                    a3.childCount !== beforeSnapshot.childCount
                  ) {
                    chosen = alt;
                    advanced = true;
                    this.logger.log(
                      `[clone:${jobId ?? 'n/a'}] ${walkLabel} recovered via alternative action "${alt.triggerText.slice(0, 40)}"`,
                    );
                    break;
                  }
                } catch {
                  /* try next */
                }
              }
            }
          }

          await page
            .waitForLoadState('networkidle', { timeout: 3500 })
            .catch(() => undefined);

          prevStepId = currentStepId;
          prevAction = chosen;
        }
      } catch (error) {
        this.logger.warn(
          `[clone:${jobId ?? 'n/a'}] ${walkLabel} error: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      } finally {
        await page.close().catch(() => undefined);
      }

      this.logger.log(
        `[clone:${jobId ?? 'n/a'}] ${walkLabel} done: states+=${states.length} totalStates=${allStates.size}`,
      );
      return { states, forks };
    };

    // 1) Linear walk
    await runWalker();

    // 2) Fan-out: explore alternatives at registered fork points — in
    // parallel batches. Each walker owns its own Playwright page under the
    // shared browser context, so N=3 roughly divides the wall time by 3.
    // JS is single-threaded so the shared Map/Set/Array mutations inside
    // `runWalker` remain race-free (no await between related reads/writes).
    const CONCURRENT_FORKS = 3;
    let forksExplored = 0;
    while (
      pendingForks.length &&
      forksExplored < MAX_FORKS_TO_EXPLORE &&
      Date.now() < deadlineAt &&
      allStates.size < MAX_TOTAL_STATES
    ) {
      const batch: ForkPoint[] = [];
      while (batch.length < CONCURRENT_FORKS && pendingForks.length > 0) {
        const f = pendingForks.shift()!;
        const key = `${f.atSignature}|${f.alternative.selector}`;
        if (exploredForks.has(key)) continue;
        exploredForks.add(key);
        batch.push(f);
      }
      if (!batch.length) break;
      forksExplored += batch.length;
      await Promise.all(batch.map((f) => runWalker(f)));
    }

    // 3) Build variants from collected states (skip 'main' — already in
    // the public-pages collection).
    const variants: CapturedPublicPage[] = [];
    for (const [, state] of allStates) {
      if (state.stepId === 'main') continue;
      variants.push({
        url: `${state.url}#quiz-${state.stepId}`,
        title: `${state.title} · ${state.stepId.toUpperCase()}`,
        html: this.prepareCloneHtml(state.html, state.url),
        renderMode: 'frozen',
        stepId: state.stepId,
      });
    }

    this.logger.log(
      `[clone:${jobId ?? 'n/a'}] quiz walkers done: walks=${walksRun} states=${allStates.size} edges=${navigationMap.length} forksExplored=${forksExplored} pendingForksLeft=${pendingForks.length}`,
    );

    // Optional LLM audit — we feed the final state list to Ollama and log
    // any suggested gaps. This never blocks or rolls back; it's a hint.
    try {
      const summary = Array.from(allStates.values()).map((s) => ({
        stepId: s.stepId,
        title: s.title,
        visibleText: load(s.html).root().text().slice(0, 400),
      }));
      const gaps = await this.llmAssistService.findQuizGaps(summary);
      if (gaps && gaps.length) {
        this.logger.log(
          `[clone:${jobId ?? 'n/a'}] LLM flagged ${gaps.length} potential gap(s): ${gaps
            .slice(0, 4)
            .map(
              (g) =>
                `${g.fromStepId}→"${g.suggestedActionText.slice(0, 24)}" (${g.reason.slice(0, 40)})`,
            )
            .join(' | ')}`,
        );
      }
    } catch (err) {
      this.logger.debug(
        `[clone:${jobId ?? 'n/a'}] LLM audit skipped: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }

    return { variants, navigationMap };
  }

  /**
   * Pre-fills the page so that a subsequent click on a "Continue" / "Next"
   * button will succeed even when the form requires at least one selection.
   * Handles real radios, real checkboxes (when none is checked yet), labels
   * wrapping inputs, and ARIA-style cards (role="radio"/"checkbox").
   */
  private async autoFillSelections(page: {
    evaluate: <T, A>(
      pageFunction: (arg: A) => Promise<T> | T,
      arg: A,
    ) => Promise<T>;
  }): Promise<void> {
    await page.evaluate((_arg: unknown) => {
      try {
        const isVisible = (el: Element): boolean => {
          if (!(el instanceof HTMLElement)) return false;
          const rect = el.getBoundingClientRect();
          if (rect.width <= 4 || rect.height <= 4) return false;
          const cs = getComputedStyle(el);
          return (
            cs.display !== 'none' &&
            cs.visibility !== 'hidden' &&
            parseFloat(cs.opacity || '1') >= 0.05
          );
        };

        // 1. Real radio inputs grouped by name.
        const radios = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
        );
        const radioGroups = new Map<string, HTMLInputElement[]>();
        for (const r of radios) {
          const key =
            r.name ||
            r.closest('form, fieldset, [role="radiogroup"]')?.tagName ||
            '__no_group__';
          const arr = radioGroups.get(key) ?? [];
          arr.push(r);
          radioGroups.set(key, arr);
        }
        for (const [, arr] of radioGroups) {
          if (arr.some((r) => r.checked)) continue;
          const first = arr.find(
            (r) => isVisible(r) || (r as HTMLElement).offsetParent,
          );
          if (first && !first.disabled) {
            // Prefer clicking the wrapping label if any (for styled radios)
            const lbl =
              first.closest('label') ||
              document.querySelector(`label[for="${first.id}"]`);
            const target = (lbl as HTMLElement) || (first as HTMLElement);
            try {
              target.click();
            } catch {
              first.click();
            }
          }
        }

        // 2. ARIA radio cards (role="radio"). Pick first per radiogroup.
        const ariaRadios = Array.from(
          document.querySelectorAll<HTMLElement>('[role="radio"]'),
        ).filter(isVisible);
        const seenGroups = new Set<HTMLElement>();
        for (const card of ariaRadios) {
          const group =
            (card.closest('[role="radiogroup"]') as HTMLElement) ||
            (card.parentElement as HTMLElement);
          if (!group || seenGroups.has(group)) continue;
          seenGroups.add(group);
          const checked = group.querySelector(
            '[role="radio"][aria-checked="true"]',
          );
          if (checked) continue;
          try {
            card.click();
          } catch {
            /* swallow */
          }
        }

        // 3. Multi-select checkbox-style: if no checkbox in the visible form
        // is checked, click the first label/card so the "Continue" button is
        // enabled. We deliberately avoid touching pages where the user
        // already selected something.
        const realCheckboxes = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
        ).filter(isVisible);
        const ariaCheckboxes = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="checkbox"], [role="switch"]',
          ),
        ).filter(isVisible);

        const anyRealChecked = realCheckboxes.some((c) => c.checked);
        const anyAriaChecked = ariaCheckboxes.some(
          (c) => c.getAttribute('aria-checked') === 'true',
        );

        if (!anyRealChecked && realCheckboxes.length > 0) {
          const first = realCheckboxes[0];
          const lbl =
            first.closest('label') ||
            document.querySelector(`label[for="${first.id}"]`);
          const target = (lbl as HTMLElement) || (first as HTMLElement);
          try {
            target.click();
          } catch {
            first.click();
          }
        }
        if (!anyAriaChecked && ariaCheckboxes.length > 0) {
          try {
            ariaCheckboxes[0].click();
          } catch {
            /* swallow */
          }
        }
      } catch {
        /* swallow */
      }
    }, null);
  }

  /**
   * If the chosen action is a "Continue" button but there are visible option
   * cards (radios, labels wrapping inputs, role=option) and none seem to be
   * selected yet, pre-click the first one. This is what a real user does on
   * cards with no obvious "checked" indicator.
   *
   * The advance selector is passed in so we don't accidentally pre-click it.
   */
  private async preSelectClickableOption(
    page: {
      evaluate: <T, A>(
        pageFunction: (arg: A) => Promise<T> | T,
        arg: A,
      ) => Promise<T>;
    },
    advanceSelector: string,
  ): Promise<void> {
    await page.evaluate(
      (arg: { advance: string }) => {
        try {
          const isVisible = (el: Element): boolean => {
            if (!(el instanceof HTMLElement)) return false;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 4 || rect.height <= 4) return false;
            const cs = getComputedStyle(el);
            return (
              cs.display !== 'none' &&
              cs.visibility !== 'hidden' &&
              parseFloat(cs.opacity || '1') >= 0.05
            );
          };

          // If any selection-style element is already marked, do nothing.
          const anyChecked =
            document.querySelector(
              'input[type="radio"]:checked, input[type="checkbox"]:checked',
            ) ||
            document.querySelector(
              '[role="radio"][aria-checked="true"], [role="checkbox"][aria-checked="true"], [role="option"][aria-selected="true"]',
            ) ||
            document.querySelector(
              '[data-checked="true"], [data-selected="true"], .selected, .is-selected, .active',
            );
          if (anyChecked) return;

          let advanceEl: Element | null = null;
          try {
            advanceEl = document.querySelector(arg.advance);
          } catch {
            advanceEl = null;
          }

          // Look for typical "option card" selectors used in modern quizzes.
          const optionSelectors = [
            'label:has(input[type="radio"])',
            'label:has(input[type="checkbox"])',
            '[role="radio"]',
            '[role="option"]',
            '[role="checkbox"]',
            'button[data-option]',
            'button[role="button"]',
          ];
          for (const sel of optionSelectors) {
            let candidates: HTMLElement[] = [];
            try {
              candidates = Array.from(
                document.querySelectorAll<HTMLElement>(sel),
              );
            } catch {
              continue;
            }
            const candidate = candidates.find(
              (c) =>
                isVisible(c) &&
                c !== advanceEl &&
                !c.contains(advanceEl as Node),
            );
            if (candidate) {
              try {
                candidate.click();
              } catch {
                /* swallow */
              }
              return;
            }
          }
        } catch {
          /* swallow */
        }
      },
      { advance: advanceSelector },
    );
  }

  /**
   * Click *any* visible option-like element that's not the advance button
   * itself. Used as a recovery step when "Continue" doesn't advance.
   */
  private async clickAnyVisibleOption(
    page: {
      evaluate: <T, A>(
        pageFunction: (arg: A) => Promise<T> | T,
        arg: A,
      ) => Promise<T>;
    },
    advanceSelector: string,
  ): Promise<void> {
    await page.evaluate(
      (arg: { advance: string }) => {
        try {
          const isVisible = (el: Element): boolean => {
            if (!(el instanceof HTMLElement)) return false;
            const rect = el.getBoundingClientRect();
            if (rect.width <= 4 || rect.height <= 4) return false;
            const cs = getComputedStyle(el);
            return (
              cs.display !== 'none' &&
              cs.visibility !== 'hidden' &&
              parseFloat(cs.opacity || '1') >= 0.05
            );
          };
          let advanceEl: Element | null = null;
          try {
            advanceEl = document.querySelector(arg.advance);
          } catch {
            advanceEl = null;
          }
          const candidates = Array.from(
            document.querySelectorAll<HTMLElement>(
              'label, [role="radio"], [role="option"], [role="checkbox"], button, [role="button"]',
            ),
          );
          for (const c of candidates) {
            if (!isVisible(c)) continue;
            if (c === advanceEl) continue;
            if (advanceEl && c.contains(advanceEl)) continue;
            if (advanceEl && advanceEl.contains(c)) continue;
            try {
              c.click();
              return;
            } catch {
              /* try next */
            }
          }
        } catch {
          /* swallow */
        }
      },
      { advance: advanceSelector },
    );
  }

  private async captureMhtmlSelfContained(
    page: unknown,
    jobId?: string,
  ): Promise<string | null> {
    try {
      const pageAny = page as {
        context?: () => {
          newCDPSession?: (target: unknown) => Promise<{
            send: (
              method: string,
              params?: Record<string, unknown>,
            ) => Promise<Record<string, unknown>>;
            detach: () => Promise<void>;
          }>;
        };
      };
      if (!pageAny?.context || typeof pageAny.context !== 'function') {
        return null;
      }
      const context = pageAny.context();
      if (!context || typeof context.newCDPSession !== 'function') {
        return null;
      }
      const cdp = await context.newCDPSession(pageAny);
      try {
        const result = await cdp.send('Page.captureSnapshot', {
          format: 'mhtml',
        });
        const data =
          typeof (result as { data?: unknown }).data === 'string'
            ? (result as { data: string }).data
            : null;
        if (!data) return null;
        const html = mhtmlToSelfContainedHtml(data);
        if (html) {
          this.logger.log(
            `[clone:${jobId ?? 'n/a'}] MHTML self-contained snapshot bytes=${html.length}`,
          );
        }
        return html;
      } finally {
        try {
          await cdp.detach();
        } catch {
          /* ignore detach errors */
        }
      }
    } catch (error) {
      this.logger.warn(
        `[clone:${jobId ?? 'n/a'}] MHTML capture failed: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    }
  }

  private async captureRenderedStateSnapshot(
    context: {
      newPage: () => Promise<{
        goto: (
          url: string,
          options?: { waitUntil?: 'domcontentloaded'; timeout?: number },
        ) => Promise<unknown>;
        waitForLoadState: (
          state: 'networkidle',
          options?: { timeout?: number },
        ) => Promise<unknown>;
        waitForTimeout: (ms: number) => Promise<void>;
        content: () => Promise<string>;
        close: () => Promise<void>;
        evaluate: <T, A>(
          pageFunction: (arg: A) => Promise<T> | T,
          arg: A,
        ) => Promise<T>;
        url: () => string;
      }>;
    },
    stateUrl: string,
    jobId?: string,
  ): Promise<{ html: string; url: string } | null> {
    const page = await context.newPage();
    try {
      await page.goto(stateUrl, {
        waitUntil: 'domcontentloaded',
        timeout: 18000,
      });
      await page
        .waitForLoadState('networkidle', { timeout: 5000 })
        .catch(() => undefined);
      await this.scrollPageForLazyContent(page, { resetToTop: false });
      await this.materializeDynamicAssets(page);
      await this.waitForLazyHydration(page, jobId);
      await page.waitForTimeout(500);
      await this.inlineExternalStylesheets(page);
      return {
        html: await page.content(),
        url: page.url(),
      };
    } catch (error) {
      this.logger.warn(
        `[clone:${jobId ?? 'n/a'}] state snapshot fallback for ${stateUrl}: ${error instanceof Error ? error.message : 'unknown error'}`,
      );
      return null;
    } finally {
      await page.close();
    }
  }

  private extractPublicLinks(html: string, sourceUrl: string): string[] {
    const $ = load(html);
    const source = new URL(sourceUrl);
    const urls = new Set<string>();
    $('a[href]')
      .toArray()
      .forEach((node) => {
        const $node = $(node);
        const href = $node.attr('href')?.trim();
        if (!href) {
          return;
        }
        if (
          href.startsWith('#') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('javascript:')
        ) {
          return;
        }
        const anchorText =
          $node.text().trim() ||
          $node.attr('aria-label')?.trim() ||
          $node.attr('title')?.trim() ||
          '';
        try {
          const parsed = new URL(href, sourceUrl);
          if (parsed.host !== source.host) {
            return;
          }
          parsed.hash = '';
          const normalized = parsed.toString();
          if (normalized === source.toString()) {
            return;
          }
          if (this.isBoilerplateUrl(normalized, anchorText)) {
            return;
          }
          urls.add(normalized);
        } catch {
          return;
        }
      });
    return [...urls];
  }

  private async scrollPageForLazyContent(
    page: {
      evaluate: (...args: unknown[]) => Promise<unknown>;
    },
    options?: { resetToTop?: boolean },
  ) {
    const resetToTop = options?.resetToTop ?? false;
    await page.evaluate(async (shouldReset) => {
      const sleep = (ms: number) =>
        new Promise((resolve) => {
          setTimeout(resolve, ms);
        });
      let previousHeight = 0;
      let unchanged = 0;
      for (let i = 0; i < 14; i += 1) {
        window.scrollBy(
          0,
          Math.max(420, Math.floor(window.innerHeight * 0.85)),
        );
        await sleep(260);
        const currentHeight = document.body.scrollHeight;
        if (currentHeight === previousHeight) {
          unchanged += 1;
          if (unchanged >= 3) {
            break;
          }
        } else {
          unchanged = 0;
        }
        previousHeight = currentHeight;
      }
      if (shouldReset) {
        window.scrollTo(0, 0);
        await sleep(120);
      }
    }, resetToTop);
  }

  private async captureBestRenderedSnapshot(
    page: {
      evaluate: (...args: unknown[]) => Promise<unknown>;
      waitForTimeout: (ms: number) => Promise<void>;
      content: () => Promise<string>;
      url: () => string;
    },
    jobId?: string,
  ): Promise<{ html: string; url: string; score: number }> {
    let bestScore = -1;
    let bestHtml = await page.content();
    let bestUrl = page.url();

    const evaluateScore = async () => {
      const score = (await page.evaluate(() => {
        const visibleArea = (el: Element) => {
          const rect = el.getBoundingClientRect();
          return rect.width * rect.height;
        };
        const mediaScore =
          Array.from(document.querySelectorAll('img')).filter(
            (img) =>
              (img.getAttribute('src') ||
                (img as HTMLImageElement).currentSrc) &&
              visibleArea(img) > 2000,
          ).length *
            2 +
          Array.from(document.querySelectorAll('iframe')).filter(
            (frame) => frame.getAttribute('src') && visibleArea(frame) > 4000,
          ).length *
            4 +
          Array.from(document.querySelectorAll('video')).filter(
            (video) =>
              (video.getAttribute('src') ||
                (video as HTMLVideoElement).currentSrc ||
                video.getAttribute('poster')) &&
              visibleArea(video) > 4000,
          ).length *
            4;
        const richBackgrounds = Array.from(
          document.querySelectorAll<HTMLElement>('*'),
        ).filter((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.backgroundImage &&
            style.backgroundImage !== 'none' &&
            visibleArea(el) > 12000
          );
        }).length;
        const hasAnchor = Array.from(
          document.querySelectorAll<HTMLElement>('h1,h2,h3,p,span,strong'),
        ).some((el) =>
          (el.textContent ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .includes('o que voce acompanha'),
        );
        return mediaScore + richBackgrounds + (hasAnchor ? 20 : 0);
      })) as number;
      return score;
    };

    for (let i = 0; i < 12; i += 1) {
      await this.materializeDynamicAssets(page);
      const score = await evaluateScore();
      if (score > bestScore) {
        bestScore = score;
        bestHtml = await page.content();
        bestUrl = page.url();
      }
      await page.evaluate(() => {
        window.scrollBy(0, Math.max(360, Math.floor(window.innerHeight * 0.7)));
      });
      await page.waitForTimeout(320);
    }

    this.logger.log(
      `[clone:${jobId ?? 'n/a'}] best lazy snapshot score=${bestScore}`,
    );
    return { html: bestHtml, url: bestUrl, score: bestScore };
  }

  private async materializeDynamicAssets(page: {
    evaluate: (...args: unknown[]) => Promise<unknown>;
  }) {
    await page.evaluate(() => {
      const captureComputedBackground = (el: HTMLElement) => {
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;
        if (!bgImage || bgImage === 'none') {
          return;
        }
        const existing = el.style.backgroundImage;
        if (!existing || existing === 'none') {
          el.style.backgroundImage = bgImage;
        }
        if (!el.style.backgroundSize) {
          el.style.backgroundSize = style.backgroundSize;
        }
        if (!el.style.backgroundPosition) {
          el.style.backgroundPosition = style.backgroundPosition;
        }
        if (!el.style.backgroundRepeat) {
          el.style.backgroundRepeat = style.backgroundRepeat;
        }
      };

      document.querySelectorAll<HTMLElement>('*').forEach((el) => {
        captureComputedBackground(el);
      });

      document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
        if (!img.getAttribute('src') && img.currentSrc) {
          img.setAttribute('src', img.currentSrc);
        }
      });

      document.querySelectorAll<HTMLVideoElement>('video').forEach((video) => {
        if (!video.getAttribute('poster')) {
          const poster = video.poster;
          if (poster) {
            video.setAttribute('poster', poster);
          }
        }
        if (!video.getAttribute('src') && video.currentSrc) {
          video.setAttribute('src', video.currentSrc);
        }
      });

      document
        .querySelectorAll<HTMLIFrameElement>('iframe')
        .forEach((frame) => {
          if (!frame.getAttribute('src') && frame.src) {
            frame.setAttribute('src', frame.src);
          }
        });
    });
  }

  private async inlineExternalStylesheets(page: {
    evaluate: (...args: unknown[]) => Promise<unknown>;
  }) {
    await page.evaluate(async () => {
      const resolveUrl = (value: string) => {
        try {
          return new URL(value, document.baseURI).toString();
        } catch {
          return value;
        }
      };

      const rewriteCssUrls = (css: string, baseUrl: string) =>
        css.replace(
          /url\((?!['"]?data:)([^)]+)\)/gi,
          (match, rawUrl: string) => {
            const trimmed = rawUrl.trim().replace(/^['"]|['"]$/g, '');
            if (!trimmed) {
              return match;
            }
            try {
              const abs = new URL(trimmed, baseUrl).toString();
              return `url("${abs}")`;
            } catch {
              return match;
            }
          },
        );

      const links = Array.from(
        document.querySelectorAll<HTMLLinkElement>(
          'link[rel="stylesheet"][href], link[rel~="stylesheet"][href]',
        ),
      );

      for (const link of links) {
        const href = link.getAttribute('href');
        if (!href) continue;
        const absoluteHref = resolveUrl(href);
        try {
          const response = await fetch(absoluteHref, {
            credentials: 'omit',
            mode: 'cors',
          });
          if (!response.ok) continue;
          const cssText = await response.text();
          const rewritten = rewriteCssUrls(cssText, absoluteHref);
          const style = document.createElement('style');
          style.setAttribute('data-inlined-from', absoluteHref);
          if (link.media) style.setAttribute('media', link.media);
          style.textContent = rewritten;
          link.parentNode?.replaceChild(style, link);
        } catch {
          // swallow fetch errors, keep original link as fallback
        }
      }

      document.querySelectorAll<HTMLStyleElement>('style').forEach((style) => {
        const content = style.textContent;
        if (!content) return;
        style.textContent = rewriteCssUrls(content, document.baseURI);
      });
    });
  }

  private absolutizeUrls($: ReturnType<typeof load>, baseUrl: string) {
    const resolve = (value: string) => {
      try {
        return new URL(value, baseUrl).toString();
      } catch {
        return value;
      }
    };
    const resolveSrcset = (value: string) =>
      value
        .split(',')
        .map((entry) => {
          const trimmed = entry.trim();
          if (!trimmed) return '';
          const parts = trimmed.split(/\s+/);
          const url = parts[0];
          const descriptor = parts.slice(1).join(' ');
          const absolute = resolve(url);
          return descriptor ? `${absolute} ${descriptor}` : absolute;
        })
        .filter(Boolean)
        .join(', ');

    $('[src]').each((_, node) => {
      const el = $(node);
      const value = el.attr('src');
      if (!value || value.startsWith('data:') || value.startsWith('blob:'))
        return;
      el.attr('src', resolve(value));
    });
    $('[srcset]').each((_, node) => {
      const el = $(node);
      const value = el.attr('srcset');
      if (!value) return;
      el.attr('srcset', resolveSrcset(value));
    });
    $('[poster]').each((_, node) => {
      const el = $(node);
      const value = el.attr('poster');
      if (!value || value.startsWith('data:')) return;
      el.attr('poster', resolve(value));
    });
    $('link[href]').each((_, node) => {
      const el = $(node);
      const value = el.attr('href');
      if (!value) return;
      if (value.startsWith('data:') || value.startsWith('#')) return;
      el.attr('href', resolve(value));
    });
    $('a[href]').each((_, node) => {
      const el = $(node);
      const value = el.attr('href');
      if (!value) return;
      if (
        value.startsWith('#') ||
        value.startsWith('mailto:') ||
        value.startsWith('tel:') ||
        value.startsWith('javascript:')
      ) {
        return;
      }
      el.attr('href', resolve(value));
    });
  }

  private async waitForLazyHydration(
    page: {
      evaluate: (...args: unknown[]) => Promise<unknown>;
      waitForTimeout: (ms: number) => Promise<void>;
    },
    jobId?: string,
  ) {
    let previousSignal = -1;
    let stableRounds = 0;
    for (let attempt = 0; attempt < 18; attempt += 1) {
      const snapshot = (await page.evaluate(() => {
        const visibleArea = (el: Element) => {
          const rect = el.getBoundingClientRect();
          return rect.width * rect.height;
        };
        const imgsReady = Array.from(document.querySelectorAll('img')).filter(
          (img) =>
            (img.getAttribute('src') || (img as HTMLImageElement).currentSrc) &&
            visibleArea(img) > 2000,
        ).length;
        const framesReady = Array.from(
          document.querySelectorAll('iframe'),
        ).filter(
          (frame) => frame.getAttribute('src') && visibleArea(frame) > 5000,
        ).length;
        const videosReady = Array.from(
          document.querySelectorAll('video'),
        ).filter(
          (video) =>
            (video.getAttribute('src') ||
              (video as HTMLVideoElement).currentSrc ||
              video.getAttribute('poster')) &&
            visibleArea(video) > 5000,
        ).length;
        const bgReady = Array.from(
          document.querySelectorAll<HTMLElement>('*'),
        ).filter((el) => {
          const style = window.getComputedStyle(el);
          return (
            style.backgroundImage &&
            style.backgroundImage !== 'none' &&
            visibleArea(el) > 12000
          );
        }).length;
        const loadingHints = document.querySelectorAll(
          '[loading="lazy"], [data-src], [data-lazy], [data-lazy-src], [class*="skeleton"], [class*="placeholder"], [class*="shimmer"]',
        ).length;
        const sectionAnchor = Array.from(
          document.querySelectorAll<HTMLElement>('h1,h2,h3,p,span,strong'),
        ).some((el) =>
          (el.textContent ?? '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .includes('o que voce acompanha'),
        );
        return {
          imgsReady,
          framesReady,
          videosReady,
          bgReady,
          loadingHints,
          sectionAnchor,
        };
      })) as {
        imgsReady: number;
        framesReady: number;
        videosReady: number;
        bgReady: number;
        loadingHints: number;
        sectionAnchor: boolean;
      };

      const signal =
        snapshot.imgsReady * 2 +
        snapshot.framesReady * 3 +
        snapshot.videosReady * 3 +
        snapshot.bgReady;
      const hasMinimumRichContent =
        signal >= 20 || (snapshot.sectionAnchor && signal >= 10);

      if (signal <= previousSignal) {
        stableRounds += 1;
      } else {
        stableRounds = 0;
      }
      previousSignal = signal;

      if (hasMinimumRichContent && stableRounds >= 2) {
        this.logger.log(
          `[clone:${jobId ?? 'n/a'}] lazy hydration stabilized (signal=${signal}, loadingHints=${snapshot.loadingHints})`,
        );
        return;
      }

      await page.evaluate(() => {
        window.scrollBy(0, Math.max(420, Math.floor(window.innerHeight * 0.8)));
      });
      await page.waitForTimeout(420);
    }

    this.logger.warn(
      `[clone:${jobId ?? 'n/a'}] lazy hydration reached timeout, proceeding with best effort snapshot`,
    );
  }

  /**
   * Quiz-specific readiness probe. Far cheaper than `waitForLazyHydration`
   * because we only care about three things:
   *   - at least one interactive element is visible
   *   - the body has some text (question rendered)
   *   - no explicit loader/skeleton is visible
   * Typical return time: 400-1400ms for SPAs like no.diet, vs 6-8s for the
   * generic hydration probe. We poll the `QUIZ_STATE_BROWSER_JS` payload so
   * the same evaluation code feeds readiness + fingerprint later.
   */
  private async waitForQuizStepReady(
    page: {
      evaluate: <T, A>(
        pageFunction: (arg: A) => Promise<T> | T,
        arg: A,
      ) => Promise<T>;
      waitForTimeout: (ms: number) => Promise<void>;
    },
    options: { timeoutMs?: number; minInteractives?: number } = {},
  ): Promise<QuizStateSnapshot | null> {
    const timeoutMs = options.timeoutMs ?? 4500;
    const minInteractives = options.minInteractives ?? 1;
    const deadline = Date.now() + timeoutMs;
    let lastSnapshot: QuizStateSnapshot | null = null;
    let lastChildCount = -1;
    let stableRounds = 0;
    while (Date.now() < deadline) {
      const snapshot = (await page
        .evaluate((script: string) => {
          try {
            // eslint-disable-next-line no-eval
            return eval(script);
          } catch {
            return null;
          }
        }, QUIZ_STATE_BROWSER_JS)
        .catch(() => null)) as QuizStateSnapshot | null;
      if (!snapshot) {
        await page.waitForTimeout(220);
        continue;
      }
      lastSnapshot = snapshot;
      const { readiness } = snapshot;
      const interactivesOk = readiness.interactiveCount >= minInteractives;
      const hasTextOrQuestion =
        readiness.textLen >= 30 || readiness.hasQuestion;
      const loaderAbsent = !readiness.hasLoader;
      if (interactivesOk && hasTextOrQuestion && loaderAbsent) {
        if (readiness.domChildCount === lastChildCount) {
          stableRounds += 1;
          if (stableRounds >= 1) return snapshot;
        } else {
          stableRounds = 0;
          lastChildCount = readiness.domChildCount;
        }
      } else {
        stableRounds = 0;
        lastChildCount = readiness.domChildCount;
      }
      await page.waitForTimeout(220);
    }
    return lastSnapshot;
  }

  private async clickQuizProgressiveActions(page: {
    evaluate: <T, A>(
      pageFunction: (arg: A) => Promise<T> | T,
      arg: A,
    ) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
    waitForLoadState: (
      state: 'networkidle',
      options?: { timeout?: number },
    ) => Promise<void>;
  }) {
    const progressLabels = [
      'começar',
      'iniciar',
      'avançar',
      'proximo',
      'próximo',
      'continuar',
      'prosseguir',
      'next',
      'start',
      'begin',
      'quero',
    ];

    for (let step = 0; step < 6; step += 1) {
      const clicked = await page.evaluate((labels) => {
        const allCandidates = Array.from(
          document.querySelectorAll<HTMLElement>(
            'button, a, [role="button"], input[type="submit"], input[type="button"]',
          ),
        );
        const getText = (el: HTMLElement) => {
          const value = el instanceof HTMLInputElement ? (el.value ?? '') : '';
          return `${el.textContent ?? ''} ${value}`
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        };

        for (const candidate of allCandidates) {
          if (candidate.dataset.criaaiClicked === '1') {
            continue;
          }
          const rect = candidate.getBoundingClientRect();
          const visible =
            rect.width > 8 &&
            rect.height > 8 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.left < window.innerWidth &&
            rect.top < window.innerHeight;
          if (!visible) {
            continue;
          }
          const text = getText(candidate);
          if (!text) {
            continue;
          }
          const shouldClick = labels.some((label) => text.includes(label));
          if (!shouldClick) {
            continue;
          }
          candidate.dataset.criaaiClicked = '1';
          candidate.click();
          return text;
        }
        return null;
      }, progressLabels);

      if (!clicked) {
        break;
      }
      await page.waitForTimeout(800);
      await page
        .waitForLoadState('networkidle', { timeout: 3500 })
        .catch(() => undefined);
    }
  }

  private async exploreInteractiveFlow(
    page: {
      evaluate: <T, A>(
        pageFunction: (arg: A) => Promise<T> | T,
        arg: A,
      ) => Promise<T>;
      waitForTimeout: (ms: number) => Promise<void>;
      waitForLoadState: (
        state: 'networkidle',
        options?: { timeout?: number },
      ) => Promise<void>;
      url: () => string;
    },
    sourceUrl: string,
    jobId?: string,
  ) {
    const labels = [
      'menu',
      'abrir menu',
      'open menu',
      'começar',
      'iniciar',
      'continuar',
      'próximo',
      'proximo',
      'avançar',
      'next',
      'start',
      'begin',
      'quero',
      'sim',
      'não',
      'nao',
      'opção',
      'opcao',
      'ver mais',
      'saiba mais',
    ];

    const sourceHost = new URL(sourceUrl).host;

    for (let step = 0; step < 14; step += 1) {
      const clickResult = await page.evaluate(
        ({ knownLabels, host }) => {
          const normalize = (value: string) =>
            value
              .toLowerCase()
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '')
              .replace(/\s+/g, ' ')
              .trim();
          const all = Array.from(
            document.querySelectorAll<HTMLElement>(
              [
                'button',
                'a',
                '[role="button"]',
                '[role="tab"]',
                'summary',
                '[aria-expanded]',
                '[data-testid*="menu"]',
                '[class*="menu"]',
                '[class*="accordion"]',
                '[class*="dropdown"]',
                '[class*="quiz"]',
              ].join(','),
            ),
          );
          const safeHost = (href: string) => {
            try {
              const parsed = new URL(href, window.location.href);
              return parsed.host === host;
            } catch {
              return false;
            }
          };
          const textOf = (el: HTMLElement) => {
            const value =
              el instanceof HTMLInputElement ? (el.value ?? '') : '';
            return normalize(`${el.textContent ?? ''} ${value}`);
          };
          const isVisible = (el: HTMLElement) => {
            const rect = el.getBoundingClientRect();
            const styles = window.getComputedStyle(el);
            return (
              rect.width > 8 &&
              rect.height > 8 &&
              rect.bottom > 0 &&
              rect.right > 0 &&
              rect.left < window.innerWidth &&
              rect.top < window.innerHeight &&
              styles.visibility !== 'hidden' &&
              styles.display !== 'none'
            );
          };

          for (const candidate of all) {
            if (candidate.dataset.criaaiExploreClicked === '1') {
              continue;
            }
            if (!isVisible(candidate)) {
              continue;
            }

            const normalizedText = textOf(candidate);
            const classHint = normalize(candidate.className || '');
            const ariaExpanded = candidate.getAttribute('aria-expanded');
            const role = normalize(candidate.getAttribute('role') || '');
            const href = candidate.getAttribute('href') || '';
            const isAnchor = candidate.tagName.toLowerCase() === 'a';
            const authLikeByText =
              normalizedText.includes('login') ||
              normalizedText.includes('entrar') ||
              normalizedText.includes('acessar') ||
              normalizedText.includes('sign in') ||
              normalizedText.includes('signin');
            const authLikeByHref =
              href.toLowerCase().includes('login') ||
              href.toLowerCase().includes('signin') ||
              href.toLowerCase().includes('auth');

            if (isAnchor && href && !safeHost(href) && !href.startsWith('#')) {
              continue;
            }
            if (authLikeByText || authLikeByHref) {
              continue;
            }

            const labeled = knownLabels.some((label) =>
              normalizedText.includes(label),
            );
            const structuralHint =
              classHint.includes('menu') ||
              classHint.includes('accordion') ||
              classHint.includes('dropdown') ||
              classHint.includes('quiz') ||
              role.includes('tab') ||
              ariaExpanded === 'false' ||
              href.startsWith('#');

            if (!labeled && !structuralHint) {
              continue;
            }

            candidate.dataset.criaaiExploreClicked = '1';
            candidate.click();
            return {
              clicked: true,
              text: normalizedText,
              hint: classHint.slice(0, 80),
            };
          }

          return { clicked: false };
        },
        {
          knownLabels: labels,
          host: sourceHost,
        },
      );

      if (!clickResult.clicked) {
        break;
      }

      this.logger.debug(
        `[clone:${jobId ?? 'n/a'}] interactive-step=${step + 1} click="${clickResult.text ?? ''}" hint="${clickResult.hint ?? ''}" url="${page.url()}"`,
      );

      await page.waitForTimeout(850);
      await page
        .waitForLoadState('networkidle', { timeout: 3500 })
        .catch(() => undefined);
      await this.scrollPageForLazyContent(page);
    }
  }

  private isAuthLikeUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase();
      return (
        path.includes('/login') ||
        path.includes('/signin') ||
        path.includes('/auth') ||
        path.includes('/account') ||
        path.includes('/acesso') ||
        path.includes('/entrar')
      );
    } catch {
      return false;
    }
  }

  private isBoilerplateTitle(title: string): boolean {
    if (!title) return false;
    const t = title.toLowerCase();
    const KEYS = [
      'privacy policy',
      'política de privacidade',
      'politica de privacidade',
      'terms of service',
      'terms of use',
      'termos de uso',
      'termos de serviço',
      'termos de servico',
      'cookie policy',
      'política de cookies',
      'politica de cookies',
      'aviso legal',
      'legal notice',
      'imprint',
      'impressum',
      'refund policy',
      'política de reembolso',
      'politica de reembolso',
    ];
    return KEYS.some((k) => t.includes(k));
  }

  private isBoilerplateUrl(url: string, anchorText?: string): boolean {
    const PATH_PATTERNS = [
      'privacy',
      'privacidade',
      'politica',
      'policies',
      'policy',
      'terms',
      'termos',
      'tos',
      'cookies',
      'cookie-policy',
      'gdpr',
      'lgpd',
      'aviso-legal',
      'legal',
      'disclaimer',
      'refund',
      'reembolso',
      'cancellation',
      'cancelamento',
      'shipping',
      'entrega',
      'imprint',
      'impressum',
      'about',
      'about-us',
      'sobre',
      'sobre-nos',
      'contact',
      'contato',
      'contact-us',
      'fale-conosco',
      'help',
      'ajuda',
      'support',
      'suporte',
      'faq',
      'sitemap',
      'careers',
      'carreiras',
      'press',
      'imprensa',
      'blog',
      'noticias',
    ];
    const TEXT_KEYWORDS = [
      'privacy',
      'privacidade',
      'política',
      'politica',
      'policy',
      'policies',
      'terms',
      'termos',
      'condições',
      'condicoes',
      'cookies',
      'gdpr',
      'lgpd',
      'aviso legal',
      'legal',
      'disclaimer',
      'refund',
      'reembolso',
      'cancelamento',
      'about us',
      'sobre nós',
      'sobre nos',
      'contact us',
      'fale conosco',
      'imprint',
      'impressum',
    ];
    try {
      const parsed = new URL(url);
      const path = parsed.pathname.toLowerCase().replace(/[_\s]+/g, '-');
      if (PATH_PATTERNS.some((p) => path.includes(p))) return true;
      if (anchorText) {
        const t = anchorText.trim().toLowerCase();
        if (t && TEXT_KEYWORDS.some((k) => t.includes(k))) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private extractSourceData(html: string) {
    const $ = load(html);
    const title = $('title').first().text().trim() || 'Cloned Landing Page';
    const headings = $('h1, h2')
      .toArray()
      .map((node) => $(node).text().trim())
      .filter(Boolean)
      .slice(0, 6);
    const paragraphs = $('p')
      .toArray()
      .map((node) => $(node).text().trim())
      .filter(Boolean)
      .slice(0, 8);
    const text = `${headings.join(' ')} ${paragraphs.join(' ')}`.trim();
    const summary = paragraphs[0] || headings[0] || 'Optimized landing page';
    return {
      title,
      sections: headings,
      summary,
      text,
    };
  }

  private inspectCloneSignals(
    html: string,
    extracted: {
      title: string;
      sections: string[];
      summary: string;
      text: string;
    },
  ) {
    const $ = load(html);
    const scripts = $('script').length;
    const bodyTextLength = $('body').text().replace(/\s+/g, ' ').trim().length;
    const headingCount = extracted.sections.length;
    const paragraphCount = $('p').length;
    const hasClientShellMarkers =
      html.includes('__NEXT_DATA__') ||
      html.includes('id="__next"') ||
      html.includes('id="root"') ||
      html.includes('id="app"');
    const needsRender =
      bodyTextLength < 240 ||
      (headingCount < 2 && scripts > 8) ||
      hasClientShellMarkers;

    return {
      scripts,
      bodyTextLength,
      headingCount,
      paragraphCount,
      hasClientShellMarkers,
      needsRender,
      title: extracted.title,
      summary: extracted.summary,
    };
  }

  private prepareCloneHtml(html: string, sourceUrl: string): string {
    const $ = load(html);
    const baseHref = this.buildBaseHref(sourceUrl);

    if (!$('html').length) {
      return html;
    }

    if (!$('head').length) {
      $('html').prepend('<head></head>');
    }

    const existingBase = $('head base').first();
    if (existingBase.length) {
      existingBase.attr('href', baseHref);
    } else {
      $('head').prepend(`<base href="${baseHref}">`);
    }

    this.normalizeLazyMedia($);
    this.absolutizeUrls($, baseHref);
    injectStableIdsOnCheerio($);

    return $.html();
  }

  private normalizeLazyMedia($: ReturnType<typeof load>) {
    const attrs = [
      'data-src',
      'data-lazy-src',
      'data-original',
      'data-url',
      'data-background-image',
      'data-bg',
    ];

    const resolveAttr = (
      node: Parameters<ReturnType<typeof load>>[0],
      target: string,
    ) => {
      const element = $(node);
      if (element.attr(target)) {
        return;
      }
      for (const attr of attrs) {
        const value = element.attr(attr);
        if (value) {
          element.attr(target, value);
          return;
        }
      }
    };

    $('img').each((_, node) => {
      resolveAttr(node, 'src');
      const element = $(node);
      if (!element.attr('srcset') && element.attr('data-srcset')) {
        element.attr('srcset', element.attr('data-srcset'));
      }
      if (element.attr('loading') === 'lazy') {
        element.attr('loading', 'eager');
      }
    });

    $('iframe').each((_, node) => {
      resolveAttr(node, 'src');
    });

    $('video').each((_, node) => {
      resolveAttr(node, 'src');
      const element = $(node);
      if (!element.attr('poster') && element.attr('data-poster')) {
        element.attr('poster', element.attr('data-poster'));
      }
      if (element.attr('preload') === undefined) {
        element.attr('preload', 'metadata');
      }
    });

    $('source').each((_, node) => {
      resolveAttr(node, 'src');
      const element = $(node);
      if (!element.attr('srcset') && element.attr('data-srcset')) {
        element.attr('srcset', element.attr('data-srcset'));
      }
    });
  }

  private hashShort(value: string): string {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < value.length; i += 1) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36).padStart(7, '0').slice(0, 9);
  }

  private buildBaseHref(sourceUrl: string): string {
    const parsed = new URL(sourceUrl);
    parsed.hash = '';
    parsed.search = '';
    if (!parsed.pathname.endsWith('/')) {
      const lastSlashIndex = parsed.pathname.lastIndexOf('/');
      parsed.pathname =
        lastSlashIndex >= 0
          ? parsed.pathname.slice(0, lastSlashIndex + 1)
          : '/';
    }
    if (!parsed.pathname) {
      parsed.pathname = '/';
    }
    return parsed.toString();
  }

  private runComplianceChecks(text: string, sourceUrl: string) {
    const lowered = text.toLowerCase();
    const blocked = this.blockedTerms.find((term) => lowered.includes(term));
    if (blocked) {
      return {
        isBlocked: true,
        reason: `Source content blocked by policy term: ${blocked}`,
      };
    }
    if (sourceUrl.includes('localhost')) {
      return {
        isBlocked: true,
        reason: 'Localhost URLs are not allowed for cloning',
      };
    }
    return { isBlocked: false as const };
  }

  private buildCustomizationAnchors(
    publicPages: CapturedPublicPage[],
    navigationMap: NavigationEdge[] = [],
  ): CustomizationAnchor[] {
    const anchors: CustomizationAnchor[] = [];
    for (const page of publicPages) {
      const stepId = page.stepId ?? 'main';
      const edgesForStep = navigationMap.filter(
        (edge) => edge.fromStepId === stepId,
      );
      const ignoreIds = edgesForStep
        .map((edge) => edge.actionId)
        .filter((id): id is string => Boolean(id));
      const ignoreSelectors = edgesForStep
        .map((edge) => edge.selector)
        .filter((s): s is string => Boolean(s));
      const detected = detectCustomizationAnchors(page.html, stepId, {
        ignoreIds,
        ignoreSelectors,
      });
      anchors.push(...detected);
    }
    return anchors;
  }

  async updatePageContent(
    pageId: string,
    payload: UpdatePageContentDto,
  ): Promise<{ saved: number; updatedAt: string }> {
    const page = await this.prismaService.page.findUnique({
      where: { id: pageId },
    });
    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    if (!page.latestVersionId) {
      throw new BadRequestException('Page has no version to update');
    }
    const version = await this.prismaService.pageVersion.findUnique({
      where: { id: page.latestVersionId },
    });
    if (!version) {
      throw new NotFoundException('Version not found');
    }
    const meta =
      version.meta && typeof version.meta === 'object'
        ? (version.meta as Record<string, unknown>)
        : {};
    const currentPublicPages = Array.isArray(meta.publicPages)
      ? (meta.publicPages as CapturedPublicPage[])
      : [];
    let nextPublicPages = [...currentPublicPages];
    let saved = 0;

    if (payload.steps?.length) {
      for (const step of payload.steps) {
        const idx = nextPublicPages.findIndex(
          (item) => item.stepId === step.stepId,
        );
        if (idx >= 0) {
          nextPublicPages[idx] = {
            ...nextPublicPages[idx],
            html: step.html,
            title: step.title ?? nextPublicPages[idx].title,
            renderMode: step.renderMode ?? nextPublicPages[idx].renderMode,
          };
          saved += 1;
        } else {
          nextPublicPages.push({
            url: `page://${pageId}/${step.stepId}`,
            title: step.title ?? step.stepId,
            html: step.html,
            renderMode: step.renderMode ?? 'runtime',
            stepId: step.stepId,
          });
          saved += 1;
        }
      }
    }

    const nextMainHtml = payload.mainHtml ?? version.html;
    if (payload.mainHtml) {
      const mainIdx = nextPublicPages.findIndex(
        (item) => item.stepId === 'main',
      );
      if (mainIdx >= 0) {
        nextPublicPages[mainIdx] = {
          ...nextPublicPages[mainIdx],
          html: payload.mainHtml,
        };
      }
      saved += 1;
    }

    const nextTitle = payload.title ?? version.title;

    const currentValues =
      meta.customizationValues && typeof meta.customizationValues === 'object'
        ? (meta.customizationValues as CustomizationValues)
        : {};
    const mergedValues: CustomizationValues = {
      ...currentValues,
      ...(payload.customizationValues ?? {}),
    };
    const existingNavigationMap = Array.isArray(meta.navigationMap)
      ? (meta.navigationMap as NavigationEdge[])
      : [];
    const nextAnchors = this.buildCustomizationAnchors(
      nextPublicPages,
      existingNavigationMap,
    );

    const nextMeta: Record<string, unknown> = {
      ...meta,
      publicPages: nextPublicPages,
      customizationAnchors: nextAnchors,
      customizationValues: mergedValues,
    };

    await this.prismaService.pageVersion.update({
      where: { id: version.id },
      data: {
        title: nextTitle,
        html: nextMainHtml,
        meta: nextMeta as Prisma.InputJsonValue,
      },
    });
    const updated = await this.prismaService.page.update({
      where: { id: pageId },
      data: { updatedAt: new Date() },
    });
    return { saved, updatedAt: updated.updatedAt.toISOString() };
  }

  async getPublicStep(slug: string, stepId?: string) {
    const page = await this.prismaService.page.findFirst({
      where: { slug, status: 'published' },
    });
    if (!page) {
      throw new NotFoundException('Page not found or not published');
    }
    const bundle = (page as unknown as { publishedBundle?: unknown })
      .publishedBundle;
    if (!bundle || typeof bundle !== 'object') {
      throw new NotFoundException('Published bundle missing');
    }
    const record = bundle as {
      steps?: Array<{ stepId: string; html: string; title?: string }>;
      mainStepId?: string;
    };
    const steps = Array.isArray(record.steps) ? record.steps : [];
    const target =
      steps.find((s) => s.stepId === (stepId ?? record.mainStepId ?? 'main')) ??
      steps.find((s) => s.stepId === 'main') ??
      steps[0];
    if (!target) {
      throw new NotFoundException('Step not found');
    }
    return { html: target.html, title: target.title ?? page.id };
  }

  async exportZip(pageId: string): Promise<Buffer> {
    const page = await this.prismaService.page.findUnique({
      where: { id: pageId },
    });
    if (!page || !page.latestVersionId) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    const version = await this.prismaService.pageVersion.findUnique({
      where: { id: page.latestVersionId },
    });
    if (!version) {
      throw new NotFoundException('Version not found');
    }
    const meta =
      version.meta && typeof version.meta === 'object'
        ? (version.meta as Record<string, unknown>)
        : {};
    const publicPages = Array.isArray(meta.publicPages)
      ? (meta.publicPages as CapturedPublicPage[])
      : [];
    const navigationMap = Array.isArray(meta.navigationMap)
      ? (meta.navigationMap as NavigationEdge[])
      : [];
    const customizationAnchors = Array.isArray(meta.customizationAnchors)
      ? (meta.customizationAnchors as CustomizationAnchor[])
      : [];
    const rawCustomizationValues =
      meta.customizationValues && typeof meta.customizationValues === 'object'
        ? (meta.customizationValues as CustomizationValues)
        : {};
    const customizationValues = expandValuesAcrossGroups(
      customizationAnchors,
      rawCustomizationValues,
    );

    const steps = publicPages.length
      ? publicPages
      : [
          {
            url: page.sourceUrl ?? 'about:blank',
            title: version.title,
            html: version.html,
            stepId: 'main',
          } as CapturedPublicPage,
        ];

    const resolver: StepResolver = (toStepId: string) =>
      `./${stepIdToFilename(toStepId)}`;

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();
    for (const step of steps) {
      const stepId = step.stepId ?? 'main';
      const filename = stepIdToFilename(stepId);
      const stepAnchors = customizationAnchors.filter(
        (a) => a.stepId === stepId,
      );
      const customized = applyCustomizationValues(
        step.html,
        stepAnchors,
        customizationValues,
      );
      const rewritten = rewriteNavigation(
        customized,
        stepId,
        navigationMap,
        resolver,
        { neutralizeExternal: true },
      );
      zip.file(filename, rewritten);
    }
    zip.file(
      'README.txt',
      [
        `Landing page exportada por CriaAI`,
        `Página: ${version.title}`,
        `Gerado em: ${new Date().toISOString()}`,
        ``,
        `Arquivos:`,
        ...steps.map(
          (s) => `- ${stepIdToFilename(s.stepId ?? 'main')} (${s.title})`,
        ),
        ``,
        `Suba todos os arquivos no mesmo diretório do seu servidor web.`,
        `O ponto de entrada é index.html.`,
      ].join('\r\n'),
    );
    return zip.generateAsync({ type: 'nodebuffer' });
  }

  private mapPage(page: Page) {
    return {
      id: page.id,
      sourceType: page.sourceType,
      status: page.status,
      sourceUrl: page.sourceUrl ?? undefined,
      publicUrl: page.publicUrl ?? undefined,
      slug: (page as unknown as { slug?: string | null }).slug ?? undefined,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString(),
      latestVersionId: page.latestVersionId,
    };
  }
}
