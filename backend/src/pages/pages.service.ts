import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { load, type CheerioAPI } from 'cheerio';
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
import { prepareExportHtml } from './export-html.util';
import {
  applyCustomizationValues,
  detectCustomizationAnchors,
  expandValuesAcrossGroups,
  syncCustomizationGroupKeys,
  type CustomizationAnchor,
  type CustomizationValues,
} from './customization.util';
import { UpdatePageContentDto } from './dto/update-page-content.dto';
import {
  PageSourceType,
  type CloneRunOptions,
  type CloneStreamingHooks,
  type CloneEntryReadyEvent,
  type ClonePageCapturedEvent,
  type CloneEdgeAddedEvent,
  type CloneStageEvent,
} from './pages.types';
import { JobsGateway } from '../realtime/jobs.gateway';
import { isTrackingInlineSnippet, isTrackingUrl } from './tracking-blocklist';
import { detectCheckoutProvider } from './checkout-vocab.util';
import {
  AntiBotChallengeError,
  detectAntiBotChallenge,
  pickUserAgent,
  type UserAgentProfile,
} from './anti-bot.util';
import { acquireChromium } from './chromium-pool.util';
import {
  isSingleFileAvailable,
  runSingleFile,
  scoreCandidateHtml,
} from './single-file.util';
import {
  fetchRobotsRules,
  fetchSitemapUrls,
  isRobotsAllowed,
} from './crawler.util';
import { LlmAssistService } from '../llm/llm-assist.service';
import { SalesPageGeneratorService } from './sales-page-generator.service';
import {
  CRIAAI_ID_ATTR,
  STABLE_ID_BROWSER_JS,
  injectStableIdsOnCheerio,
} from './stable-id.util';
import {
  detectLikelyCustomDragWidget,
  replaceDragRulerWithPlainInput,
} from './interactive-widget-simplify.util';
import {
  QUIZ_STATE_BROWSER_JS,
  computeQuizFingerprint,
  type QuizAction,
  type QuizStateSnapshot,
} from './quiz-state.util';
import {
  QUIZ_GATE_RESOLVER_BROWSER_JS,
  type GateResolverReport,
} from './quiz-gate-resolver.util';

interface CapturedPublicPage {
  url: string;
  title: string;
  html: string;
  renderMode?: 'runtime' | 'frozen';
  stepId?: string;
  sourceStepId?: string;
  triggerText?: string;
  triggerSelector?: string;
  /**
   * Optional small JPEG screenshot, base64 data URL. ~25-60KB. Captured
   * during walking/crawling so the live editor sidebar can render a
   * preview thumbnail next to each page item.
   */
  thumbnail?: string;
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
    private readonly jobsGateway: JobsGateway,
  ) {}

  /**
   * In-process serializer for read-modify-write of `meta.publicPages`.
   * Per-pageId chain of promises — guarantees that two concurrent
   * `appendPublicPagesAtomic` calls never race within this Node worker.
   * Cross-process safety still relies on the Postgres advisory lock the
   * helper takes inside the transaction.
   */
  private readonly atomicMetaQueue = new Map<string, Promise<unknown>>();

  /**
   * Streaming-hooks registry keyed by jobId. Set by `processCloneJob`
   * for the lifetime of a clone, so deep pipeline methods (`fetchSource
   * Rendered`, `capturePublicPages`, `runQuizWalkers`) can publish
   * incremental progress without having to thread a `streaming?:` arg
   * through every signature.
   */
  private readonly cloneStreamingByJobId = new Map<
    string,
    CloneStreamingHooks & { getPageId: () => string | null }
  >();

  private getStreamingHooks(jobId: string | undefined) {
    if (!jobId) return undefined;
    return this.cloneStreamingByJobId.get(jobId);
  }

  /**
   * Canonical HTTPS (or dev HTTP) base for published quiz URLs: stored in
   * `Page.publicUrl`, embedded in navigation rewrites, and shown as "link
   * CriaAI". Prefer `CRIAAI_PUBLIC_PAGE_BASE_URL`; falls back to `PUBLIC_BASE_URL`.
   */
  private resolvePublicPagesBaseUrl(): string {
    const raw =
      process.env.CRIAAI_PUBLIC_PAGE_BASE_URL?.trim() ||
      process.env.PUBLIC_BASE_URL?.trim();
    const port = process.env.PORT ?? '3000';
    const fallback = `http://localhost:${port}/v1/public`;
    if (!raw) return fallback;
    return raw.replace(/\/+$/, '');
  }

  onModuleInit() {
    this.queueService.registerHandler('pages.generate', async (payload) => {
      await this.processGenerateJob(
        String(payload.jobId),
        payload.data as GeneratePageDto,
        (payload.userId as string | null | undefined) ?? null,
      );
    });
    this.queueService.registerHandler('pages.clone', async (payload) => {
      await this.processCloneJob(
        String(payload.jobId),
        payload.data as ClonePageDto,
        (payload.userId as string | null | undefined) ?? null,
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

  async createGenerateJob(payload: GeneratePageDto, userId?: string | null) {
    const job = await this.jobsService.create(
      'generate',
      { ...payload, __userId: userId ?? null },
      userId ?? null,
    );
    await this.queueService.enqueue('pages.generate', {
      jobId: job.id,
      data: payload as unknown as Record<string, unknown>,
      userId: userId ?? null,
    });
    return {
      jobId: job.id,
      status: job.status,
    };
  }

  async createCloneJob(payload: ClonePageDto, userId?: string | null) {
    // Short-lived dedup: if the same user (or anonymous bucket) submits
    // the same URL twice within 5 minutes (e.g. double-click, refreshed
    // tab), reuse the most recent in-flight job rather than spawning a
    // duplicate Chromium pipeline. Backed by Redis when configured;
    // otherwise this is a no-op and we fall back to today's behavior.
    const dedupKey = this.buildCloneDedupKey(payload.sourceUrl, userId);
    const claimed = await this.queueService.tryClaimDedup(dedupKey, 5 * 60);
    if (!claimed) {
      const recent = await this.findRecentCloneJob(payload.sourceUrl, userId);
      if (recent) {
        this.logger.log(
          `[clone:dedup] reusing job ${recent.id} for url=${payload.sourceUrl}`,
        );
        return {
          jobId: recent.id,
          status: recent.status,
          deduped: true as const,
        };
      }
    }

    const job = await this.jobsService.create(
      'clone',
      { ...payload, __userId: userId ?? null },
      userId ?? null,
    );
    await this.queueService.enqueue(
      'pages.clone',
      {
        jobId: job.id,
        data: payload as unknown as Record<string, unknown>,
        userId: userId ?? null,
      },
      {
        jobId: job.id,
        // Clone jobs are long-running and can lose lock under high load;
        // avoid automatic replay loops for the same clone.
        attempts: 1,
      },
    );
    return {
      jobId: job.id,
      status: job.status,
    };
  }

  private buildCloneDedupKey(
    sourceUrl: string,
    userId?: string | null,
  ): string {
    const normalized = sourceUrl.trim().toLowerCase();
    const hash = createHash('sha256').update(normalized).digest('hex');
    const bucket = userId ?? 'anon';
    return `clone:url:${hash}:${bucket}`;
  }

  /**
   * Looks up the most recent non-terminal clone job for the same URL and
   * user. Used by the dedup path so a duplicate submission resolves to
   * the existing in-flight job id.
   */
  private async findRecentCloneJob(sourceUrl: string, userId?: string | null) {
    try {
      return await this.jobsService.findRecentByTypeAndUrl(
        'clone',
        sourceUrl,
        userId ?? null,
        5 * 60 * 1000,
      );
    } catch {
      return null;
    }
  }

  /**
   * Re-runs the capture + quiz-walker pipeline for an already-created page.
   * Keeps the page record (and slug/publicUrl) so public links don't break;
   * only creates a new PageVersion with the fresh walk results.
   */
  async reExploreClone(
    pageId: string,
    overrides: Partial<ClonePageDto> = {},
    userId?: string | null,
  ) {
    const page = await this.prismaService.page.findUnique({
      where: { id: pageId },
    });
    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    this.assertPageOwnership(page.userId ?? null, userId);
    if (!page.sourceUrl) {
      throw new BadRequestException('Page has no sourceUrl to re-explore');
    }
    const payload: ClonePageDto = {
      sourceUrl: page.sourceUrl,
      ...overrides,
    } as ClonePageDto;
    const job = await this.jobsService.create(
      'clone',
      {
        ...payload,
        reExploreOfPageId: pageId,
        __userId: userId ?? null,
      },
      userId ?? null,
    );
    await this.queueService.enqueue(
      'pages.clone',
      {
        jobId: job.id,
        data: payload as unknown as Record<string, unknown>,
        reExploreOfPageId: pageId,
        userId: userId ?? null,
      },
      {
        jobId: job.id,
        attempts: 1,
      },
    );
    return {
      jobId: job.id,
      status: job.status,
      pageId,
    };
  }

  async createPublishJob(
    pageId: string,
    payload: PublishPageDto,
    userId?: string | null,
  ) {
    await this.getPageById(pageId, userId);
    const job = await this.jobsService.create(
      'publish',
      { pageId, ...payload, __userId: userId ?? null },
      userId ?? null,
    );
    // Publicação roda no mesmo processo: não depende do worker BullMQ/Redis.
    // Assim o job não fica preso em "pending" se a fila não estiver consumindo.
    await this.processPublishJob(job.id, pageId, payload);
    const final = await this.jobsService.getById(job.id);
    const result = final.result as { publicUrl?: string } | undefined;
    return {
      jobId: job.id,
      status: final.status,
      publicUrl: typeof result?.publicUrl === 'string' ? result.publicUrl : undefined,
      error: final.error,
    };
  }

  async getPageById(pageId: string, userId?: string | null) {
    const page = await this.prismaService.page.findUnique({
      where: { id: pageId },
    });
    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    this.assertPageOwnership(page.userId ?? null, userId);
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

  /**
   * Lists every page owned by `userId`. Returned shape is intentionally
   * lean (no full `publishedBundle`) so the dashboard can render fast.
   */
  async listPagesForUser(userId: string) {
    const pages = await this.prismaService.page.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        sourceType: true,
        status: true,
        sourceUrl: true,
        publicUrl: true,
        slug: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return pages.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  }

  async deletePageForUser(pageId: string, userId: string): Promise<void> {
    const page = await this.prismaService.page.findUnique({
      where: { id: pageId },
    });
    if (!page) throw new NotFoundException(`Page ${pageId} not found`);
    this.assertPageOwnership(page.userId ?? null, userId);
    // PageVersion has only an index (no FK cascade), so wipe it explicitly.
    await this.prismaService.pageVersion.deleteMany({ where: { pageId } });
    await this.prismaService.customDomain.deleteMany({ where: { pageId } });
    await this.prismaService.page.delete({ where: { id: pageId } });
  }

  /**
   * Throws 404 (not 403, to avoid leaking existence) when the requested
   * page belongs to someone else. Pass `userId = undefined` to skip the
   * check (used internally by the worker pipeline).
   */
  private assertPageOwnership(
    ownerId: string | null,
    requesterId?: string | null,
  ): void {
    if (requesterId === undefined) return;
    if (!ownerId) return; // legacy page with no owner — leave accessible
    if (ownerId !== requesterId) {
      throw new NotFoundException('Página não encontrada');
    }
  }

  private async processGenerateJob(
    jobId: string,
    payload: GeneratePageDto,
    userId: string | null = null,
  ) {
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
        userId,
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

  /**
   * Creates the Page row + initial PageVersion as soon as the entry-page
   * snapshot is ready. Returns the row ids so the streaming pipeline can
   * keep updating the same version.
   *
   * Idempotent on `jobId`: if `processCloneJob` retries, the second call
   * reuses the existing pageId stored in `JobRecord.result.pageId`.
   */
  private async ensureLivePageVersion(
    jobId: string,
    userId: string | null,
    payload: ClonePageDto,
    entry: CapturedPublicPage,
    extraMeta: Record<string, unknown> = {},
  ): Promise<{ pageId: string; versionId: string }> {
    const existing = await this.jobsService.getById(jobId).catch(() => null);
    const existingPageId =
      existing?.result &&
      typeof existing.result === 'object' &&
      typeof existing.result.pageId === 'string'
        ? existing.result.pageId
        : null;
    if (existingPageId) {
      const versionRow = await this.prismaService.page
        .findUnique({ where: { id: existingPageId } })
        .catch(() => null);
      if (versionRow?.latestVersionId) {
        return {
          pageId: existingPageId,
          versionId: versionRow.latestVersionId,
        };
      }
    }
    const sanitizedHtml = this.sanitizePiiInHtml(
      this.prepareCloneHtml(entry.html, payload.sourceUrl),
    );
    const sanitizedEntry: CapturedPublicPage = {
      ...entry,
      html: sanitizedHtml,
      stepId: entry.stepId ?? 'main',
    };
    const page = await this.persistPage(
      'clone',
      entry.title,
      sanitizedHtml,
      {
        sourceUrl: payload.sourceUrl,
        objective: payload.objective,
        cta: payload.cta,
        cloneMode: 'full-html',
        publicPages: [sanitizedEntry],
        navigationMap: [],
        customizationAnchors: this.buildCustomizationAnchors(
          [sanitizedEntry],
          [],
        ),
        customizationValues: {},
        userEditedSteps: [],
        cloneStreaming: {
          state: 'streaming',
          startedAt: new Date().toISOString(),
        },
        ...extraMeta,
      },
      userId,
    );
    await this.jobsService.updateStatus(jobId, 'processing', {
      result: {
        pageId: page.id,
        versionId: page.latestVersionId,
        sourceUrl: payload.sourceUrl,
      },
    });
    return {
      pageId: page.id,
      versionId: page.latestVersionId ?? '',
    };
  }

  /**
   * Atomically appends/upserts captured pages and navigation edges into
   * the latest PageVersion's meta JSON. Two layers of safety:
   *
   * 1. In-process per-pageId promise chain (`atomicMetaQueue`) — protects
   *    the read-modify-write inside this worker.
   * 2. Postgres advisory transaction lock (`pg_advisory_xact_lock`) —
   *    protects against any future cross-process worker.
   *
   * Returns separate buckets for accepted vs conflicted pages: a "conflict"
   * happens when the crawler rediscovers a stepId the user has already
   * edited (`meta.userEditedSteps`). Conflicts are stored aside in
   * `meta.pendingUpdates[stepId]` and surfaced to the editor via the
   * `clone.conflictDetected` WS event so the user can decide.
   */
  private async appendPublicPagesAtomic(
    pageId: string,
    additions: {
      pages?: CapturedPublicPage[];
      edges?: NavigationEdge[];
    },
  ): Promise<{
    accepted: CapturedPublicPage[];
    conflicted: CapturedPublicPage[];
    versionId: string | null;
    customizationAnchors?: CustomizationAnchor[];
  }> {
    const previous = this.atomicMetaQueue.get(pageId) ?? Promise.resolve();
    const next = previous.then(() =>
      this.runAppendPublicPages(pageId, additions),
    );
    this.atomicMetaQueue.set(
      pageId,
      next.catch(() => undefined),
    );
    return next;
  }

  private async runAppendPublicPages(
    pageId: string,
    additions: {
      pages?: CapturedPublicPage[];
      edges?: NavigationEdge[];
    },
  ): Promise<{
    accepted: CapturedPublicPage[];
    conflicted: CapturedPublicPage[];
    versionId: string | null;
    customizationAnchors?: CustomizationAnchor[];
  }> {
    const pages = additions.pages ?? [];
    const edges = additions.edges ?? [];
    if (!pages.length && !edges.length) {
      return {
        accepted: [],
        conflicted: [],
        versionId: null,
        customizationAnchors: undefined,
      };
    }
    return this.prismaService.$transaction(
      async (tx) => {
        // Postgres advisory lock keyed on a stable hash of the pageId. Held
        // until the transaction commits, then released. Two clones writing
        // to the same page row will serialize at this point.
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
          pageId,
        );
        const page = await tx.page.findUnique({ where: { id: pageId } });
        if (!page?.latestVersionId) {
          return {
            accepted: [],
            conflicted: [],
            versionId: null,
            customizationAnchors: undefined,
          };
        }
        const version = await tx.pageVersion.findUnique({
          where: { id: page.latestVersionId },
        });
        if (!version) {
          return {
            accepted: [],
            conflicted: [],
            versionId: null,
            customizationAnchors: undefined,
          };
        }
        const meta =
          version.meta && typeof version.meta === 'object'
            ? ({ ...(version.meta as Record<string, unknown>) } as Record<
                string,
                unknown
              >)
            : {};
        const currentPages = Array.isArray(meta.publicPages)
          ? ([
              ...(meta.publicPages as CapturedPublicPage[]),
            ] as CapturedPublicPage[])
          : [];
        const currentEdges = Array.isArray(meta.navigationMap)
          ? ([...(meta.navigationMap as NavigationEdge[])] as NavigationEdge[])
          : [];
        const userEditedSteps = new Set(
          Array.isArray(meta.userEditedSteps)
            ? (meta.userEditedSteps as string[])
            : [],
        );
        const pendingUpdates =
          meta.pendingUpdates && typeof meta.pendingUpdates === 'object'
            ? ({
                ...(meta.pendingUpdates as Record<string, CapturedPublicPage>),
              } as Record<string, CapturedPublicPage>)
            : {};

        const accepted: CapturedPublicPage[] = [];
        const conflicted: CapturedPublicPage[] = [];

        for (const incoming of pages) {
          if (
            (incoming.stepId ?? '').startsWith('q') &&
            this.isSkippableBlankStepHtml(incoming.html)
          ) {
            this.logger.debug(
              `[clone] skipping blank/transient step ${
                incoming.stepId ?? incoming.url
              } from persisted publicPages`,
            );
            continue;
          }
          const stepId = incoming.stepId ?? incoming.url;
          const existingIdx = currentPages.findIndex(
            (p) => (p.stepId ?? p.url) === stepId,
          );
          if (existingIdx === -1) {
            currentPages.push(incoming);
            accepted.push(incoming);
            continue;
          }
          // Existing entry: if the user already touched it, stash the
          // incoming version aside instead of clobbering. The editor will
          // surface a "new version available" banner.
          if (stepId && userEditedSteps.has(stepId)) {
            pendingUpdates[stepId] = incoming;
            conflicted.push(incoming);
            continue;
          }
          // Same step, no user edits — replace HTML/title but preserve any
          // previously captured thumbnail unless the new one is fresher.
          const merged: CapturedPublicPage = {
            ...currentPages[existingIdx],
            ...incoming,
            thumbnail:
              incoming.thumbnail ?? currentPages[existingIdx].thumbnail,
          };
          currentPages[existingIdx] = merged;
          accepted.push(merged);
        }

        const seenEdgeKeys = new Set(
          currentEdges.map(
            (edge) => `${edge.fromStepId}->${edge.toStepId}@${edge.selector}`,
          ),
        );
        for (const edge of edges) {
          const key = `${edge.fromStepId}->${edge.toStepId}@${edge.selector}`;
          if (seenEdgeKeys.has(key)) continue;
          seenEdgeKeys.add(key);
          currentEdges.push(edge);
        }

        const nextAnchors = this.buildCustomizationAnchors(
          currentPages,
          currentEdges,
        );

        const nextMeta: Record<string, unknown> = {
          ...meta,
          publicPages: currentPages,
          navigationMap: currentEdges,
          customizationAnchors: nextAnchors,
          pendingUpdates,
          userEditedSteps: [...userEditedSteps],
        };

        await tx.pageVersion.update({
          where: { id: version.id },
          data: { meta: nextMeta as Prisma.InputJsonValue },
        });

        return {
          accepted,
          conflicted,
          versionId: version.id,
          customizationAnchors: nextAnchors,
        };
      },
      // The meta JSON for a populated quiz can hold many MB of HTML/MHTML
      // per step; serializing + writing under the advisory lock easily
      // exceeds Prisma's default 5s interactive timeout when several
      // walkers stream pages concurrently. Bump generously so we never
      // bail mid-flight.
      {
        maxWait: 30_000,
        timeout: 180_000,
      },
    );
  }

  /**
   * Marks the given step ids as "user-edited" so subsequent `appendPublic
   * PagesAtomic` calls don't overwrite them. Called from
   * `updatePageContent` whenever the editor saves changes for a step.
   */
  private async markStepsEditedByUser(
    pageId: string,
    stepIds: string[],
  ): Promise<void> {
    if (!stepIds.length) return;
    const previous = this.atomicMetaQueue.get(pageId) ?? Promise.resolve();
    const next = previous.then(async () => {
      await this.prismaService.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(
            `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
            pageId,
          );
          const page = await tx.page.findUnique({ where: { id: pageId } });
          if (!page?.latestVersionId) return;
          const version = await tx.pageVersion.findUnique({
            where: { id: page.latestVersionId },
          });
          if (!version) return;
          const meta =
            version.meta && typeof version.meta === 'object'
              ? ({ ...(version.meta as Record<string, unknown>) } as Record<
                  string,
                  unknown
                >)
              : {};
          const set = new Set(
            Array.isArray(meta.userEditedSteps)
              ? (meta.userEditedSteps as string[])
              : [],
          );
          for (const id of stepIds) set.add(id);
          meta.userEditedSteps = [...set];
          // When the user edits a step that had a pending update, it means
          // they decided to keep their version — drop the pending entry.
          if (meta.pendingUpdates && typeof meta.pendingUpdates === 'object') {
            const pending = {
              ...(meta.pendingUpdates as Record<string, unknown>),
            };
            for (const id of stepIds) delete pending[id];
            meta.pendingUpdates = pending;
          }
          await tx.pageVersion.update({
            where: { id: version.id },
            data: { meta: meta as Prisma.InputJsonValue },
          });
        },
        { maxWait: 15_000, timeout: 60_000 },
      );
    });
    this.atomicMetaQueue.set(
      pageId,
      next.catch(() => undefined),
    );
    await next;
  }

  /**
   * Clears `meta.cloneStreaming.state` (sets it to `done`) and removes
   * any leftover pending updates. Called once `processCloneJob` finishes
   * the walker so the editor knows the streaming is over.
   */
  private async finalizeCloneStreaming(
    pageId: string,
    summary: { totalPages: number; totalEdges: number },
  ): Promise<void> {
    await this.prismaService.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
          pageId,
        );
        const page = await tx.page.findUnique({ where: { id: pageId } });
        if (!page?.latestVersionId) return;
        const version = await tx.pageVersion.findUnique({
          where: { id: page.latestVersionId },
        });
        if (!version) return;
        const meta =
          version.meta && typeof version.meta === 'object'
            ? ({ ...(version.meta as Record<string, unknown>) } as Record<
                string,
                unknown
              >)
            : {};
        meta.cloneStreaming = {
          state: 'done',
          completedAt: new Date().toISOString(),
          ...summary,
        };
        await tx.pageVersion.update({
          where: { id: version.id },
          data: { meta: meta as Prisma.InputJsonValue },
        });
      },
      { maxWait: 15_000, timeout: 60_000 },
    );
  }

  /**
   * Best-effort small JPEG screenshot of a Playwright page. Returns a
   * base64 data URL (~25-60KB) suitable for inlining into the
   * CapturedPublicPage payload. Failure is non-fatal — the caller drops
   * the thumbnail and keeps going.
   */
  private async captureThumbnail(page: {
    screenshot: (opts: unknown) => Promise<Buffer>;
  }): Promise<string | undefined> {
    try {
      const buf = await page.screenshot({
        type: 'jpeg',
        quality: 60,
        fullPage: false,
        clip: { x: 0, y: 0, width: 360, height: 720 },
        timeout: 4000,
      });
      const base64 = Buffer.from(buf).toString('base64');
      if (!base64) return undefined;
      // Cap data URL at ~120KB to keep WS payloads light.
      if (base64.length > 160_000) return undefined;
      return `data:image/jpeg;base64,${base64}`;
    } catch {
      return undefined;
    }
  }

  /**
   * Builds the `CloneStreamingHooks` object that the pipeline calls back
   * into. Keeps a closure on the jobId/userId/payload + a mutable slot
   * for the resolved `pageId`. Exceptions in any callback are caught
   * locally — the pipeline must NEVER fail because the WS dropped.
   */
  private buildStreamingHooks(
    jobId: string,
    userId: string | null,
    payload: ClonePageDto,
  ): CloneStreamingHooks & {
    getPageId: () => string | null;
  } {
    let pageId: string | null = null;
    let totalPages = 0;
    let totalEdges = 0;
    const safe = async <T>(
      label: string,
      fn: () => Promise<T>,
    ): Promise<T | undefined> => {
      try {
        return await fn();
      } catch (err) {
        this.logger.warn(
          `[clone:${jobId}] streaming hook ${label} failed: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
        return undefined;
      }
    };
    return {
      getPageId: () => pageId,
      onEntryReady: async (event: CloneEntryReadyEvent) => {
        const ready = await this.ensureLivePageVersion(
          jobId,
          userId,
          payload,
          event.entryPage,
        );
        pageId = ready.pageId;
        totalPages = 1;
        await safe('emitCloneEntryReady', async () => {
          this.jobsGateway.emitCloneEntryReady(ready.pageId, {
            ...event,
            entryPage: event.entryPage,
          });
        });
        return ready.pageId;
      },
      onPageCaptured: async (event: ClonePageCapturedEvent) => {
        if (!pageId) return;
        const sanitizedPage: CapturedPublicPage = {
          ...event.page,
          html: this.sanitizePiiInHtml(event.page.html),
        };
        const result = await this.appendPublicPagesAtomic(pageId, {
          pages: [sanitizedPage],
        });
        if (result.accepted.length) {
          totalPages += 1;
          await safe('emitClonePageCaptured', async () => {
            this.jobsGateway.emitClonePageCaptured(pageId!, {
              ...event,
              pageId: pageId!,
              page: result.accepted[0],
              customizationAnchors: result.customizationAnchors,
            });
          });
        }
        if (result.conflicted.length) {
          for (const conflict of result.conflicted) {
            await safe('emitCloneConflict', async () => {
              this.jobsGateway.emitCloneConflict(pageId!, {
                jobId,
                pageId: pageId!,
                stepId: conflict.stepId ?? conflict.url,
                incoming: {
                  title: conflict.title,
                  htmlSize: conflict.html.length,
                  thumbnail: conflict.thumbnail,
                },
              });
            });
          }
        }
      },
      onEdgeAdded: async (event: CloneEdgeAddedEvent) => {
        if (!pageId) return;
        const result = await this.appendPublicPagesAtomic(pageId, {
          edges: [event.edge],
        });
        if (result.versionId) {
          totalEdges += 1;
          await safe('emitCloneEdgeAdded', async () => {
            this.jobsGateway.emitCloneEdgeAdded(pageId!, {
              ...event,
              pageId: pageId!,
            });
          });
        }
      },
      onStage: async (event: CloneStageEvent) => {
        await safe('emitCloneStage', async () => {
          this.jobsGateway.emitCloneStage(pageId ?? undefined, {
            ...event,
            pageId: pageId ?? undefined,
          });
        });
        if (event.stage === 'completed' && pageId) {
          await safe('finalizeStreaming', async () => {
            await this.finalizeCloneStreaming(pageId!, {
              totalPages,
              totalEdges,
            });
            this.jobsGateway.emitCloneCompleted(pageId!, {
              ...event,
              pageId: pageId ?? undefined,
              percent: 100,
            });
          });
        }
      },
    };
  }

  /**
   * Builds the runtime options object for a clone job from the validated
   * DTO + sane defaults. Centralized here so the DTO shape is the single
   * source of truth for per-job knobs (`quizMaxSteps`, `useLlmAssist`, …).
   */
  private buildCloneRunOptions(payload: ClonePageDto): CloneRunOptions {
    const quizMaxSteps = payload.quizMaxSteps ?? 180;
    const quizMaxForks = payload.quizMaxForks ?? 220;
    const envPerStepRaw = Number(process.env.CLONE_QUIZ_MAX_TIME_PER_STEP_MS);
    const envPerStepMs = Number.isFinite(envPerStepRaw) ? envPerStepRaw : NaN;
    return {
      quizMaxSteps,
      quizMaxForks,
      // States grow at most ~3x the linear walk + every fork can produce
      // its own chain of states. We cap at 4x quizMaxSteps with a floor of
      // 600 to preserve previous behaviour for the default 180-step case.
      quizMaxStates: Math.max(600, quizMaxSteps * 4),
      quizMaxTimeMs: 22 * 60 * 1000,
      // 0 disables per-step cut-off (global max time still applies).
      quizMaxTimePerStepMs: Number.isFinite(envPerStepMs) ? envPerStepMs : 0,
      useLlmAssist: payload.useLlmAssist !== false,
      simplifyInteractiveWidgets: payload.simplifyInteractiveWidgets !== false,
    };
  }

  private async processCloneJob(
    jobId: string,
    payload: ClonePageDto,
    userId: string | null = null,
  ) {
    await this.jobsService.updateStatus(jobId, 'processing');
    const hooks = this.buildStreamingHooks(jobId, userId, payload);
    this.cloneStreamingByJobId.set(jobId, hooks);
    try {
      const cloneOptions = this.buildCloneRunOptions(payload);
      this.logger.log(
        `[clone:${jobId}] options=${JSON.stringify({
          quizMaxSteps: cloneOptions.quizMaxSteps,
          quizMaxForks: cloneOptions.quizMaxForks,
          quizMaxStates: cloneOptions.quizMaxStates,
          quizMaxTimePerStepMs: cloneOptions.quizMaxTimePerStepMs,
          useLlmAssist: cloneOptions.useLlmAssist,
        })}`,
      );
      await hooks.onStage?.({
        jobId,
        stage: 'fetch',
        message: 'Buscando página de origem',
        percent: 5,
      });
      const source = await this.fetchSource(
        payload.sourceUrl,
        jobId,
        cloneOptions,
      );
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

      // The streaming hooks have already been firing during
      // fetchSourceRendered → onEntryReady (created the Page row early)
      // → onPageCaptured (drip-fed the editor with each crawl/walk
      // result). At this point we either reuse the live pageId emitted
      // by the hooks OR fall back to the original "persist at the end"
      // path when streaming was unavailable (static fetch, no entry hook
      // ran, etc).
      let pageId = hooks.getPageId();
      let versionId: string | null = null;

      if (!pageId) {
        const clonedHtml = this.sanitizePiiInHtml(
          this.prepareCloneHtml(source.html, payload.sourceUrl),
        );
        const sanitizedPublicPages = this.sanitizePiiInPublicPages(
          source.publicPages,
        );
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
            publicPages: sanitizedPublicPages,
            navigationMap: source.navigationMap,
            customizationAnchors: this.buildCustomizationAnchors(
              sanitizedPublicPages,
              source.navigationMap ?? [],
            ),
            customizationValues: {},
            userEditedSteps: [],
          },
          userId,
        );
        pageId = page.id;
        versionId = page.latestVersionId ?? null;
      } else {
        // Streaming path: backfill any pages/edges the hooks couldn't
        // emit incrementally (defensive — the walker normally emits
        // everything live, but this guarantees nothing is dropped if a
        // pipeline stage produced data after its emit hook was set).
        const sanitized = this.sanitizePiiInPublicPages(source.publicPages);
        await this.appendPublicPagesAtomic(pageId, {
          pages: sanitized,
          edges: source.navigationMap,
        }).catch((err) => {
          this.logger.warn(
            `[clone:${jobId}] backfill append failed: ${
              err instanceof Error ? err.message : 'unknown'
            }`,
          );
        });
        const live = await this.prismaService.page.findUnique({
          where: { id: pageId },
        });
        versionId = live?.latestVersionId ?? null;
      }

      // Auto-publish so the clone is immediately shareable (same idea as generate).
      let published: { slug: string; publicUrl: string } | null = null;
      if (pageId) {
        try {
          let baseSlug = this.slugify(extracted.title || '');
          const titleTrim = (extracted.title || '').trim();
          const slugFromUrl = (): string => {
            try {
              const u = new URL(payload.sourceUrl);
              const host = u.hostname.replace(/^www\./i, '');
              const pathSeg = u.pathname
                .split('/')
                .filter(Boolean)
                .slice(0, 2)
                .join('-');
              return (
                this.slugify(pathSeg ? `${host}-${pathSeg}` : host) || 'clone'
              );
            } catch {
              return 'clone';
            }
          };
          if (!titleTrim || !baseSlug || baseSlug === 'sales') {
            baseSlug = slugFromUrl();
          }
          published = await this.publishPageToSlug(pageId, baseSlug);
          this.logger.log(
            `[clone:${jobId}] auto-published slug=${published.slug} url=${published.publicUrl}`,
          );
        } catch (err) {
          this.logger.warn(
            `[clone:${jobId}] auto-publish failed: ${
              err instanceof Error ? err.message : 'unknown'
            }`,
          );
        }
      }

      await hooks.onStage?.({
        jobId,
        pageId: pageId ?? undefined,
        stage: 'completed',
        message: 'Clonagem concluída',
        percent: 100,
      });
      await this.jobsService.updateStatus(jobId, 'completed', {
        result: {
          pageId,
          versionId,
          sourceUrl: payload.sourceUrl,
          publicUrl: published?.publicUrl,
          slug: published?.slug,
        },
      });
    } catch (error) {
      const livePageId = hooks.getPageId();
      // Anti-bot challenges deserve a precise, user-facing error so the
      // frontend can show "Site protected by Cloudflare/DataDome/…" copy
      // instead of a generic crash. Keeping the prefix
      // `source_protected_by_<provider>` is also what `App.tsx` keys on
      // for the inline help block.
      if (error instanceof AntiBotChallengeError) {
        this.logger.warn(
          `[clone:${jobId}] anti-bot challenge detected provider=${error.provider} reason="${error.reason}"`,
        );
        await this.jobsService.updateStatus(jobId, 'failed', {
          error: error.message,
          result: {
            errorCode: 'anti_bot_challenge',
            provider: error.provider,
            providerReason: error.reason,
          },
        });
        if (livePageId) {
          await hooks.onStage?.({
            jobId,
            pageId: livePageId,
            stage: 'failed',
            message: error.message,
          });
        }
        return;
      }
      await this.jobsService.updateStatus(jobId, 'failed', {
        error:
          error instanceof Error ? error.message : 'Unexpected clone error',
      });
      if (livePageId) {
        await hooks.onStage?.({
          jobId,
          pageId: livePageId,
          stage: 'failed',
          message:
            error instanceof Error ? error.message : 'Unexpected clone error',
        });
      }
    } finally {
      this.cloneStreamingByJobId.delete(jobId);
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
        syncCustomizationGroupKeys(customizationAnchors, rawCustomizationValues),
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

      const publicBase = this.resolvePublicPagesBaseUrl();

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
   * Publish a page inline (no queue). Used by generate + clone completion to
   * assign a unique public slug so the customer immediately has a shareable URL.
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
      syncCustomizationGroupKeys(customizationAnchors, rawCustomizationValues),
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

    const publicBase = this.resolvePublicPagesBaseUrl();

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
    userId: string | null = null,
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
          userId: userId ?? null,
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
    options?: CloneRunOptions,
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
    // Pin one UA profile per job: keeps static + rendered + retry attempts
    // semantically consistent. Bot detectors often correlate UA changes
    // across requests as a strong "this is automated" signal.
    const uaProfile = pickUserAgent(url + ':' + (jobId ?? ''));
    const staticHtml = await this.fetchSourceStatic(url, uaProfile);
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
      const rendered = await this.runRenderedWithRetry(
        url,
        jobId,
        options,
        uaProfile,
      );
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
      // Anti-bot challenges are NOT retryable and MUST NOT fall back to
      // the static body — saving a "checking your browser…" splash as a
      // clone is exactly the failure mode we want to avoid.
      if (error instanceof AntiBotChallengeError) {
        throw error;
      }
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

  /**
   * Retry wrapper for `fetchSourceRendered` — handles transient network
   * failures (timeouts, ECONNRESET, sporadic CDN errors) with two retries
   * and 2-5s jitter. Anti-bot challenges short-circuit the loop so the
   * caller can surface a definitive "this site is protected" error.
   */
  private async runRenderedWithRetry(
    url: string,
    jobId: string | undefined,
    options: CloneRunOptions | undefined,
    profile: UserAgentProfile,
  ): Promise<{
    html: string;
    publicPages: CapturedPublicPage[];
    navigationMap: NavigationEdge[];
  }> {
    const MAX_ATTEMPTS = 2;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        return await this.fetchSourceRendered(url, jobId, options, profile);
      } catch (err) {
        lastErr = err;
        if (err instanceof AntiBotChallengeError) throw err;
        const message =
          err instanceof Error ? err.message.toLowerCase() : String(err);
        const transient =
          message.includes('timeout') ||
          message.includes('econnreset') ||
          message.includes('econnrefused') ||
          message.includes('net::err_') ||
          message.includes('navigation') ||
          message.includes('chromium');
        if (!transient || attempt === MAX_ATTEMPTS) break;
        const jitter = 2000 + Math.floor(Math.random() * 3000);
        this.logger.warn(
          `[clone:${jobId ?? 'n/a'}] rendered attempt ${attempt} failed (${message.slice(0, 120)}), retrying in ${jitter}ms`,
        );
        await new Promise((r) => setTimeout(r, jitter));
      }
    }
    throw lastErr instanceof Error
      ? lastErr
      : new Error('rendered fetch failed');
  }

  private async fetchSourceStatic(
    url: string,
    profile?: UserAgentProfile,
  ): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const ua = profile ?? pickUserAgent(url);
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'User-Agent': ua.userAgent,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-User': '?1',
          'Sec-Fetch-Dest': 'document',
          'Upgrade-Insecure-Requests': '1',
          ...ua.headers,
        },
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      const body = await response.text();
      const challenge = detectAntiBotChallenge(body, {
        status: response.status,
        headers,
      });
      if (challenge) {
        throw new AntiBotChallengeError(challenge);
      }
      if (!response.ok) {
        throw new BadRequestException(
          `Failed to fetch source URL with status ${response.status}`,
        );
      }
      return body;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async fetchSourceRendered(
    url: string,
    jobId?: string,
    options?: CloneRunOptions,
    profile?: UserAgentProfile,
    /**
     * Set to true when this invocation is itself the result of an iframe
     * redirect; prevents the redirect detector from firing twice and
     * looping (parent → iframe → iframe-of-iframe → …).
     */
    skipIframeRedirect?: boolean,
  ): Promise<{
    html: string;
    publicPages: CapturedPublicPage[];
    navigationMap: NavigationEdge[];
  }> {
    // Stealth-aware Chromium: playwright-extra + puppeteer-extra-plugin-stealth.
    // Patches navigator.webdriver, chrome.runtime, WebGL vendor and a handful
    // of other surface APIs that bot-detection scripts probe before serving
    // a real page. Falls back transparently to vanilla Playwright if the
    // optional deps fail to load (dev environments, CI without postinstall).
    //
    // Launch is gated by a small semaphore (`chromium-pool.util.ts`) so
    // a burst of concurrent clone jobs cannot OOM the VPS. The pool
    // caps active browsers at `floor(cpus/2)` (override via
    // CRIAAI_CHROMIUM_POOL_MAX).
    const ua = profile ?? pickUserAgent(url);
    const lease = await acquireChromium();
    const { browser } = lease;
    try {
      const context = await browser.newContext({
        userAgent: ua.userAgent,
        locale: 'pt-BR',
        viewport: { width: 1366, height: 820 },
        timezoneId: 'America/Sao_Paulo',
        extraHTTPHeaders: {
          'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          ...ua.headers,
        },
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
      const response = await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20000,
      });
      await page
        .waitForLoadState('networkidle', { timeout: 7000 })
        .catch(() => undefined);
      await this.scrollPageForLazyContent(page);
      const baselineHtml = await page.content();
      const baselineUrl = page.url();

      // Anti-bot challenge probe — runs after first paint so the stealth
      // patches have had a chance to satisfy easy detection. We still
      // catch the harder vendors (Cloudflare interstitial, DataDome,
      // PerimeterX) and abort with a typed error so processCloneJob can
      // surface a user-friendly "site protected" message instead of
      // saving a half-broken clone.
      const responseHeaders: Record<string, string> = {};
      try {
        const raw = response ? await response.allHeaders() : {};
        for (const [k, v] of Object.entries(raw)) {
          if (typeof v === 'string') responseHeaders[k.toLowerCase()] = v;
        }
      } catch {
        /* swallow */
      }
      const challenge = detectAntiBotChallenge(baselineHtml, {
        status: response?.status() ?? 0,
        headers: responseHeaders,
      });
      if (challenge) {
        throw new AntiBotChallengeError(challenge);
      }

      // Iframe-as-source redirect.
      //
      // Some funnel hosts (Cakto, Hotmart-hosted quizzes, Kiwify
      // widgets…) ship a near-empty parent page whose only meaningful
      // content is an iframe pointing at the producer's domain. Cloning
      // the parent gives the user an empty wrapper. When we detect that
      // pattern we close the current browser and recursively re-enter
      // `fetchSourceRendered` with the iframe URL — but only once,
      // gated by `skipIframeRedirect`, so we can never loop.
      if (!skipIframeRedirect) {
        const redirected = await this.maybeRedirectToQuizIframe(
          baselineHtml,
          baselineUrl,
          url,
          jobId,
          options,
          profile,
        );
        if (redirected) {
          return redirected;
        }
      }

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

      // Snapshot candidate competition.
      //
      // We consider up to three captures and pick the highest scoring one:
      //   1. MHTML via CDP — fast, fully self-contained, lossless on most
      //      static + lightly hydrated pages.
      //   2. SingleFile CLI sidecar (opt-in via CRIAAI_USE_SINGLEFILE=1) —
      //      independent Chromium subprocess that produces a richer
      //      self-contained HTML on heavy SPAs / Webflow / Wix sites that
      //      tend to lose CSS in MHTML.
      //   3. DOM-própio snapshot via `captureBestRenderedSnapshot` — our
      //      scroll-and-score fallback. Always tried when MHTML failed
      //      to produce output, optional when MHTML succeeded but
      //      SingleFile is enabled (so all three candidates compete).
      //
      // `scoreCandidateHtml` is intentionally language-agnostic; it
      // counts media, inlined CSS bytes, css `url(...)` references and
      // visible text length, mirroring the live-DOM scoring used inside
      // `captureBestRenderedSnapshot`.
      const candidates: Array<{
        source: 'mhtml' | 'single-file' | 'dom';
        html: string;
        url: string;
        score: number;
      }> = [];

      const mhtmlHtml = await this.captureMhtmlSelfContained(page, jobId);
      if (mhtmlHtml) {
        candidates.push({
          source: 'mhtml',
          html: mhtmlHtml,
          url: page.url(),
          score: scoreCandidateHtml(mhtmlHtml),
        });
      }

      const singleFileHtml = await this.captureSingleFileSnapshot(
        context,
        page,
        ua,
        jobId,
      );
      if (singleFileHtml) {
        candidates.push({
          source: 'single-file',
          html: singleFileHtml,
          url: page.url(),
          score: scoreCandidateHtml(singleFileHtml),
        });
      }

      // ALWAYS produce the DOM candidate, regardless of whether MHTML
      // succeeded. Reason: Chrome's `Page.captureSnapshot` (MHTML) is
      // explicitly a *visual* snapshot — it strips every <script> tag.
      // The DOM candidate is the only path that preserves the original
      // site's runtime (sliders, kg/lb toggles, custom selects,
      // "Continuar" enabling logic, etc.). The scorer in
      // `scoreCandidateHtml` is biased toward script presence so the
      // DOM candidate normally wins on interactive pages while MHTML
      // can still win on purely static / image-heavy landing pages
      // where its richer asset inlining matters more.
      await this.inlineExternalStylesheets(page);
      const bestSnapshot = await this.captureBestRenderedSnapshot(page, jobId);
      // Inline the actual bundle bytes AFTER capture, in Node, on the
      // raw HTML string. Doing it in the live browser would re-execute
      // the bundle on top of the already-mounted SPA and clobber the
      // captured state (this is what blanked out the snapshot the last
      // time we tried). CSS inlining is safe in-browser because <style>
      // tags don't re-trigger anything.
      const domHtmlInlined = await this.inlineExternalScriptsInHtml(
        bestSnapshot.html,
        bestSnapshot.url,
        jobId,
      );
      candidates.push({
        source: 'dom',
        html: domHtmlInlined,
        url: bestSnapshot.url,
        score: scoreCandidateHtml(domHtmlInlined),
      });

      candidates.sort((a, b) => b.score - a.score);
      const winner = candidates[0];
      this.logger.log(
        `[clone:${jobId ?? 'n/a'}] snapshot candidates=${candidates
          .map((c) => `${c.source}:${c.score}`)
          .join(',')} winner=${winner?.source ?? 'baseline'}`,
      );
      let selectedHtml: string = winner?.html ?? baselineHtml;
      let selectedUrl: string = winner?.url ?? page.url();
      if (this.isAuthLikeUrl(selectedUrl) && !this.isAuthLikeUrl(url)) {
        this.logger.warn(
          `[clone:${jobId ?? 'n/a'}] best snapshot moved to auth route (${selectedUrl}); keeping baseline capture from ${baselineUrl}`,
        );
        selectedHtml = baselineHtml;
        selectedUrl = baselineUrl;
      }

      // Stream — entry ready.
      //
      // Fire `onEntryReady` as soon as we have the winning snapshot.
      // The hook persists the Page row + initial PageVersion synchronously
      // and returns the new pageId, which downstream emit calls will use
      // to scope `clone.*` events to the correct page room.
      const hooks = this.getStreamingHooks(jobId);
      if (hooks?.onEntryReady) {
        const entryThumbnail = await this.captureThumbnail(page);
        const primaryTitle = this.extractSourceData(selectedHtml).title;
        await hooks
          .onEntryReady({
            jobId: jobId ?? '',
            sourceUrl: url,
            title: primaryTitle,
            entryPage: {
              url: selectedUrl,
              title: primaryTitle,
              html: this.prepareCloneHtml(selectedHtml, selectedUrl),
              renderMode: 'runtime',
              stepId: 'main',
              thumbnail: entryThumbnail,
            },
          })
          .catch((err) => {
            this.logger.warn(
              `[clone:${jobId ?? 'n/a'}] onEntryReady failed: ${
                err instanceof Error ? err.message : 'unknown'
              }`,
            );
          });
        await hooks.onStage?.({
          jobId: jobId ?? '',
          pageId: hooks.getPageId() ?? undefined,
          stage: 'crawl',
          message: 'Mapeando páginas internas',
          percent: 25,
        });
      }

      const publicPages = await this.capturePublicPages(
        context,
        selectedUrl,
        selectedHtml,
        jobId,
        ua,
        options,
      );
      if (hooks) {
        await hooks.onStage?.({
          jobId: jobId ?? '',
          pageId: hooks.getPageId() ?? undefined,
          stage: 'walk',
          message: 'Caminhando pelo quiz',
          percent: 55,
        });
      }
      const quizResult = await this.captureQuizBranches(
        context,
        selectedUrl,
        jobId,
        options,
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
      await lease.release();
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
    profile?: UserAgentProfile,
    options?: CloneRunOptions,
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

    // Crawl budget. The DTO's `quizMaxSteps` doubles as a global "how
    // many internal pages are we willing to walk" cap so the user has a
    // single, predictable knob. Default falls back to a generous 24 —
    // significantly more than the previous hardcoded 7 that left most
    // long-tail pages on the floor.
    const discoveryBudget = Math.max(
      1,
      Math.min(64, options?.quizMaxSteps ?? 24),
    );

    // Honour robots.txt for the chosen UA: we only filter out URLs that
    // robots explicitly blocks. A missing/broken robots.txt is treated
    // as "no preferences declared" — everything stays allowed.
    const userAgentForCrawl = profile?.userAgent ?? '';
    const robotsRules = userAgentForCrawl
      ? await fetchRobotsRules(baseUrl, userAgentForCrawl)
      : { rules: [], sitemaps: [] };

    // Combine three discovery sources in priority order:
    //   1. Plain `<a href>` from the rendered baseline.
    //   2. URLs explicitly declared by the host (sitemap.xml /
    //      sitemap_index.xml + extra sitemaps from robots.txt).
    // Sitemap entries are last so we don't disrupt the existing UX
    // ranking (anchor-text-driven discovery picks up navigation links
    // first), but they backfill anything we'd otherwise miss.
    const linkDiscovered = this.extractPublicLinks(baseHtml, baseUrl);
    const sitemapDiscovered = userAgentForCrawl
      ? await fetchSitemapUrls(
          baseUrl,
          userAgentForCrawl,
          robotsRules.sitemaps,
        ).catch(() => [])
      : [];

    // Path-prefix scoping. When the entry URL lives at a non-root path
    // (e.g. https://inlead.digital/progrma-pilates-em-casa/), the host's
    // root sitemap usually advertises every other funnel/landing of the
    // platform — none of which belong in the clone. We restrict
    // discovery to URLs that share the same first path segment as the
    // entry. Quizzes/funnels living at the domain root keep the
    // permissive (any-path) behaviour.
    const entryUrl = new URL(baseUrl);
    const entrySegments = entryUrl.pathname.split('/').filter(Boolean);
    const scopePrefix =
      entrySegments.length > 0 ? `/${entrySegments[0]}/` : '/';
    const isWithinScope = (url: string): boolean => {
      try {
        const u = new URL(url);
        if (u.host !== entryUrl.host) return false;
        if (scopePrefix === '/') return true;
        // Treat the bare prefix without trailing slash as inside.
        const trimmed = scopePrefix.slice(0, -1);
        return u.pathname === trimmed || u.pathname.startsWith(scopePrefix);
      } catch {
        return false;
      }
    };

    const discoveredSet = new Set<string>();
    let droppedOutOfScope = 0;
    for (const url of [...linkDiscovered, ...sitemapDiscovered]) {
      if (discoveredSet.size >= discoveryBudget) break;
      if (!isRobotsAllowed(url, robotsRules)) continue;
      if (!isWithinScope(url)) {
        droppedOutOfScope += 1;
        continue;
      }
      discoveredSet.add(url);
    }
    const discovered = [...discoveredSet];

    this.logger.log(
      `[clone:${jobId ?? 'n/a'}] crawler discovery anchor=${linkDiscovered.length} sitemap=${sitemapDiscovered.length} scope=${scopePrefix} droppedOutOfScope=${droppedOutOfScope} budget=${discoveryBudget} effective=${discovered.length}`,
    );

    let publicIndex = 0;
    const hooks = this.getStreamingHooks(jobId);

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
          .waitForLoadState('networkidle', { timeout: 4000 })
          .catch(() => undefined);
        // Extra hydration window. Many SPAs only finish wiring up
        // navigation links after the network goes idle (e.g. Next.js
        // route prefetching, GTM-injected anchors). Two seconds covers
        // the vast majority without bloating job runtime.
        await page.waitForTimeout(2000);
        const finalUrl = page.url();
        if (
          new URL(finalUrl).host !== baseHost ||
          this.isAuthLikeUrl(finalUrl) ||
          this.isBoilerplateUrl(finalUrl)
        ) {
          await page.close();
          continue;
        }
        // Use the DOM snapshot (with inlined stylesheets) instead of
        // the MHTML one — MHTML drops every <script>, which would leave
        // each crawled internal page with broken interactivity (the
        // user's quizzes typically have form elements / "Continuar"
        // logic running on JS even on auxiliary pages).
        await this.inlineExternalStylesheets(page);
        const rawHtml = await page.content();
        const html = await this.inlineExternalScriptsInHtml(
          rawHtml,
          page.url(),
          jobId,
        );
        const title = this.extractSourceData(html).title;
        if (this.isBoilerplateTitle(title)) {
          await page.close();
          continue;
        }
        publicIndex += 1;
        const thumbnail = hooks
          ? await this.captureThumbnail(
              page as unknown as {
                screenshot: (opts: unknown) => Promise<Buffer>;
              },
            )
          : undefined;
        const captured: CapturedPublicPage = {
          url: finalUrl,
          title,
          html: this.prepareCloneHtml(html, finalUrl),
          renderMode: baseRenderMode,
          stepId: `page-${publicIndex}`,
          thumbnail,
        };
        collected.push(captured);
        if (hooks?.onPageCaptured) {
          await hooks
            .onPageCaptured({
              jobId: jobId ?? '',
              pageId: hooks.getPageId() ?? '',
              page: captured,
            })
            .catch((err) =>
              this.logger.warn(
                `[clone:${jobId ?? 'n/a'}] onPageCaptured (crawler) failed: ${
                  err instanceof Error ? err.message : 'unknown'
                }`,
              ),
            );
        }
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
    // Final cap mirrors the discovery budget so a generous DTO setting
    // actually translates into more pages persisted, not just more
    // pages walked-and-thrown-away.
    const finalCap = Math.max(4, discoveryBudget);
    return collected.slice(0, finalCap);
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
    options?: CloneRunOptions,
  ): Promise<{
    variants: CapturedPublicPage[];
    navigationMap: NavigationEdge[];
  }> {
    return this.runQuizWalkers(context, sourceUrl, jobId, options);
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

  /**
   * Capture the full storage snapshot at the current moment of a walker.
   * The result is opaque to the caller — it's later passed to
   * `applyForkStateSnapshot` and `addInitScript` to put a brand-new tab
   * back into the same state.
   *
   * Captures:
   *   - cookies + per-origin localStorage via `context.storageState()`.
   *   - per-origin sessionStorage via `page.evaluate` (sessionStorage is
   *     per-tab in the spec and not part of `storageState()`).
   *   - URL / viewport / locale so the replay matches user agent + render
   *     hints exactly.
   */
  private async captureForkStateSnapshot(
    context: unknown,
    page: unknown,
  ): Promise<{
    cookies: Array<Record<string, unknown>>;
    origins: Array<{
      origin: string;
      localStorage?: Array<{ name: string; value: string }>;
    }>;
    sessionStorage: Record<string, Record<string, string>>;
    url: string;
    viewport?: { width: number; height: number };
    locale?: string;
    timezoneId?: string;
  }> {
    const ctx = context as {
      storageState: () => Promise<{
        cookies: Array<Record<string, unknown>>;
        origins: Array<{
          origin: string;
          localStorage?: Array<{ name: string; value: string }>;
        }>;
      }>;
    };
    const pg = page as {
      url: () => string;
      viewportSize?: () => { width: number; height: number } | null;
      evaluate: <T, A>(fn: (arg: A) => Promise<T> | T, arg: A) => Promise<T>;
    };
    const state = await ctx.storageState().catch(() => ({
      cookies: [],
      origins: [],
    }));
    const ssMap = await pg
      .evaluate((_arg: unknown) => {
        const out: Record<string, string> = {};
        try {
          const ss = globalThis.sessionStorage;
          for (let i = 0; i < ss.length; i += 1) {
            const k = ss.key(i);
            if (k != null) {
              out[k] = ss.getItem(k) ?? '';
            }
          }
        } catch {
          /* sessionStorage may be disabled */
        }
        return out;
      }, null)
      .catch(() => ({}) as Record<string, string>);
    const url = pg.url();
    let origin = '';
    try {
      origin = new URL(url).origin;
    } catch {
      /* leave origin empty */
    }
    const sessionStorage: Record<string, Record<string, string>> = origin
      ? { [origin]: ssMap }
      : {};
    const viewport = pg.viewportSize
      ? (pg.viewportSize() ?? undefined)
      : undefined;
    return {
      cookies: state.cookies ?? [],
      origins: state.origins ?? [],
      sessionStorage,
      url,
      viewport: viewport ?? undefined,
    };
  }

  /**
   * Restore cookies (and only cookies) into a context. localStorage and
   * sessionStorage are pushed via `page.addInitScript()` at runWalker time
   * so they apply to the brand-new page that's about to be created.
   */
  private async applyForkStateSnapshot(
    context: unknown,
    snapshot: { cookies: Array<Record<string, unknown>> },
  ): Promise<void> {
    if (!snapshot.cookies?.length) return;
    const ctx = context as {
      addCookies: (cookies: Array<Record<string, unknown>>) => Promise<void>;
    };
    await ctx.addCookies(snapshot.cookies);
  }

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
    options?: CloneRunOptions,
  ): Promise<{
    variants: CapturedPublicPage[];
    navigationMap: NavigationEdge[];
  }> {
    // All limits flow from the per-job options object. Falls back to the
    // historical defaults when invoked from a non-DTO caller (re-explore,
    // quick tests, etc.).
    const MAX_STEPS_PER_WALK = options?.quizMaxSteps ?? 180;
    const MAX_TOTAL_STATES = options?.quizMaxStates ?? 600;
    // Bumped from 140 → 220 so branching screens with 6-12 plan/option
    // cards get every alternative explored (the missing branches were the
    // root cause of "I see 4 steps when there are 8 in the original").
    const MAX_FORKS_TO_EXPLORE = options?.quizMaxForks ?? 220;
    const MAX_TIME_MS = options?.quizMaxTimeMs ?? 22 * 60 * 1000;
    // Hard wall-clock cap per step. Without this, a single broken step
    // (LLM stalled, network drained, unrecognized advance button) could
    // burn the entire job budget. 25s mirrors the plan's recommended
    // value and is enough for the slowest legitimate case (a transient
    // loader + LLM gate resolution + a click + 2.5s networkidle).
    const MAX_TIME_PER_STEP_MS = options?.quizMaxTimePerStepMs ?? 25_000;
    const useLlm = options?.useLlmAssist !== false;

    const baseHost = (() => {
      try {
        return new URL(sourceUrl).host;
      } catch {
        return '';
      }
    })();

    const startedAt = Date.now();
    /**
     * Hard ceiling for the entire quiz phase (linear + todas as forks).
     * Antes só existia um `deadlineAt` igual ao orçamento de um único walk:
     * o walk linear consumia os ~22min e os fork walkers começavam sem tempo
     * (`time budget reached at step=2`), deixando ramos do quiz por capturar.
     */
    const MAX_OVERALL_MS = Math.max(MAX_TIME_MS * 6, 90 * 60 * 1000);
    const hardCapAt = startedAt + MAX_OVERALL_MS;

    type Action = QuizAction;
    type ForkStateSnapshot = {
      /**
       * `context.storageState()` cookies — the only safe primitive to
       * re-apply to a fresh context (covers HttpOnly, Secure, SameSite).
       */
      cookies: Array<Record<string, unknown>>;
      /**
       * Per-origin localStorage; cookies above already cover what
       * `storageState()` returns but localStorage often holds the quiz's
       * mid-walk state on SPAs.
       */
      origins: Array<{
        origin: string;
        localStorage?: Array<{ name: string; value: string }>;
      }>;
      /**
       * Per-origin sessionStorage. Playwright's `storageState()` does NOT
       * cover sessionStorage (per-tab by spec) so we capture/restore it
       * manually via init script.
       */
      sessionStorage: Record<string, Record<string, string>>;
      /** URL captured at the fork moment — replay starts from here. */
      url: string;
      /** Viewport dimensions when the fork was captured. */
      viewport?: { width: number; height: number };
      /** Locale + timezone — same context settings on replay. */
      locale?: string;
      timezoneId?: string;
    };
    type ForkPoint = {
      atSignature: string;
      sourceStepId: string;
      alternative: Action;
      sourceUrl: string;
      /**
       * Storage snapshot captured the instant the fork was registered.
       * Replaying the walker with this state restored is dramatically
       * more reliable than re-walking from `sourceUrl` (SPA frameworks
       * regenerate selectors on every reload).
       */
      stateSnapshot?: ForkStateSnapshot;
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

    // Streaming hooks for the walker. Captured here so the inner
    // closures (`runWalker`) can emit incrementally without having to
    // pass the hooks through every callback. Thumbnail capture is kept
    // optional via `allowThumbnail` because grabbing a screenshot per
    // walker step on a 60-step quiz can multiply runtime by 1.5x — we
    // only enable it when the editor is actively listening.
    const streaming = this.getStreamingHooks(jobId);
    const walkerStreaming = streaming
      ? {
          ...streaming,
          allowThumbnail: true,
        }
      : undefined;

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

      /**
       * Orçamento próprio por execução do walker (linear ou fork). Não reutilizar
       * o relógio global do job — senão forks disparados depois do linear ficam sem budget.
       */
      const walkDeadlineAt = Date.now() + MAX_TIME_MS;

      const states: Array<{ signature: string; stepId: string }> = [];
      const forks: ForkPoint[] = [];
      let overrideAtSignature: string | null = override?.atSignature ?? null;
      const sigPart = (signature: string, prefix: string): string => {
        const token = signature
          .split('|')
          .find((part) => part.startsWith(prefix));
        return token ? token.slice(prefix.length) : '';
      };

      // STORAGE-AWARE FORK REPLAY.
      //
      // For forks that come with a captured snapshot we replay starting
      // from the URL captured at the fork moment AND with cookies/local
      // /sessionStorage restored. This is dramatically more reliable than
      // re-walking from `sourceUrl`: many SPAs persist the entire quiz
      // state in storage and use opaque tokens (data-id, react-key) that
      // change on every load, so the previous "find the same signature
      // again then take the alt" strategy was brittle.
      //
      // When no snapshot exists (linear walk, or capture failed) we fall
      // back to the legacy behavior — replay from `sourceUrl`.
      const replaySnapshot = override?.stateSnapshot;
      const startUrl = replaySnapshot?.url ?? sourceUrl;
      if (replaySnapshot) {
        try {
          await this.applyForkStateSnapshot(context, replaySnapshot);
        } catch (err) {
          this.logger.debug(
            `[clone:${jobId ?? 'n/a'}] ${walkLabel} state restore failed: ${
              err instanceof Error ? err.message : 'unknown'
            }`,
          );
        }
      }

      const page = await context.newPage();
      // Pre-populate storage on document creation — runs BEFORE any page
      // script, so the SPA's hydration sees the restored values as if it
      // were a returning user.
      if (replaySnapshot) {
        const ssMap =
          replaySnapshot.sessionStorage[new URL(replaySnapshot.url).origin] ??
          {};
        const lsForOrigin =
          replaySnapshot.origins.find(
            (o) => o.origin === new URL(replaySnapshot.url).origin,
          )?.localStorage ?? [];
        const initPayload = {
          ls: lsForOrigin,
          ss: ssMap,
        };
        await (
          page as unknown as {
            addInitScript: (
              fn: (payload: unknown) => void,
              arg: unknown,
            ) => Promise<void>;
          }
        )
          .addInitScript((payload: unknown) => {
            try {
              const data = payload as {
                ls?: Array<{ name: string; value: string }>;
                ss?: Record<string, string>;
              };
              for (const item of data.ls ?? []) {
                try {
                  globalThis.localStorage.setItem(item.name, item.value);
                } catch {
                  /* quota / disabled */
                }
              }
              for (const [k, v] of Object.entries(data.ss ?? {})) {
                try {
                  globalThis.sessionStorage.setItem(k, v);
                } catch {
                  /* swallow */
                }
              }
            } catch {
              /* never break the page */
            }
          }, initPayload)
          .catch(() => undefined);
      }

      let prevStepId: string | null = null;
      let prevAction: Action | null = null;
      // Siblings of the action that brought us into the next state. Used
      // to register FALLBACK edges for every other option/advance on the
      // origin screen — alt-walker forks frequently fail to replay (SPA
      // rejects the restored state, signature drifts, etc.) and without a
      // fallback we'd end up with only the very first option wired up,
      // leaving every other option dead in the cloned quiz.
      let prevSiblings: Action[] | null = null;
      const seenInThisWalk = new Set<string>();
      const clickedActionsThisWalk = new Set<string>();
      /** Consecutive no-advance outcomes for the same signature+action before we mark it spent. */
      const advanceFailCounts = new Map<string, number>();
      /** When every action on a signature was tried without escape, allow a few full retries (gates/overlays). */
      const revisitDeadlockClears = new Map<string, number>();
      let overrideConsumed = !override;
      let consecutiveFakeLoaders = 0;
      // Keeps the richest snapshot we've accepted so far — used as the
      // "baseline" for universal transient-screen detection: if the
      // brand-new snapshot is much smaller/poorer than this baseline, we
      // strongly suspect we're looking at a loading frame and keep polling.
      let baselineSnapshot: QuizStateSnapshot | null = null;

      try {
        await page.goto(startUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 25000,
        });
        await page
          .waitForLoadState('networkidle', { timeout: 6000 })
          .catch(() => undefined);
        await page.waitForTimeout(700);

        // Replay validation: when we restored from a snapshot we expect
        // the very first signature seen to match the registered fork. If
        // it doesn't, the SPA either rejected our state or the route
        // changed under us — record the failure but DON'T attempt the
        // alternative (it would land in the wrong context and pollute
        // the navigation map).
        if (replaySnapshot && override) {
          const probe = await this.waitForQuizStepReady(page).catch(() => null);
          const probeUrl = page.url();
          const probeFp = probe
            ? computeQuizFingerprint(probe, probeUrl)
            : null;
          if (probeFp && probeFp.signature !== override.atSignature) {
            const gotPath = sigPart(probeFp.signature, 'p:');
            const expPath = sigPart(override.atSignature, 'p:');
            const gotQ = sigPart(probeFp.signature, 'q:');
            const expQ = sigPart(override.atSignature, 'q:');
            const gotO = sigPart(probeFp.signature, 'o:');
            const expO = sigPart(override.atSignature, 'o:');
            const softMatch =
              !!gotPath &&
              gotPath === expPath &&
              ((!!gotQ && gotQ === expQ) || (!!gotO && gotO === expO));
            if (softMatch) {
              this.logger.warn(
                `[clone:${jobId ?? 'n/a'}] ${walkLabel} replay signature drift (soft-match path/content), remapping override target`,
              );
              overrideAtSignature = probeFp.signature;
            } else {
              this.logger.warn(
                `[clone:${jobId ?? 'n/a'}] ${walkLabel} replay landed on a different state (got ${probeFp.signature.slice(0, 16)}, expected ${override.atSignature.slice(0, 16)}); continuing with best-effort fork`,
              );
              // Best-effort fallback: keep exploring this walk instead of
              // dropping the fork entirely. This preserves deeper branches
              // on SPAs that slightly mutate the signature after restore.
              overrideAtSignature = probeFp.signature;
            }
          }
        }

        for (let step = 0; step < MAX_STEPS_PER_WALK; step += 1) {
          if (Date.now() > walkDeadlineAt) {
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

          // Per-step deadline. Used to break out of fallback paths
          // (multiple click retries, advance-not-detected loops, gate
          // resolver second passes) before they consume too much of
          // the global budget.
          const hasStepBudget = MAX_TIME_PER_STEP_MS > 0;
          const effectiveStepBudgetMs = hasStepBudget
            ? override
              ? Math.max(MAX_TIME_PER_STEP_MS, 40_000)
              : MAX_TIME_PER_STEP_MS
            : Number.POSITIVE_INFINITY;
          const stepDeadline = hasStepBudget
            ? Date.now() + effectiveStepBudgetMs
            : Number.POSITIVE_INFINITY;

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

          // Unsupported screen detector. We stop the walker as soon as
          // we hit a screen we know we can't progress through (canvas-
          // dominant games, swipe-only carousels) so the user gets a
          // clear failure mode instead of a stuck job.
          if (snapshot.unsupportedReason) {
            this.logger.warn(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} unsupported screen at step=${step} reason=${snapshot.unsupportedReason}, stopping`,
            );
            break;
          }

          // UNIVERSAL TRANSIENT-SCREEN DETECTION.
          //
          // Three layers combined in `isLikelyTransientScreen`:
          //   1. Explicit signals (CSS class + multilingual text + animated
          //      shape) already computed by the browser probe.
          //   2. Baseline comparison: snapshot drastically smaller/poorer
          //      than the last accepted real step → almost certainly a
          //      transition frame, regardless of keywords/classes.
          //   3. LLM arbiter (Ollama) on ambiguous low-signal states, with
          //      cache by content hash. Zero cost after first verdict.
          //
          // Budget: up to ~30s per transition (20 × 1500ms). After that we
          // assume the loader is hung and stop this walk gracefully.
          const isTransient = await this.isLikelyTransientScreen(
            snapshot,
            baselineSnapshot,
            { useLlm },
          );
          if (isTransient) {
            consecutiveFakeLoaders += 1;
            // "Analisando…" screens often run 5–20s; allow more polls than
            // the old 20×1.5s cap so the DOM can finish before we give up.
            if (consecutiveFakeLoaders >= 32) {
              this.logger.log(
                `[clone:${jobId ?? 'n/a'}] ${walkLabel} loader never resolved after ${consecutiveFakeLoaders} polls, stopping`,
              );
              break;
            }
            const sample = snapshot.readiness.loadingTextSample
              ? ` text="${snapshot.readiness.loadingTextSample}"`
              : '';
            this.logger.debug(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} transient screen at step ${step} (#${consecutiveFakeLoaders}) type=${snapshot.stepType}${sample}, waiting`,
            );
            const waitMs = snapshot.readiness.loadingTextSample ? 2100 : 1500;
            await page.waitForTimeout(waitMs);
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

          // Track the richest accepted snapshot as a baseline. Future
          // snapshots that look dramatically smaller than this will be
          // treated as probable transition frames by
          // `isLikelyTransientScreen`.
          const baseTextLen = baselineSnapshot?.readiness.textLen ?? 0;
          const baseInteractives =
            baselineSnapshot?.readiness.interactiveCount ?? 0;
          const currTextLen = snapshot.readiness.textLen ?? 0;
          const currInteractives = snapshot.readiness.interactiveCount;
          const isRicher =
            currTextLen > baseTextLen * 0.9 ||
            currInteractives >= baseInteractives;
          if (!baselineSnapshot || isRicher) {
            baselineSnapshot = snapshot;
          }

          // Per-step snapshot: ALWAYS use `page.content()` (DOM) and
          // inline the external stylesheets so the saved HTML keeps both
          // its visual fidelity AND its scripts. Chrome's MHTML format
          // strips every <script> tag (it's a *visual* snapshot only),
          // which would leave each Q2+ step with non-functional
          // sliders / kg-lb toggles / custom selects / option-then-
          // continue logic the original site relies on.
          //
          // CSS inlining only runs on first-seen states because it's a
          // (relatively) heavy operation and we don't need to repeat it
          // for already-known signatures.
          let stateHtml: string;
          if (isFirstSeenGlobal) {
            await this.inlineExternalStylesheets(page);
          }
          const rawStateHtml = await page.content();
          // Server-side script inlining: never touch the live page,
          // otherwise we'd re-bootstrap the SPA mid-walk and lose the
          // current step's DOM (the user saw the snapshot blank-out the
          // last time we tried doing it in the browser context).
          stateHtml = isFirstSeenGlobal
            ? await this.inlineExternalScriptsInHtml(
                rawStateHtml,
                currentUrl,
                jobId,
              )
            : rawStateHtml;

          stateHtml = await this.maybeSimplifyInteractiveWidgetHtml(
            stateHtml,
            options,
          );

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
          let isNewState = false;
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
            isNewState = true;
          } else {
            currentStepId = ensureStepId(signature);
            allStates.set(signature, {
              stepId: currentStepId,
              title: stateTitle,
              url: currentUrl,
              html: stateHtml,
            });
            isNewState = true;
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} captured step ${currentStepId} "${stateTitle.slice(0, 60)}" (total=${allStates.size})`,
            );
          }

          // Stream — walker step ready.
          //
          // Emit `clone.pageCaptured` the moment a brand-new walker
          // state lands. The hook persists into meta.publicPages and the
          // editor sidebar grows in real-time. We skip step 0 ('main')
          // because it was already streamed via onEntryReady. Skipping
          // already-seen signatures avoids duplicate noise across forks.
          if (
            isNewState &&
            currentStepId !== 'main' &&
            walkerStreaming?.onPageCaptured
          ) {
            const variantPage: CapturedPublicPage = {
              url: `${currentUrl}#quiz-${currentStepId}`,
              title: `${stateTitle} · ${currentStepId.toUpperCase()}`,
              html: this.prepareCloneHtml(stateHtml, currentUrl),
              renderMode: 'frozen',
              stepId: currentStepId,
              thumbnail: walkerStreaming.allowThumbnail
                ? await this.captureThumbnail(
                    page as unknown as {
                      screenshot: (opts: unknown) => Promise<Buffer>;
                    },
                  )
                : undefined,
            };
            await walkerStreaming
              .onPageCaptured({
                jobId: jobId ?? '',
                pageId: walkerStreaming.getPageId() ?? '',
                page: variantPage,
              })
              .catch((err) =>
                this.logger.warn(
                  `[clone:${jobId ?? 'n/a'}] onPageCaptured (walker) failed: ${
                    err instanceof Error ? err.message : 'unknown'
                  }`,
                ),
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
          //
          // FALLBACK EDGES for sibling options.
          // ----------------------------------------------------------------
          // After registering the "real" edge that this walker traversed
          // (e.g. q01 → q02 via Opt1), we also stamp DEFAULT edges from
          // the same origin step to the same destination for every other
          // option/advance that was visible on the origin screen
          // (Opt2 → q02, Opt3 → q02, …). Reasons:
          //  • Most quiz screens are linear: every option just clicks a
          //    radio and the *same* "Continuar" advances. Forking 5
          //    alt-walkers per screen is wasteful AND fragile (SPA state
          //    replay fails on roughly half of them).
          //  • For TRUE branching screens, alt-walkers that DO succeed
          //    will later push their own (fromStep, otherSelector, otherTo)
          //    edges. `rewriteNavigation` iterates edges in insertion
          //    order, so the alt-walker's correct destination wins.
          //  • Without this, the cloned quiz has only the very first
          //    option wired up — every other button is a dead click,
          //    which is exactly the bug the user reported.
          //
          // We exclude obvious "not a navigation" actions: checkout CTAs
          // (those go to an external provider, not a quiz step), and the
          // identical chosen action itself (already registered above).
          const registerEdge = async (
            from: string,
            to: string,
            actionForEdge: Action,
          ) => {
            const actionKey = actionForEdge.actionId ?? actionForEdge.selector;
            const dupKey = `${from}|${actionKey}|${to}`;
            const exists = navigationMap.some(
              (e) =>
                `${e.fromStepId}|${e.actionId ?? e.selector}|${e.toStepId}` ===
                dupKey,
            );
            if (exists) return;
            const newEdge = {
              fromStepId: from,
              toStepId: to,
              selector: actionForEdge.actionId
                ? `[${CRIAAI_ID_ATTR}="${actionForEdge.actionId}"]`
                : actionForEdge.selector,
              actionId: actionForEdge.actionId,
              triggerText: actionForEdge.triggerText,
            };
            navigationMap.push(newEdge);
            if (walkerStreaming?.onEdgeAdded) {
              await walkerStreaming
                .onEdgeAdded({
                  jobId: jobId ?? '',
                  pageId: walkerStreaming.getPageId() ?? '',
                  edge: newEdge,
                })
                .catch((err) =>
                  this.logger.warn(
                    `[clone:${jobId ?? 'n/a'}] onEdgeAdded failed: ${
                      err instanceof Error ? err.message : 'unknown'
                    }`,
                  ),
                );
            }
          };

          if (prevAction && prevStepId && prevStepId !== currentStepId) {
            await registerEdge(prevStepId, currentStepId, prevAction);

            // Only the LINEAR walker stamps sibling fallbacks — fork
            // walkers are the ones that would discover branching
            // destinations, and we don't want them clobbering each
            // other's findings with default edges.
            //
            // CRITICAL: We only stamp fallbacks for OTHER OPTIONS when
            // the action that just advanced was itself a clicked option
            // (branching / card screens). When the advance was a
            // dedicated `Continuar` / `Próximo` button (advance) — i.e.
            // a `radio_then_continue` or `checkbox_then_continue` step —
            // we MUST NOT stamp fallbacks on the radios/checkboxes,
            // because the correct user behavior is "tick one or more
            // options, then click Continuar". Stamping fallback navigation
            // on those options would skip the multi-select gate and
            // navigate the moment the user ticks the first checkbox,
            // breaking the experience the user explicitly asked us to
            // preserve. Same rule for advance-button siblings: another
            // visible advance/continue would be redundantly wired to the
            // same destination, which is fine, but options must remain
            // pure selection toggles.
            const prevWasOption =
              !!prevAction.isOption && !prevAction.isAdvance;
            const shouldFanOutToSiblings =
              !override &&
              prevWasOption &&
              prevSiblings &&
              prevSiblings.length > 1;
            if (shouldFanOutToSiblings) {
              const prevKey = prevAction.actionId ?? prevAction.selector;
              let fallbackCount = 0;
              for (const sibling of prevSiblings!) {
                const sibKey = sibling.actionId ?? sibling.selector;
                if (!sibKey || sibKey === prevKey) continue;
                if (sibling.isCheckoutCta || sibling.isCheckoutByHref) {
                  continue;
                }
                // Only stamp for OPTIONS — leave dedicated advance
                // buttons (rare on a branching screen) alone. They will
                // still receive their own real edge if/when a walker
                // traverses them.
                if (!sibling.isOption || sibling.isAdvance) continue;
                const siblingHasEdge = navigationMap.some(
                  (e) =>
                    e.fromStepId === prevStepId &&
                    (e.actionId ?? e.selector) === sibKey,
                );
                if (siblingHasEdge) continue;
                await registerEdge(prevStepId, currentStepId, sibling);
                fallbackCount += 1;
              }
              if (fallbackCount > 0) {
                this.logger.debug(
                  `[clone:${jobId ?? 'n/a'}] ${walkLabel} stamped ${fallbackCount} fallback edge(s) ${prevStepId}→${currentStepId} for sibling options (branching screen)`,
                );
              }
            }
          }

          // Actions already came from the same snapshot — zero extra evaluate.
          // This replaces ~230 lines of inline page.evaluate with a single
          // reference, and keeps classification consistent with the fingerprint.
          let actions: Action[] = snapshot.actions;

          // LLM arbitration for screen classification.
          //
          // The browser probe uses keyword/attribute heuristics that cannot
          // cover every language/framework. Before trusting its verdict
          // (especially `checkout_end` — terminal, stops exploration) we ask
          // the LLM to re-classify the screen given the full semantic
          // picture: URL, question, body text, every action label, provider
          // hints, and whether a text input is pending. The LLM can tell
          // "Reclamar mi plan" on a form-gate screen is NOT a checkout, and
          // it can promote "OBTENER MI PLAN" (not in any keyword list) to
          // the real checkout even when nothing else matched.
          //
          // Results are cached by signature — the same screen across forks
          // is decided ONCE. Deterministic short-circuits (provider href,
          // attribute-tagged checkout with no pending input) never hit the
          // LLM. Falls back to the probe verdict if Ollama is offline.
          //
          // Honors the per-job `useLlmAssist` flag: when the user explicitly
          // opted-out, we skip every Ollama roundtrip on this hot path and
          // trust the deterministic probe.
          const screenVerdict = !useLlm
            ? null
            : await this.llmAssistService
                .classifyQuizScreen({
                  url: currentUrl,
                  signature,
                  probeStepType: snapshot.stepType,
                  questionText: snapshot.questionText,
                  bodyText: snapshot.bodyTextSample ?? '',
                  hasVisibleTextInput: !!snapshot.hasVisibleTextInput,
                  hasProviderHref: actions.some((a) => !!a.isCheckoutByHref),
                  actions: actions.map((a) => ({
                    actionId: a.actionId,
                    selector: a.selector,
                    triggerText: a.triggerText,
                    probeKind: a.kind ?? 'option',
                    probeIsCheckoutCta: !!a.isCheckoutCta,
                    probeIsCheckoutByAttr: !!a.isCheckoutByAttr,
                    probeIsCheckoutByHref: !!a.isCheckoutByHref,
                    probeIsCheckoutByStrongText: !!a.isCheckoutByStrongText,
                    provider: a.checkoutProvider,
                  })),
                })
                .catch(() => null);

          let effectiveKind = screenVerdict?.kind ?? snapshot.stepType;
          if (screenVerdict) {
            this.logger.debug(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} screen verdict ${effectiveKind} (conf=${screenVerdict.confidence.toFixed(2)}, reason="${screenVerdict.reason ?? ''}")`,
            );
          }

          // PROPERTY-FIRST guard against LLM hallucination.
          //
          // The LLM is asked to identify checkout actions, but it can be
          // misled by mid-funnel copy ("¿Qué incluye tu plan?", "Tu tasa de
          // quema de grasa") into tagging a plain "Continuar" button as
          // the checkout. We ONLY trust its checkoutActionIds when the
          // action already carries a property-level signal (provider href
          // or a data-/id/class/aria attribute containing a checkout
          // keyword). The LLM is free to *choose between candidates* — but
          // it is NOT free to *create* a candidate out of thin air.
          const llmCheckoutIdsRaw = screenVerdict?.checkoutActionIds ?? [];
          const actionByKey = new Map<string, Action>();
          for (const a of actions) {
            const key = a.actionId ?? a.selector;
            if (key) actionByKey.set(key, a);
          }
          const llmCheckoutIds = llmCheckoutIdsRaw.filter((id) => {
            const a = actionByKey.get(id);
            if (!a) return false;
            return (
              !!a.isCheckoutByHref ||
              !!a.isCheckoutByAttr ||
              !!a.isCheckoutByStrongText
            );
          });
          const droppedLlmIds =
            llmCheckoutIdsRaw.length - llmCheckoutIds.length;
          if (droppedLlmIds > 0) {
            this.logger.debug(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} dropped ${droppedLlmIds} LLM checkout id(s) with no property evidence`,
            );
          }
          if (llmCheckoutIds.length > 0) {
            await page
              .evaluate(
                ({ attr, ids }: { attr: string; ids: string[] }) => {
                  for (const id of ids) {
                    try {
                      let el: Element | null = document.querySelector(
                        '[' + attr + '="' + id + '"]',
                      );
                      if (!el) {
                        el = document.querySelector(id);
                      }
                      if (el && !el.hasAttribute('data-criaai-checkout')) {
                        el.setAttribute('data-criaai-checkout', 'llm-cta');
                      }
                    } catch (_) {
                      /* ignore */
                    }
                  }
                },
                { attr: CRIAAI_ID_ATTR, ids: llmCheckoutIds },
              )
              .catch(() => undefined);
            const idSet = new Set(llmCheckoutIds);
            actions = actions.map((a) => {
              const key = a.actionId ?? a.selector;
              if (idSet.has(key)) {
                return { ...a, isCheckoutCta: true, isCheckoutByAttr: true };
              }
              return a;
            });
          }

          // PROPERTY-FIRST TERMINAL: known payment/checkout URL on a CTA
          // (href, data-href, …) always ends the funnel. The LLM often labels
          // these screens "branching" / "generic" ("no checkout signal") when
          // the URL lives only on data-* — without this override the walker
          // never hits checkout_end and can spin for hundreds of steps.
          const hasExternalCheckoutHref =
            actions.some((a) => !!a.isCheckoutByHref) ||
            this.htmlHasCheckoutLink(stateHtml) ||
            this.htmlHasStampedCheckout(stateHtml);
          if (hasExternalCheckoutHref && effectiveKind !== 'checkout_end') {
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} external checkout URL on CTA — forcing checkout_end (was ${effectiveKind})`,
            );
            effectiveKind = 'checkout_end';
          }

          // DEFENSE IN DEPTH: even if the LLM says "checkout_end", we only
          // stop here when we can point at an element that earns the title.
          // If no action on this screen carries a property-level checkout
          // signal (and no STRONG text match either), the page is simply
          // not a checkout — it's a results / confirmation / upsell page
          // with a plain advance button. Downgrade to `generic` so the
          // walker keeps exploring.
          if (effectiveKind === 'checkout_end') {
            const hasPropertyEvidence =
              actions.some(
                (a) =>
                  !!a.isCheckoutByHref ||
                  !!a.isCheckoutByAttr ||
                  !!a.isCheckoutByStrongText,
              ) ||
              this.htmlHasCheckoutLink(stateHtml) ||
              this.htmlHasStampedCheckout(stateHtml);
            if (!hasPropertyEvidence) {
              this.logger.warn(
                `[clone:${jobId ?? 'n/a'}] ${walkLabel} verdict said checkout_end but no property evidence on screen — downgrading to generic`,
              );
              effectiveKind = 'generic';
            } else {
              this.logger.log(
                `[clone:${jobId ?? 'n/a'}] ${walkLabel} reached checkout-end at ${currentStepId} "${fp.humanTitle.slice(0, 60)}", stopping exploration`,
              );
              break;
            }
          }

          if (!actions.length) {
            this.logger.log(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} no actions on step ${step} (type=${snapshot.stepType}), stopping`,
            );
            break;
          }

          // Loop-protection: if we revisit a signature AND every candidate
          // action was already spent for this screen, we *might* be in a
          // stable graph cycle — but often it is a single advance button that
          // failed once (overlay, disabled gate) and the next `for step`
          // iteration would bail before any retry. Allow a small number of
          // full clear-and-retry rounds per signature, then stop.
          if (!isFirstSeenInWalk) {
            const allClicked = actions.every((a) =>
              clickedActionsThisWalk.has(
                `${signature}|${a.actionId ?? a.selector}`,
              ),
            );
            if (allClicked) {
              const clears = revisitDeadlockClears.get(signature) ?? 0;
              const maxClears = 15;
              if (clears < maxClears) {
                revisitDeadlockClears.set(signature, clears + 1);
                for (const a of actions) {
                  clickedActionsThisWalk.delete(
                    `${signature}|${a.actionId ?? a.selector}`,
                  );
                }
                this.logger.debug(
                  `[clone:${jobId ?? 'n/a'}] ${walkLabel} revisit all actions spent — clearing click budget for this screen (${clears + 1}/${maxClears})`,
                );
              } else {
                this.logger.log(
                  `[clone:${jobId ?? 'n/a'}] ${walkLabel} revisit with no fresh actions left, stopping`,
                );
                break;
              }
            }
          }

          // Choose action: override has priority once we hit its source
          // signature; otherwise pick the first ranked.
          let chosen: Action;
          if (
            override &&
            !overrideConsumed &&
            overrideAtSignature === signature
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
            // On revisits of the same signature, avoid retrying the exact
            // same action forever. Prefer the first action that this walker
            // has not attempted yet for this signature.
            chosen =
              actions.find(
                (a) =>
                  !clickedActionsThisWalk.has(
                    `${signature}|${a.actionId ?? a.selector}`,
                  ),
              ) ?? actions[0];
          }

          // Record alternatives as forks to explore later. Fork selection is
          // step-type aware and uses the LLM verdict when available:
          //  - LLM branchActionIds: always forked (strongest hint).
          //  - radio/checkbox: forks are the OTHER options (not advance)
          //  - branching:      forks are the other branch buttons
          //  - generic:        any other option/advance candidate
          //
          // We still register forks even when a state is not isFirstSeenGlobal
          // IF the LLM flagged it as `branching` — otherwise branching screens
          // revisited via a parallel walker path would lose their siblings
          // (the real cause of "only men/hombres flow was captured").
          const branchIds = new Set(screenVerdict?.branchActionIds ?? []);
          const effectiveStepType = effectiveKind;
          const shouldRegisterForks =
            isFirstSeenGlobal ||
            effectiveStepType === 'branching' ||
            branchIds.size > 0;
          if (shouldRegisterForks) {
            const forkFilter = (a: Action): boolean => {
              if (a.selector === chosen.selector) return false;
              const aKey = a.actionId ?? a.selector;
              if (branchIds.size > 0) {
                return branchIds.has(aKey);
              }
              if (
                effectiveStepType === 'radio_then_continue' ||
                effectiveStepType === 'checkbox_then_continue'
              ) {
                return a.isOption && !a.isAdvance;
              }
              if (effectiveStepType === 'branching') {
                return a.isOption;
              }
              return a.isOption || a.isAdvance;
            };
            // Cap raised from 8 → 16: pricing pages with multiple plans
            // and quizzes with grids of 10+ option cards (e.g. "select all
            // your goals") were truncated and entire branches got lost.
            const alternatives = actions.filter(forkFilter).slice(0, 16);
            // Capture state ONCE per iteration — every alternative born
            // from this screen shares the same cookies/storage/URL, so
            // we don't need to call `storageState()` per alt.
            let stateSnapshot: ForkStateSnapshot | undefined;
            if (alternatives.length > 0) {
              stateSnapshot = await this.captureForkStateSnapshot(
                context,
                page,
              ).catch((err) => {
                this.logger.debug(
                  `[clone:${jobId ?? 'n/a'}] ${walkLabel} fork state capture failed: ${
                    err instanceof Error ? err.message : 'unknown'
                  }`,
                );
                return undefined;
              });
            }
            for (const alt of alternatives) {
              const forkKey = `${signature}|${alt.selector}`;
              if (exploredForks.has(forkKey)) continue;
              pendingForks.push({
                atSignature: signature,
                sourceStepId: currentStepId,
                alternative: alt,
                sourceUrl,
                stateSnapshot,
              });
            }
          }

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
            // Handle "disabled Continue" gates: free-text / numeric / select
            // inputs that must be filled before the advance button wakes up.
            // autoFillSelections() only handles radios/checkboxes — this
            // complements it for the no.diet-style height/weight/email/DOB
            // forms that caused the walker to stall mid-walk.
            await this.resolveQuizGateInputs(page, jobId, walkLabel, {
              useLlm,
            });
            // Give the SPA a tick to propagate validation state, then wait
            // for the button to become enabled before issuing the click.
            await page.waitForTimeout(150);
            let advanceReady = await this.waitForAdvanceEnabled(page, 1500);
            // Second chance: if advance is still disabled, the site probably
            // rejected one of our default values (typical for strict email
            // validators). Re-run the resolver — this path now triggers the
            // LLM fallback for ALL visible fields, not just unresolved ones.
            if (!advanceReady) {
              await this.resolveQuizGateInputs(page, jobId, walkLabel, {
                useLlm,
              });
              await page.waitForTimeout(250);
              advanceReady = await this.waitForAdvanceEnabled(page, 2000);
              if (!advanceReady) {
                this.logger.debug(
                  `[clone:${jobId ?? 'n/a'}] ${walkLabel} advance still disabled after 2 gate passes, proceeding anyway`,
                );
              }
            }
          }

          const beforeUrl = page.url();
          const beforeSnapshot = await page
            .evaluate((_arg: unknown) => {
              const full =
                document.body && document.body.innerText
                  ? document.body.innerText
                  : '';
              const txt = full.slice(0, 12000);
              const textLen = full.replace(/\s+/g, ' ').trim().length;
              const childCount = document.body
                ? document.body.childElementCount
                : 0;
              return { text: txt, textLen, childCount };
            }, null)
            .catch(() => ({ text: '', textLen: 0, childCount: 0 }));

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
              clickedOk = await page
                .evaluate((sel: string) => {
                  try {
                    const target = document.querySelector(sel) as
                      | HTMLElement
                      | null;
                    if (!target) return false;
                    target.scrollIntoView({ block: 'center' });
                    target.click();
                    return true;
                  } catch {
                    return false;
                  }
                }, chosen.selector)
                .catch(() => false);
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
            if (!fallback) {
              this.logger.debug(
                `[clone:${jobId ?? 'n/a'}] ${walkLabel} no fallback action — retrying next step (single CTA / overlay)`,
              );
              await page.waitForTimeout(650);
              continue;
            }
            try {
              await page.click(fallback.selector, {
                timeout: 3000,
                force: true,
                delay: 30,
              });
              chosen = fallback;
              clickedOk = true;
            } catch {
              this.logger.debug(
                `[clone:${jobId ?? 'n/a'}] ${walkLabel} fallback click failed — retrying next step`,
              );
              await page.waitForTimeout(650);
              continue;
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
          // body text change OR DOM child count change (React swap). Capped
          // by the per-step deadline so we never burn more than
          // MAX_TIME_PER_STEP_MS on a single transition.
          const waitDeadline = Math.min(Date.now() + 6000, stepDeadline);
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
                const full =
                  document.body && document.body.innerText
                    ? document.body.innerText
                    : '';
                const txt = full.slice(0, 12000);
                const textLen = full.replace(/\s+/g, ' ').trim().length;
                const childCount = document.body
                  ? document.body.childElementCount
                  : 0;
                return { text: txt, textLen, childCount };
              }, null)
              .catch(() => ({ text: '', textLen: 0, childCount: 0 }));
            if (
              (after.text && after.text !== beforeSnapshot.text) ||
              after.textLen !== beforeSnapshot.textLen ||
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
            // Also re-attempt gate resolution in case validation reset
            // values (common on branch transitions that re-render forms).
            await this.resolveQuizGateInputs(page, jobId, walkLabel, {
              useLlm,
            });
            let recoveredAdvance = await this.waitForAdvanceEnabled(page, 1200);
            if (!recoveredAdvance) {
              // Same two-pass strategy — second pass escalates to LLM for
              // ALL fields when the first pass left the button disabled.
              await this.resolveQuizGateInputs(page, jobId, walkLabel, {
                useLlm,
              });
              await page.waitForTimeout(250);
              recoveredAdvance = await this.waitForAdvanceEnabled(page, 1500);
            }
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
                  const full =
                    document.body && document.body.innerText
                      ? document.body.innerText
                      : '';
                  const txt = full.slice(0, 12000);
                  const textLen = full.replace(/\s+/g, ' ').trim().length;
                  const childCount = document.body
                    ? document.body.childElementCount
                    : 0;
                  return { text: txt, textLen, childCount };
                }, null)
                .catch(() => ({ text: '', textLen: 0, childCount: 0 }));
              if (
                (after2.text && after2.text !== beforeSnapshot.text) ||
                after2.textLen !== beforeSnapshot.textLen ||
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
                      const full =
                        document.body && document.body.innerText
                          ? document.body.innerText
                          : '';
                      const txt = full.slice(0, 12000);
                      const textLen = full.replace(/\s+/g, ' ').trim().length;
                      const cc = document.body
                        ? document.body.childElementCount
                        : 0;
                      return { text: txt, textLen, childCount: cc };
                    }, null)
                    .catch(() => ({ text: '', textLen: 0, childCount: 0 }));
                  if (
                    u3 !== beforeUrl ||
                    (a3.text && a3.text !== beforeSnapshot.text) ||
                    a3.textLen !== beforeSnapshot.textLen ||
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

          // Mark an action as spent only after a confirmed advance, or after
          // several no-op clicks (SPA updated copy below the first 12k chars,
          // same childCount, etc.) so we can rotate without poisoning the set
          // on the first failed detection.
          const chosenKey = `${signature}|${chosen.actionId ?? chosen.selector}`;
          if (advanced) {
            clickedActionsThisWalk.add(chosenKey);
            advanceFailCounts.delete(chosenKey);
          } else if (clickedOk) {
            const c = (advanceFailCounts.get(chosenKey) ?? 0) + 1;
            if (c >= 4) {
              clickedActionsThisWalk.add(chosenKey);
              advanceFailCounts.delete(chosenKey);
            } else {
              advanceFailCounts.set(chosenKey, c);
            }
          }

          await page
            .waitForLoadState('networkidle', { timeout: 3500 })
            .catch(() => undefined);

          if (hasStepBudget && Date.now() > stepDeadline) {
            this.logger.warn(
              `[clone:${jobId ?? 'n/a'}] ${walkLabel} step ${step} exceeded per-step budget (${effectiveStepBudgetMs}ms), stopping`,
            );
            prevStepId = currentStepId;
            prevAction = chosen;
            prevSiblings = actions;
            break;
          }

          prevStepId = currentStepId;
          prevAction = chosen;
          prevSiblings = actions;
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

    // Linear exploration produced the primary navigation path — the editor
    // can already edit captured steps while forks continue. Dismiss the
    // streaming “Capturando…” banner without waiting for every fork walker.
    if (walkerStreaming?.onStage) {
      await walkerStreaming
        .onStage({
          jobId: jobId ?? '',
          pageId: walkerStreaming.getPageId() ?? undefined,
          stage: 'interactive',
          message:
            'Exploração principal concluída — mapeando outros caminhos em segundo plano…',
          percent: 88,
        })
        .catch(() => undefined);
    }

    // 2) Fan-out: explore alternatives at registered fork points — in
    // parallel batches. Each walker owns its own Playwright page under the
    // shared browser context, so N=3 roughly divides the wall time by 3.
    // JS is single-threaded so the shared Map/Set/Array mutations inside
    // `runWalker` remain race-free (no await between related reads/writes).
    // Cada fork abre Playwright + grava meta em transação; em máquinas
    // locais com Postgres fraco, 3 forks paralelos + polling do editor
    // podem saturar conexões (P1001 / ECONNRESET). Override: CLONE_QUIZ_CONCURRENT_FORKS=1|2|…
    const concurrentForksRaw = Number(process.env.CLONE_QUIZ_CONCURRENT_FORKS);
    const CONCURRENT_FORKS =
      Number.isFinite(concurrentForksRaw) && concurrentForksRaw >= 1
        ? Math.min(6, Math.floor(concurrentForksRaw))
        : 3;
    let forksExplored = 0;
    while (
      pendingForks.length &&
      forksExplored < MAX_FORKS_TO_EXPLORE &&
      Date.now() < hardCapAt &&
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
    if (!useLlm) {
      return { variants, navigationMap };
    }
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

        // ----------------------------------------------------------------
        // React-friendly mutators. React/Next.js patches the native
        // setters on HTMLInputElement.value / .checked at module load to
        // intercept programmatic mutations — but it leaves the underlying
        // setters available via Object.getOwnPropertyDescriptor on the
        // PROTOTYPE. Calling those bypasses React's interceptor and lets
        // us simulate a real user input. Pair with `input` + `change`
        // events so React's onChange fires.
        // Reference: https://github.com/facebook/react/issues/10135
        // ----------------------------------------------------------------
        const protoValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        const protoCheckedSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'checked',
        )?.set;
        const textareaValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value',
        )?.set;
        const selectValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLSelectElement.prototype,
          'value',
        )?.set;
        const dispatchAll = (el: HTMLElement, events: string[]) => {
          for (const name of events) {
            try {
              el.dispatchEvent(new Event(name, { bubbles: true }));
            } catch {
              /* swallow */
            }
          }
        };
        const setReactValue = (
          el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
          value: string,
        ) => {
          try {
            const proto =
              el.tagName === 'TEXTAREA'
                ? textareaValueSetter
                : el.tagName === 'SELECT'
                  ? selectValueSetter
                  : protoValueSetter;
            if (proto) proto.call(el, value);
            else (el as { value: string }).value = value;
          } catch {
            try {
              (el as { value: string }).value = value;
            } catch {
              /* swallow */
            }
          }
          dispatchAll(el as HTMLElement, ['input', 'change', 'blur']);
        };
        const setReactChecked = (el: HTMLInputElement, checked: boolean) => {
          try {
            if (protoCheckedSetter) protoCheckedSetter.call(el, checked);
            else el.checked = checked;
          } catch {
            try {
              el.checked = checked;
            } catch {
              /* swallow */
            }
          }
          dispatchAll(el, ['click', 'input', 'change']);
        };
        // Realistic click sequence — some frameworks listen only to
        // pointer events and ignore plain `el.click()`. Dispatching the
        // full sequence covers Vue, Svelte, Solid, raw addEventListener
        // listeners, etc.
        const realClick = (el: HTMLElement) => {
          try {
            const r = el.getBoundingClientRect();
            const x = r.left + r.width / 2;
            const y = r.top + r.height / 2;
            const opts = {
              bubbles: true,
              cancelable: true,
              clientX: x,
              clientY: y,
              button: 0,
              composed: true,
            } as MouseEventInit;
            try {
              el.dispatchEvent(
                new PointerEvent('pointerdown', {
                  ...opts,
                  pointerType: 'mouse',
                } as PointerEventInit),
              );
            } catch {
              /* not all browsers expose PointerEvent ctor */
            }
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            try {
              el.dispatchEvent(
                new PointerEvent('pointerup', {
                  ...opts,
                  pointerType: 'mouse',
                } as PointerEventInit),
              );
            } catch {
              /* swallow */
            }
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
            try {
              el.click();
            } catch {
              /* swallow */
            }
          } catch {
            try {
              el.click();
            } catch {
              /* swallow */
            }
          }
        };

        // ----------------------------------------------------------------
        // 1. Real radio inputs grouped by name — React-friendly.
        // ----------------------------------------------------------------
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
            // 1a) Set checked via the prototype setter so React state
            //     actually updates.
            setReactChecked(first, true);
            // 1b) Then realClick the styled label so any custom JS that
            //     listens for clicks on the wrapper (and not the input)
            //     also fires.
            const lbl =
              first.closest('label') ||
              document.querySelector(`label[for="${first.id}"]`);
            if (lbl) realClick(lbl as HTMLElement);
          }
        }

        // ----------------------------------------------------------------
        // 2. ARIA radio cards (role="radio") — realClick first per group.
        // ----------------------------------------------------------------
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
          realClick(card);
          // Mirror to nested input if any.
          const nested = card.querySelector(
            'input[type="radio"]',
          ) as HTMLInputElement | null;
          if (nested) setReactChecked(nested, true);
        }

        // ----------------------------------------------------------------
        // 3. Real checkboxes — React-friendly.
        // ----------------------------------------------------------------
        const realCheckboxes = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'),
        ).filter(isVisible);
        const anyRealChecked = realCheckboxes.some((c) => c.checked);
        if (!anyRealChecked && realCheckboxes.length > 0) {
          const first = realCheckboxes[0];
          if (!first.disabled) {
            setReactChecked(first, true);
            const lbl =
              first.closest('label') ||
              document.querySelector(`label[for="${first.id}"]`);
            if (lbl) realClick(lbl as HTMLElement);
          }
        }

        // ----------------------------------------------------------------
        // 4. ARIA checkbox / switch cards.
        // ----------------------------------------------------------------
        const ariaCheckboxes = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="checkbox"], [role="switch"]',
          ),
        ).filter(isVisible);
        const anyAriaChecked = ariaCheckboxes.some(
          (c) => c.getAttribute('aria-checked') === 'true',
        );
        if (!anyAriaChecked && ariaCheckboxes.length > 0) {
          realClick(ariaCheckboxes[0]);
          const nested = ariaCheckboxes[0].querySelector(
            'input[type="checkbox"]',
          ) as HTMLInputElement | null;
          if (nested) setReactChecked(nested, true);
        }

        // ----------------------------------------------------------------
        // 4.5 InLead multi-select cards.
        //
        // InLead often renders checkbox-like cards with:
        //   .option-icon-value
        // and no native input[type=checkbox]/role=checkbox exposed.
        // If we don't pre-select multiple cards here, "Continuar" may stay
        // blocked and the walker stalls forever on the same step.
        // ----------------------------------------------------------------
        const inleadOptionBadges = Array.from(
          document.querySelectorAll<HTMLElement>('.option-icon-value'),
        ).filter(isVisible);
        if (inleadOptionBadges.length >= 2) {
          const isLikelySelected = (el: HTMLElement): boolean => {
            try {
              const host =
                el.closest(
                  '[aria-checked], [data-checked], [data-selected], [aria-selected], label, button, [role="button"], [role="option"], [role="checkbox"]',
                ) ??
                el.parentElement ??
                el;
              if (!host) return false;
              if (host.getAttribute('aria-checked') === 'true') return true;
              if (host.getAttribute('aria-selected') === 'true') return true;
              if (host.getAttribute('data-checked') === 'true') return true;
              if (host.getAttribute('data-selected') === 'true') return true;
              const cls = (host.className || '').toString().toLowerCase();
              if (
                cls.includes('selected') ||
                cls.includes('checked') ||
                cls.includes('active')
              ) {
                return true;
              }
              const cs = getComputedStyle(host);
              const borderWidth = parseFloat(cs.borderWidth || '0');
              if (borderWidth >= 2) return true;
              const bg = (cs.backgroundColor || '').toLowerCase();
              if (
                bg.includes('rgb(249') ||
                bg.includes('rgb(245') ||
                bg.includes('rgb(234')
              ) {
                return true;
              }
              return false;
            } catch {
              return false;
            }
          };
          const uniqueHosts: HTMLElement[] = [];
          const seenHosts = new Set<HTMLElement>();
          for (const badge of inleadOptionBadges) {
            const host = (badge.closest(
              'label, button, [role="button"], [role="option"], [role="checkbox"], .cursor-pointer, .option-item, .option-card',
            ) ??
              badge.parentElement ??
              badge) as HTMLElement;
            if (!host || seenHosts.has(host) || !isVisible(host)) continue;
            seenHosts.add(host);
            uniqueHosts.push(host);
          }
          const selectedHosts = uniqueHosts.filter(isLikelySelected);
          const minSelections = Math.min(2, uniqueHosts.length);
          if (selectedHosts.length < minSelections) {
            let needed = minSelections - selectedHosts.length;
            for (const host of uniqueHosts) {
              if (needed <= 0) break;
              if (selectedHosts.includes(host)) continue;
              realClick(host);
              needed -= 1;
            }
          }
        }

        // ----------------------------------------------------------------
        // 5. Range / slider inputs — leave at midpoint if untouched. The
        // captured DOM signature changes on input event so React state
        // syncs.
        // ----------------------------------------------------------------
        const ranges = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[type="range"]'),
        ).filter(isVisible);
        for (const r of ranges) {
          if (r.disabled) continue;
          const min = parseFloat(r.min || '0');
          const max = parseFloat(r.max || '100');
          const mid = String(Math.round((min + max) / 2));
          // Always set — even if the slider already has a value, React
          // may not have registered it as "user-changed" yet (some
          // sliders ship with default value but `userInteracted=false`
          // gating the Continue button).
          setReactValue(r, mid);
        }

        // ----------------------------------------------------------------
        // 6. Empty number / text / tel / email / date inputs — best-effort
        // defaults so quizzes that ASK for age/weight/height/email don't
        // hard-block. We pick reasonable values based on label / name /
        // placeholder hints.
        // ----------------------------------------------------------------
        const guessLabel = (el: HTMLInputElement): string => {
          const parts: string[] = [];
          if (el.name) parts.push(el.name);
          if (el.id) parts.push(el.id);
          if (el.placeholder) parts.push(el.placeholder);
          const aria = el.getAttribute('aria-label');
          if (aria) parts.push(aria);
          const lbl =
            el.closest('label') ||
            document.querySelector(`label[for="${el.id}"]`);
          if (lbl)
            parts.push(((lbl as HTMLElement).innerText || '').slice(0, 80));
          // Walk a couple of ancestors looking for a question heading.
          let cur: HTMLElement | null = el.parentElement;
          for (let depth = 0; depth < 3 && cur; depth += 1) {
            const txt = (cur.innerText || '').slice(0, 200);
            if (txt) parts.push(txt);
            cur = cur.parentElement;
          }
          return parts.join(' | ').toLowerCase();
        };
        const pickDefault = (el: HTMLInputElement, label: string): string => {
          const t = (el.type || '').toLowerCase();
          if (t === 'email') return 'usuario@example.com';
          if (t === 'tel') return '11999990000';
          if (t === 'date') {
            const d = new Date();
            d.setFullYear(d.getFullYear() - 30);
            return d.toISOString().slice(0, 10);
          }
          if (t === 'number') {
            const min = el.min ? parseFloat(el.min) : NaN;
            const max = el.max ? parseFloat(el.max) : NaN;
            if (/idade|age|year|ano/i.test(label)) return '35';
            if (/peso|weight/i.test(label)) {
              if (/lb|libra/i.test(label)) return '160';
              return '70';
            }
            if (/altura|height|cm|metr|cintura|waist/i.test(label))
              return '170';
            if (!Number.isNaN(min) && !Number.isNaN(max)) {
              return String(Math.round((min + max) / 2));
            }
            if (!Number.isNaN(min)) return String(min);
            return '30';
          }
          if (/nome|name/i.test(label)) return 'Usuario Teste';
          if (/cep|zip/i.test(label)) return '01310100';
          if (/cpf/i.test(label)) return '12345678909';
          return 'Teste';
        };
        const fillableInputs = Array.from(
          document.querySelectorAll<HTMLInputElement>(
            'input[type="number"], input[type="text"], input[type="tel"], input[type="email"], input[type="date"], input:not([type])',
          ),
        ).filter((i) => isVisible(i) && !i.disabled && !i.readOnly && !i.value);
        for (const inp of fillableInputs) {
          const label = guessLabel(inp);
          const value = pickDefault(inp, label);
          setReactValue(inp, value);
        }

        // ----------------------------------------------------------------
        // 7. Native <select> with no value chosen — pick first non-empty
        // option.
        // ----------------------------------------------------------------
        const selects = Array.from(
          document.querySelectorAll<HTMLSelectElement>('select'),
        ).filter(isVisible);
        for (const s of selects) {
          if (s.disabled || s.value) continue;
          const opt = Array.from(s.options).find((o) => o.value && !o.disabled);
          if (opt) setReactValue(s, opt.value);
        }
      } catch {
        /* swallow */
      }
    }, null);
  }

  /**
   * Universal "is this a transient loading screen?" decision.
   *
   * Three layers, cheapest first, most expensive last. Returns true when we
   * should keep polling instead of capturing/recording this snapshot:
   *
   *   1. Explicit loader signals already flagged by the browser probe
   *      (CSS classes, multilingual keywords, animated shapes).
   *   2. Temporal/structural heuristic: compare the current snapshot to a
   *      baseline snapshot previously accepted as a real step. A screen
   *      that's dramatically smaller (much less text, fewer interactives,
   *      no visible question) is almost certainly a transition frame.
   *   3. LLM arbiter: if Ollama is reachable and layers 1-2 were ambiguous
   *      (low interactivity, short text, no question) ask the model to
   *      classify. Verdict is cached by content hash so re-visits of the
   *      same loader across walker forks cost zero tokens.
   *
   * The function is fail-safe: if the LLM isn't reachable or returns
   * garbage, we fall back to "not transient" and let the walker proceed —
   * never worse than today's behavior.
   */
  private async isLikelyTransientScreen(
    snapshot: QuizStateSnapshot,
    baseline: QuizStateSnapshot | null,
    opts: { useLlm: boolean } = { useLlm: true },
  ): Promise<boolean> {
    if (snapshot.stepType === 'fake_loader') return true;

    const r = snapshot.readiness;
    const textLen = r.textLen || 0;
    const interactiveCount = r.interactiveCount;
    const hasQuestion = r.hasQuestion;

    if (r.hasLoader && !hasQuestion && interactiveCount <= 2) return true;

    // Temporal/structural heuristic. Only applies when we already have a
    // solid baseline — the first real step of the walk is kept as-is.
    if (baseline) {
      const baseTextLen = baseline.readiness.textLen || 0;
      const baseInteractives = baseline.readiness.interactiveCount;
      const shrankALot =
        baseTextLen > 0 && textLen < Math.max(120, baseTextLen * 0.25);
      const lostInteractives = baseInteractives >= 2 && interactiveCount <= 1;
      if (shrankALot && lostInteractives && !hasQuestion) return true;
    }

    // LLM arbiter. Only fires for "looks suspicious but no explicit signal"
    // cases: few interactives, short-ish text, no clear question. Skip for
    // pages that obviously have a real step (rich text + question or
    // multiple choices).
    const ambiguous =
      !hasQuestion && interactiveCount <= 2 && textLen < 1200 && textLen > 0;
    if (!ambiguous) return false;
    // Per-job opt-out: skip the Ollama arbiter and accept the state.
    if (!opts.useLlm) return false;

    const visibleButtons = (snapshot.actions || [])
      .filter(
        (a) =>
          typeof a.triggerText === 'string' && a.triggerText.trim().length > 0,
      )
      .map((a) => a.triggerText);
    // Build a compact text sample from what the snapshot exposes — this
    // keeps us independent of the DOM (no extra page.evaluate).
    const textSample = [
      snapshot.questionText || '',
      (snapshot.optionLabels || []).slice(0, 12).join(' | '),
      visibleButtons.slice(0, 6).join(' | '),
    ]
      .filter(Boolean)
      .join('\n')
      .slice(0, 900);
    const verdict = await this.llmAssistService
      .isTransientLoadingScreen(textSample, visibleButtons, hasQuestion)
      .catch(() => null);
    return verdict === true;
  }

  /**
   * Resolve "gate" inputs that keep the Continue button disabled — text,
   * number, email, phone, date, select and textarea fields. Works in two
   * phases:
   *
   *   1. Heuristic pass (browser, <50ms): fills everything it recognizes
   *      using attribute/label-based rules. React-safe setter is used so
   *      controlled components pick up the value.
   *   2. LLM fallback (only if phase 1 left gaps AND advance still disabled):
   *      asks Ollama for plausible values for the remaining fields. Result
   *      is cached by gateSignature across walks/forks.
   *
   * Returns a lightweight summary for logging.
   */
  private async resolveQuizGateInputs(
    page: {
      evaluate: <T, A>(
        pageFunction: (arg: A) => Promise<T> | T,
        arg: A,
      ) => Promise<T>;
    },
    jobId: string | undefined,
    walkLabel: string,
    opts: { useLlm: boolean } = { useLlm: true },
  ): Promise<{ filled: number; unresolved: number; usedLlm: boolean }> {
    // Install the browser helper once per page (idempotent).
    await page
      .evaluate((script: string) => {
        try {
          eval(script);
        } catch {
          /* swallow */
        }
      }, QUIZ_GATE_RESOLVER_BROWSER_JS)
      .catch(() => undefined);

    const report = await page
      .evaluate((_arg: unknown) => {
        const api = (
          window as unknown as {
            __criaaiGateResolver?: { run: () => GateResolverReport };
          }
        ).__criaaiGateResolver;
        if (!api) return null;
        try {
          return api.run();
        } catch {
          return null;
        }
      }, null)
      .catch(() => null);

    if (!report) {
      return { filled: 0, unresolved: 0, usedLlm: false };
    }

    const heuristicFilled = report.fields.filter((f) => f.resolved).length;
    let usedLlm = false;

    // We call the LLM in two situations:
    //   (a) The heuristic left some fields unresolved AND the button is
    //       still disabled — clearly missing data.
    //   (b) The heuristic filled EVERYTHING but the button is STILL disabled
    //       — most common cause: the site's JS validator rejected one of
    //       our default values (e.g. it rejected the default email because
    //       it uses a private TLD, or the CPF/phone format is wrong).
    //       In this case we ask the LLM to suggest better values for ALL
    //       fields it can see, so it has a chance to override whatever was
    //       typed.
    const shouldAskLlm =
      opts.useLlm &&
      report.advanceStillDisabled &&
      (report.unresolved.length > 0 || heuristicFilled > 0);

    if (shouldAskLlm) {
      try {
        const heading = report.fields[0]?.questionText ?? '';
        // If everything was resolved but the button is still disabled, send
        // ALL fields for reconsideration. Otherwise just the unresolved ones.
        const targetFields =
          report.unresolved.length > 0 ? report.unresolved : report.fields;
        const suggestions = await this.llmAssistService.resolveFormGate(
          report.gateSignature,
          targetFields.map((f) => ({
            selector: f.selector,
            tag: f.tag,
            type: f.type,
            idLabel: f.idLabel,
            questionText: f.questionText,
          })),
          heading,
        );
        if (suggestions.length) {
          usedLlm = true;
          await page
            .evaluate((items: unknown) => {
              const api = (
                window as unknown as {
                  __criaaiGateResolver?: {
                    applyLlm: (
                      items: Array<{ selector: string; value: string }>,
                    ) => number;
                  };
                }
              ).__criaaiGateResolver;
              if (!api) return 0;
              try {
                return api.applyLlm(
                  items as Array<{ selector: string; value: string }>,
                );
              } catch {
                return 0;
              }
            }, suggestions)
            .catch(() => 0);
          this.logger.log(
            `[clone:${jobId ?? 'n/a'}] ${walkLabel} gate LLM fallback applied ${suggestions.length} field(s) (sig=${report.gateSignature}, reason=${report.unresolved.length > 0 ? 'unresolved' : 'validator-rejected'})`,
          );
        }
      } catch (err) {
        this.logger.debug(
          `[clone:${jobId ?? 'n/a'}] ${walkLabel} gate LLM fallback error: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      }
    }

    if (heuristicFilled || report.unresolved.length) {
      this.logger.debug(
        `[clone:${jobId ?? 'n/a'}] ${walkLabel} gate resolver filled=${heuristicFilled} unresolved=${
          report.unresolved.length
        } advanceDisabled=${report.advanceStillDisabled} rules=${report.fields
          .map((f) => f.ruleId)
          .join(',')}`,
      );
    }

    return {
      filled: heuristicFilled,
      unresolved: report.unresolved.length,
      usedLlm,
    };
  }

  /**
   * Poll until an advance/submit button on the page becomes enabled,
   * or the deadline hits. Returns true when at least one advance button
   * is clickable (`:not([disabled])` + aria-disabled not "true").
   */
  private async waitForAdvanceEnabled(
    page: {
      evaluate: <T, A>(
        pageFunction: (arg: A) => Promise<T> | T,
        arg: A,
      ) => Promise<T>;
      waitForTimeout: (ms: number) => Promise<void>;
    },
    timeoutMs = 1500,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const enabled = await page
        .evaluate((_arg: unknown) => {
          const all = Array.from(
            document.querySelectorAll<HTMLElement>('button, [role="button"]'),
          );
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            if (rect.width <= 2 || rect.height <= 2) continue;
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') continue;
            const text = (el.textContent || '').toLowerCase().trim();
            const dt = (el.getAttribute('data-testid') || '').toLowerCase();
            const looksAdvance =
              (el as HTMLButtonElement).type === 'submit' ||
              /(continuar|continue|next|siguiente|avancar|avanzar|submit|enviar|empezar|comecar|start|ok)/.test(
                text,
              ) ||
              /continue|submit|advance|next|start/.test(dt);
            if (!looksAdvance) continue;
            const disabled =
              (el as HTMLButtonElement).disabled === true ||
              el.getAttribute('aria-disabled') === 'true';
            if (!disabled) return true;
          }
          return false;
        }, null)
        .catch(() => false);
      if (enabled) return true;
      await page.waitForTimeout(100);
    }
    return false;
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
          // Same realistic click sequence used by autoFillSelections —
          // many SPAs ignore plain `el.click()` and only react to the
          // full pointerdown→mousedown→pointerup→mouseup→click chain.
          const realClick = (el: HTMLElement) => {
            try {
              const r = el.getBoundingClientRect();
              const x = r.left + r.width / 2;
              const y = r.top + r.height / 2;
              const opts = {
                bubbles: true,
                cancelable: true,
                clientX: x,
                clientY: y,
                button: 0,
                composed: true,
              } as MouseEventInit;
              try {
                el.dispatchEvent(
                  new PointerEvent('pointerdown', {
                    ...opts,
                    pointerType: 'mouse',
                  } as PointerEventInit),
                );
              } catch {
                /* swallow */
              }
              el.dispatchEvent(new MouseEvent('mousedown', opts));
              try {
                el.dispatchEvent(
                  new PointerEvent('pointerup', {
                    ...opts,
                    pointerType: 'mouse',
                  } as PointerEventInit),
                );
              } catch {
                /* swallow */
              }
              el.dispatchEvent(new MouseEvent('mouseup', opts));
              el.dispatchEvent(new MouseEvent('click', opts));
              try {
                el.click();
              } catch {
                /* swallow */
              }
            } catch {
              try {
                el.click();
              } catch {
                /* swallow */
              }
            }
          };
          for (const c of candidates) {
            if (!isVisible(c)) continue;
            if (c === advanceEl) continue;
            if (advanceEl && c.contains(advanceEl)) continue;
            if (advanceEl && advanceEl.contains(c)) continue;
            try {
              realClick(c);
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

  /**
   * Calls SingleFile CLI as a sidecar to produce a fully self-contained
   * HTML for the current `page`. Returns null when the feature flag is
   * off, the binary is missing, the subprocess fails, or it exceeds its
   * 60s budget. Designed to fail soft — a missing SingleFile candidate
   * just means the existing MHTML/DOM candidates compete on their own.
   *
   * Uses the same cookies as the live Playwright context so authenticated
   * states (e.g. sites that gate content behind a session) can still be
   * snapshotted.
   */
  private async captureSingleFileSnapshot(
    context: {
      cookies: () => Promise<Array<unknown>>;
    },
    page: { url: () => string },
    profile: UserAgentProfile,
    jobId: string | undefined,
  ): Promise<string | null> {
    if (process.env.CRIAAI_USE_SINGLEFILE !== '1') return null;
    try {
      const available = await isSingleFileAvailable();
      if (!available) {
        this.logger.warn(
          `[clone:${jobId ?? 'n/a'}] SingleFile binary not available; skipping`,
        );
        return null;
      }
      const rawCookies = await context.cookies().catch(() => []);
      const cookies = (rawCookies as Array<unknown>).map(
        (c) => c as Record<string, unknown>,
      );
      const executablePath = this.resolvePlaywrightChromiumPath();
      const targetUrl = page.url();
      this.logger.log(
        `[clone:${jobId ?? 'n/a'}] SingleFile capture starting (cookies=${cookies.length}, exec=${executablePath ?? 'system'})`,
      );
      const result = await runSingleFile({
        url: targetUrl,
        cookies,
        userAgent: profile.userAgent,
        browserExecutablePath: executablePath ?? undefined,
        timeoutMs: 60_000,
      });
      if (!result.html) {
        this.logger.warn(
          `[clone:${jobId ?? 'n/a'}] SingleFile capture failed (${result.error ?? 'no_output'}, ${result.durationMs}ms)`,
        );
        return null;
      }
      this.logger.log(
        `[clone:${jobId ?? 'n/a'}] SingleFile capture ok bytes=${result.html.length} durationMs=${result.durationMs}`,
      );
      return result.html;
    } catch (err) {
      this.logger.warn(
        `[clone:${jobId ?? 'n/a'}] SingleFile capture threw: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return null;
    }
  }

  /**
   * Detect "host page is just a wrapper for a producer-hosted quiz" and
   * redirect the entire fetchSourceRendered run at the iframe URL.
   *
   * Heuristics (ALL must match):
   *   - The parent page contains at least one visible iframe whose src
   *     points at a known producer host (Cakto, Hotmart, Kiwify, Eduzz,
   *     Ticto, Monetizze, …).
   *   - The parent page is "lean": fewer than 280 chars of body text or
   *     fewer than 6 visible interactives. A real LP rarely fits that
   *     description; a wrapper page does.
   *
   * When matched, recurses once into `fetchSourceRendered` with the
   * iframe URL and `skipIframeRedirect=true` so we can't loop.
   */
  private async maybeRedirectToQuizIframe(
    parentHtml: string,
    parentUrl: string,
    originalUrl: string,
    jobId: string | undefined,
    options: CloneRunOptions | undefined,
    profile: UserAgentProfile | undefined,
  ): Promise<{
    html: string;
    publicPages: CapturedPublicPage[];
    navigationMap: NavigationEdge[];
  } | null> {
    try {
      const $ = load(parentHtml);
      const producerHosts = [
        'cakto',
        'hotmart',
        'kiwify',
        'eduzz',
        'ticto',
        'monetizze',
        'doppus',
        'perfectpay',
        'lastlink',
        'kirvano',
        'yampi',
      ];
      let matchedIframeSrc: string | null = null;
      $('iframe[src]').each((_i, el) => {
        if (matchedIframeSrc) return;
        const src = ($(el).attr('src') || '').trim();
        if (!src || !src.startsWith('http')) return;
        const lower = src.toLowerCase();
        if (producerHosts.some((host) => lower.includes(host))) {
          matchedIframeSrc = src;
        }
      });
      if (!matchedIframeSrc) return null;

      // Lean check on the parent. We only redirect when the parent does
      // NOT look like a real LP — otherwise we'd prefer to clone the LP
      // and let the walker open the iframe normally during exploration.
      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      const visibleInteractives = $(
        'button, a[href], [role="button"], input, label',
      ).length;
      const looksLean = bodyText.length < 280 || visibleInteractives < 6;
      if (!looksLean) return null;

      this.logger.log(
        `[clone:${jobId ?? 'n/a'}] iframe-as-source redirect parent=${parentUrl} → iframe=${matchedIframeSrc} (textLen=${bodyText.length}, interactives=${visibleInteractives})`,
      );
      void originalUrl;

      return await this.fetchSourceRendered(
        matchedIframeSrc,
        jobId,
        options,
        profile,
        true,
      );
    } catch (err) {
      this.logger.debug(
        `[clone:${jobId ?? 'n/a'}] iframe redirect probe failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
      return null;
    }
  }

  /**
   * Best-effort lookup of the Playwright bundled Chromium path. Single
   * File honours `--browser-executable-path` so reusing the binary we
   * already shipped saves disk + ensures consistent rendering.
   */
  private resolvePlaywrightChromiumPath(): string | null {
    try {
      // Lazy require so we don't pull playwright at module-load.

      const playwright = require('playwright') as {
        chromium?: { executablePath?: () => string };
      };
      const path = playwright?.chromium?.executablePath?.();
      return typeof path === 'string' && path.length > 0 ? path : null;
    } catch {
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
      const finalUrl = page.url();
      const rawHtml = await page.content();
      const html = await this.inlineExternalScriptsInHtml(rawHtml, finalUrl);
      return {
        html,
        url: finalUrl,
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

    // Language-agnostic snapshot scoring.
    //
    // The earlier implementation included a hardcoded Portuguese phrase
    // ("o que você acompanha") as an anchor bonus — useless on any non
    // pt-BR page (and even on pt-BR pages with different copywriting).
    //
    // We replaced it with universal signals that correlate with "the page
    // has finished hydrating and has real, visible content":
    //   - `<img>` with a real src AND `naturalWidth > 0` (the bitmap
    //     actually loaded — not just a dangling tag).
    //   - `<iframe>`/`<video>` with a resolved src or poster, given enough
    //     area to be visually meaningful.
    //   - Visible body text length (proxy for "content has rendered").
    //   - Ratio of nodes carrying a non-empty CSS background-image —
    //     hero sections, gradients, decorative tiles all count.
    //
    // The numeric weights mirror the "media + backgrounds" intuition of
    // the previous score so existing tuning stays comparable.
    const evaluateScore = async () => {
      const score = (await page.evaluate(() => {
        const visibleArea = (el: Element) => {
          const rect = el.getBoundingClientRect();
          return rect.width * rect.height;
        };
        const mediaScore =
          Array.from(document.querySelectorAll('img')).filter((img) => {
            const tag = img;
            const hasSrc = !!(img.getAttribute('src') || tag.currentSrc);
            const decoded = (tag.naturalWidth || 0) > 0;
            return hasSrc && decoded && visibleArea(img) > 2000;
          }).length *
            2 +
          Array.from(document.querySelectorAll('iframe')).filter(
            (frame) => frame.getAttribute('src') && visibleArea(frame) > 4000,
          ).length *
            4 +
          Array.from(document.querySelectorAll('video')).filter((video) => {
            const tag = video;
            const hasSrc = !!(
              video.getAttribute('src') ||
              tag.currentSrc ||
              video.getAttribute('poster')
            );
            return hasSrc && visibleArea(video) > 4000;
          }).length *
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
        const bodyText = (document.body?.innerText ?? '').trim();
        // Rough text bonus: 1 point every ~250 chars, capped at 16 so the
        // textual signal can't dominate visually-heavy pages on its own.
        const textScore = Math.min(16, Math.floor(bodyText.length / 250));
        return mediaScore + richBackgrounds + textScore;
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

  /**
   * Fetches every external `<script src="…">` from inside the live page
   * (same browser context, so cookies and CORS are honored) and rewrites
   * the tag to inline the bundle's bytes.
   *
   * Why this is critical: the cloned HTML lives inside an iframe with
   * `srcdoc=` (origin: about:srcdoc / null). When the iframe parses
   * `<script src="https://inlead.digital/_next/static/chunks/main.js">`,
   * the browser issues a cross-origin request that fails on virtually
   * any modern host:
   *   - Next.js / Vercel send `Cross-Origin-Resource-Policy: same-origin`
   *     by default → cross-origin GET is blocked.
   *   - `<script type="module">` + `<script crossorigin>` REQUIRE CORS
   *     headers the original site doesn't send for non-same-origin
   *     callers.
   *   - CSP / COEP can layer on additional blocks.
   *
   * The result was a clone with all the markup but zero functional
   * JavaScript: weight sliders sat motionless, kg↔lb toggles never
   * switched, "Continuar" stayed permanently disabled, custom selects
   * never highlighted.
   *
   * Inlining sidesteps every one of those failure modes — the script
   * body lives inside `<script>…</script>` so the iframe just executes
   * it. Same-origin policy stops being relevant because there's no
   * origin involved, the script is part of the document.
   *
   * Failures are soft: if any individual `src` 404s or the host blocks
   * the fetch, the original `<script src>` tag is left alone (it'll
   * still try at runtime; some assets do allow cross-origin GET).
   */
  /**
   * Server-side script inlining. Operates on an HTML *string* in Node,
   * NOT on the live DOM of the captured page.
   *
   * Why this matters: a previous version did the same work inside
   * `page.evaluate(...)` and replaced the live `<script src>` tags with
   * inline `<script>…code…</script>` clones. The browser interprets a
   * fresh inline script as something it must execute → the original
   * site's bundle ran a SECOND time, on top of an already-mounted
   * React/Next.js app, blowing away the captured state, unmounting
   * components and leaving us with a blank snapshot. Quiz walkers
   * mid-flight got "click failed at step 0" the moment the bundle
   * re-bootstrapped.
   *
   * Doing it server-side after `page.content()` sidesteps that entirely:
   * the HTML at this point is just a string, no JS engine attached.
   * The browser only encounters the inlined bytes when the FRONTEND
   * iframe parses the snapshot, and at that point a single execution
   * is exactly what we want.
   *
   * Cookies/auth: we fetch each `src` from Node without the browser's
   * cookie jar. That's fine for public marketing pages and quizzes (the
   * common case). If a future site requires authenticated bundle
   * downloads we'd need to forward cookies via Playwright's context.
   */
  private async inlineExternalScriptsInHtml(
    html: string,
    baseUrl: string,
    jobId?: string,
  ): Promise<string> {
    let succeeded = 0;
    let failed = 0;
    let total = 0;

    // Manual scan: cheerio's text setter on <script> escapes special
    // chars (which would corrupt JS containing `<`, `&`, etc.). Doing
    // it as a raw string replace keeps the bundle bytes intact.
    const scriptTagRe =
      /<script\b([^>]*)\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>(?:\s*)<\/script>/gi;
    const tagsToReplace: Array<{
      match: string;
      url: string;
      attrs: string;
    }> = [];
    {
      let m: RegExpExecArray | null;
      while ((m = scriptTagRe.exec(html)) !== null) {
        const beforeSrc = m[1] || '';
        const afterSrc = m[6] || '';
        const url = (m[3] ?? m[4] ?? m[5] ?? '').trim();
        if (!url) continue;
        if (url.startsWith('data:') || url.startsWith('blob:')) continue;
        tagsToReplace.push({
          match: m[0],
          url,
          attrs: `${beforeSrc} ${afterSrc}`.replace(/\s+/g, ' ').trim(),
        });
      }
    }
    total = tagsToReplace.length;

    if (total === 0) return html;

    const fetchCode = async (url: string): Promise<string | null> => {
      let absolute: string;
      try {
        absolute = new URL(url, baseUrl).toString();
      } catch {
        return null;
      }
      try {
        const response = await fetch(absolute, {
          // A real-ish UA gets us past most CDN bot filters that would
          // otherwise return a stub.
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept: '*/*',
            'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8',
            Referer: baseUrl,
          },
        });
        if (!response.ok) return null;
        const text = await response.text();
        return text || null;
      } catch {
        return null;
      }
    };

    // Fetch up to N in parallel — Next.js bundles often number 20+ and
    // serial fetches add up. Keep concurrency modest so we don't get
    // rate-limited.
    const CONCURRENCY = 8;
    const results = new Map<string, string | null>();
    for (let i = 0; i < tagsToReplace.length; i += CONCURRENCY) {
      const slice = tagsToReplace.slice(i, i + CONCURRENCY);
      // De-dupe URL fetches inside the same batch.
      await Promise.all(
        slice.map(async ({ url }) => {
          if (results.has(url)) return;
          results.set(url, await fetchCode(url));
        }),
      );
    }

    let updated = html;
    for (const { match, url, attrs } of tagsToReplace) {
      const code = results.get(url);
      if (!code) {
        failed += 1;
        continue;
      }
      // Defang any `</script>` that might appear inside the bundle
      // string — extremely rare in minified code but it WILL terminate
      // our wrapping tag if present.
      const safeCode = code.replace(/<\/script/gi, '<\\/script');
      const cleanAttrs = attrs
        .replace(
          /\b(?:src|crossorigin|integrity|nonce)\s*=\s*("[^"]*"|'[^']*'|\S+)/gi,
          '',
        )
        .replace(/\s+/g, ' ')
        .trim();
      const replacement = `<script ${cleanAttrs ? cleanAttrs + ' ' : ''}data-inlined-from="${url
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')}">${safeCode}</script>`;
      // First-occurrence replace (each tag is unique enough — they
      // contain the absolute src). Loop matches by exact substring.
      const idx = updated.indexOf(match);
      if (idx === -1) {
        failed += 1;
        continue;
      }
      updated =
        updated.slice(0, idx) + replacement + updated.slice(idx + match.length);
      succeeded += 1;
    }

    if (jobId && total > 0) {
      this.logger.log(
        `[clone:${jobId}] inlined scripts: ${succeeded}/${total} (failed=${failed})`,
      );
    }
    return updated;
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
            (img.getAttribute('src') || img.currentSrc) &&
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
              video.currentSrc ||
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
   * Checkout / paywall screens often mount the VSL column and hero copy **after**
   * the checkout CTAs resolve — `waitForQuizStepReady` used to return as soon as
   * `checkout_end` + payment href matched, producing nearly blank snapshots (only
   * progress chrome). Poll until video embeds appear or body copy grows, capped.
   */
  private async flushCheckoutDeferredDom(page: {
    evaluate: <T, A>(
      pageFunction: (arg: A) => Promise<T> | T,
      arg: A,
    ) => Promise<T>;
    waitForTimeout: (ms: number) => Promise<void>;
  }): Promise<void> {
    const maxMs = 14_000;
    const started = Date.now();
    let stable = 0;
    let lastSig = '';
    /* Known VSL / checkout video CDN hosts — iframe src often arrives seconds later */
    const VIDEO_IFRAME_SRC =
      /scripts\.converteai|players\.converteai|cdn\.vturb|vturb\.com|panda\.video|play\.panda|smartplayer|youtube\.com\/embed|youtu\.be\/embed|player\.vimeo|fast\.wistia|iframe\.mediadelivery|bunny\.net.*\/embed|video\.mymyelin|vidalytics/i;

    while (Date.now() - started < maxMs) {
      const metrics = await page
        .evaluate((reStr: string) => {
          const re = new RegExp(reStr, 'i');
          const srcs = Array.from(
            document.querySelectorAll<HTMLIFrameElement>('iframe[src]'),
          ).map((f) => f.src || '');
          const hasVideoIframe = srcs.some((s) => re.test(s));
          const raw = document.body?.innerText ?? '';
          const textLen = raw.replace(/\s+/g, ' ').trim().length;
          const iframeCount = document.querySelectorAll('iframe[src]').length;
          return { hasVideoIframe, textLen, iframeCount };
        }, VIDEO_IFRAME_SRC.source)
        .catch(() => ({
          hasVideoIframe: false,
          textLen: 0,
          iframeCount: 0,
        }));

      const sig = `${metrics.textLen}|${metrics.hasVideoIframe}|${metrics.iframeCount}`;
      if (sig === lastSig) {
        stable += 1;
      } else {
        stable = 0;
        lastSig = sig;
      }

      const richEnough =
        metrics.hasVideoIframe ||
        metrics.textLen >= 480 ||
        (metrics.textLen >= 200 && metrics.iframeCount >= 2);

      if (richEnough && stable >= 2) {
        return;
      }
      if (metrics.textLen >= 900 && stable >= 1) {
        return;
      }

      await page.waitForTimeout(380);
    }
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
    const baseTimeoutMs = options.timeoutMs ?? 6000;
    const minInteractives = options.minInteractives ?? 1;
    // Hard ceiling so a stuck loader can't hang the walker forever.
    const maxTimeoutMs = 20_000;
    let deadline = Date.now() + baseTimeoutMs;
    let lastSnapshot: QuizStateSnapshot | null = null;
    let lastChildCount = -1;
    let stableRounds = 0;
    let deadlineExtendedForLoader = false;
    while (Date.now() < deadline) {
      const snapshot = (await page
        .evaluate((script: string) => {
          try {
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
      // Checkout / paywall final screens often still show progress chrome or
      // short body copy — the generic readiness gate never settles and the
      // walker skips the terminal state entirely. Accept immediately when the
      // probe already proved a payment URL on a CTA.
      const terminalCheckout =
        snapshot.stepType === 'checkout_end' ||
        (Array.isArray(snapshot.actions) &&
          snapshot.actions.some((a) => !!a.isCheckoutByHref));
      if (terminalCheckout) {
        await page
          .evaluate(
            () => {
              document
                .querySelector('.main-content')
                ?.scrollIntoView({ block: 'start', behavior: 'instant' });
              window.scrollTo(0, 0);
            },
            undefined,
          )
          .catch(() => undefined);
        await this.flushCheckoutDeferredDom(page);
        await page.waitForTimeout(220);
        const refreshed = (await page
          .evaluate((script: string) => {
            try {
              return eval(script);
            } catch {
              return null;
            }
          }, QUIZ_STATE_BROWSER_JS)
          .catch(() => null)) as QuizStateSnapshot | null;
        return refreshed ?? snapshot;
      }
      const { readiness } = snapshot;
      const interactivesOk = readiness.interactiveCount >= minInteractives;
      const hasTextOrQuestion =
        readiness.textLen >= 30 || readiness.hasQuestion;
      const loaderAbsent = !readiness.hasLoader;
      // If a fake-loader is showing, extend the deadline up to maxTimeoutMs.
      // Fake-loader screens on pattern platforms (weight-loss quizzes,
      // fitness funnels, finance calculators) deliberately hold for 4-15s
      // to feel "serious", and the walker was capturing that transient
      // screen as if it were the real step.
      if (!loaderAbsent && !deadlineExtendedForLoader) {
        const hardLimit = Date.now() + maxTimeoutMs;
        deadline = Math.max(deadline, hardLimit);
        deadlineExtendedForLoader = true;
      }
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

  /**
   * Replace any PII (emails, phone numbers, CPFs) the LLM gate-resolver
   * may have typed into form fields with stable placeholders before we
   * persist the snapshot. We only ever clone our own/test data through
   * these gates, but we never want a tester's email/phone landing in
   * the database tied to a public Page row.
   *
   * Operates only on `value="…"` attributes (`<input>`, `<option>`,
   * `<textarea>` content) — the surface where the walker actually
   * leaves PII. Matches are deliberately conservative.
   */
  private sanitizePiiInHtml(html: string): string {
    if (!html) {
      return html;
    }
    const replaceValueAttrs = (input: string): string =>
      input.replace(
        /(\s(?:value|placeholder)\s*=\s*")([^"]*)(")/gi,
        (_m, p1: string, p2: string, p3: string) => {
          const replaced = this.detectAndMaskPii(p2);
          return `${p1}${replaced}${p3}`;
        },
      );
    let result = replaceValueAttrs(html);
    // Inputs of type=email/tel/cpf with literal e-mails/phones inside
    // <option selected>...</option> lists.
    result = result.replace(
      /(<option[^>]*\bselected[^>]*>)([^<]+)(<\/option>)/gi,
      (_m, open: string, inner: string, close: string) => {
        const replaced = this.detectAndMaskPii(inner.trim());
        return `${open}${replaced}${close}`;
      },
    );
    return result;
  }

  private sanitizePiiInPublicPages(
    pages: CapturedPublicPage[],
  ): CapturedPublicPage[] {
    return pages.map((entry) => ({
      ...entry,
      html: this.sanitizePiiInHtml(entry.html),
    }));
  }

  /**
   * Returns either a stable placeholder when `value` looks like PII or
   * the original string otherwise. Patterns are intentionally permissive
   * on the masking side and conservative on the matching side: we'd
   * rather miss an obscure format than silently corrupt a non-PII value
   * (e.g., a coupon code that happens to contain digits).
   */
  private detectAndMaskPii(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return value;
    // E-mail.
    if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(trimmed)) {
      return '__criaai_email__';
    }
    // CPF (Brazilian taxpayer ID): 11 digits, optionally formatted.
    if (/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/.test(trimmed)) {
      return '__criaai_cpf__';
    }
    // Phone number: 8–15 digits, optional country code, parens, dashes,
    // spaces. Reject pure-digit strings <8 chars to avoid masking
    // numeric coupon codes / counters.
    const phoneNormalized = trimmed.replace(/[\s().+-]/g, '');
    if (/^\d{8,15}$/.test(phoneNormalized) && /[\s().+-]/.test(trimmed)) {
      return '__criaai_phone__';
    }
    if (/^\+\d{8,15}$/.test(phoneNormalized.replace(/^\+?/, '+'))) {
      return '__criaai_phone__';
    }
    return value;
  }

  /**
   * Drag/ruler quiz widgets rarely survive our iframe + export pipeline.
   * Optionally rewrite them to a plain text input using Ollama, with a tiny
   * Cheerio fallback when the model is offline or returns junk.
   */
  private async maybeSimplifyInteractiveWidgetHtml(
    html: string,
    cloneOptions?: CloneRunOptions,
  ): Promise<string> {
    if (cloneOptions?.simplifyInteractiveWidgets === false) return html;
    if (!detectLikelyCustomDragWidget(html)) return html;

    const preferLlm = cloneOptions?.useLlmAssist !== false;
    if (preferLlm) {
      try {
        const rewritten =
          await this.llmAssistService.simplifyInteractiveWidgetsToPlainInputs(
            html,
          );
        if (rewritten && rewritten.length > 500) {
          return rewritten;
        }
      } catch (err) {
        this.logger.debug(
          `[clone] simplifyInteractiveWidgets LLM skipped: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      }
    }

    const det = replaceDragRulerWithPlainInput(html);
    return det ?? html;
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
    this.stripTrackingScripts($);
    this.unlockInteractiveControls($);
    this.unhideVideoGatedCheckoutCtas($);
    this.unhideCheckoutGatedBlocks($);
    this.stripBlockingFullscreenOverlays($);
    injectStableIdsOnCheerio($);

    return $.html();
  }

  /**
   * Strips `disabled` / `aria-disabled` / `pointer-events:none` from the
   * interactive controls of the cloned snapshot.
   *
   * Why this exists: cloned quizzes are static HTML snapshots — the
   * original SPA's JavaScript that watches form state and toggles the
   * "Continuar" button between enabled/disabled is gone. Without this
   * pass the cloned page often ships a `Continuar` that is permanently
   * disabled (because the snapshot was captured the millisecond before
   * the user's selection unlocked it) AND radio/checkbox inputs that
   * were programmatically locked while the SPA validated the previous
   * answer. The user expects to tick the boxes and click Continue —
   * those affordances must always be live in the clone.
   *
   * We are intentionally aggressive here: false positives are harmless
   * (a "disabled" button rendered as enabled in a frozen snapshot will
   * just navigate via the rewritten edge) while false negatives are the
   * exact bug the user reported.
   */
  private unlockInteractiveControls($: ReturnType<typeof load>): void {
    const selector =
      'button, [role="button"], a, input[type="checkbox"], input[type="radio"], input[type="submit"], input[type="button"], label, [role="radio"], [role="checkbox"], [role="option"], [role="switch"]';
    let unlocked = 0;
    $(selector).each((_, raw) => {
      const el = $(raw);
      if (el.attr('disabled') !== undefined) {
        el.removeAttr('disabled');
        unlocked += 1;
      }
      if (el.attr('aria-disabled') !== undefined) {
        el.attr('aria-disabled', 'false');
      }
      const inlineStyle = el.attr('style') ?? '';
      if (inlineStyle && /pointer-events\s*:\s*none/i.test(inlineStyle)) {
        el.attr(
          'style',
          inlineStyle.replace(/pointer-events\s*:\s*none\s*;?/gi, ''),
        );
      }
    });
    if (unlocked > 0) {
      this.logger.debug(
        `[clone] unlocked ${unlocked} disabled control(s) so the cloned quiz is interactive`,
      );
    }
  }

  /**
   * Strips common “gate until video milestone” hiding on a single node.
   * Used only after we already know the page embeds a VSL player.
   */
  private stripVslHiddenGateOnElement(
    $: ReturnType<typeof load>,
    raw: unknown,
  ): number {
    const node = $(raw as never);
    if (!node.length) return 0;
    let revealed = 0;
    if (node.attr('hidden') !== undefined) {
      node.removeAttr('hidden');
      revealed += 1;
    }
    const cls = node.attr('class') ?? '';
    if (/\bhidden\b/.test(cls)) {
      node.attr(
        'class',
        cls
          .split(/\s+/)
          .filter((c) => c && c !== 'hidden')
          .join(' '),
      );
      revealed += 1;
    }
    // Tailwind: whole blocks toggled with `invisible` until the timer fires.
    if (/\binvisible\b/.test(cls)) {
      node.attr(
        'class',
        (node.attr('class') ?? '')
          .split(/\s+/)
          .filter((c) => c && c !== 'invisible')
          .join(' '),
      );
      revealed += 1;
    }
    // Tailwind opacity gates — vturb/InLead often fade whole columns in later.
    if (/\bopacity-/.test(cls)) {
      const nextCls = cls
        .split(/\s+/)
        .map((c) => {
          if (
            /^opacity-(?:0|5|10|25|50|75)$/.test(c) ||
            /^opacity-\[[^\]]+\]$/.test(c)
          ) {
            return 'opacity-100';
          }
          return c;
        })
        .filter(Boolean)
        .join(' ');
      if (nextCls !== cls) {
        node.attr('class', nextCls);
        revealed += 1;
      }
    }
    const style = node.attr('style') ?? '';
    if (
      /display\s*:\s*none/i.test(style) ||
      /visibility\s*:\s*hidden/i.test(style) ||
      /opacity\s*:\s*0(?:\.0*)?(?:\s|;|$)/i.test(style)
    ) {
      const nextStyle = style
        .replace(/display\s*:\s*none\s*;?/gi, '')
        .replace(/visibility\s*:\s*hidden\s*;?/gi, '')
        .replace(/opacity\s*:\s*0(?:\.0*)?\s*;?/gi, '')
        .trim();
      if (nextStyle) {
        node.attr('style', nextStyle);
      } else {
        node.removeAttr('style');
      }
      revealed += 1;
    }
    return revealed;
  }

  /**
   * Walks a DOM subtree (depth-first) and removes VSL-style hiding shells.
   */
  private stripVslHiddenGateOnSubtree(
    $: ReturnType<typeof load>,
    raw: unknown,
    maxDepth: number,
    depth = 0,
  ): number {
    if (!raw || depth > maxDepth) return 0;
    let revealed = this.stripVslHiddenGateOnElement($, raw);
    $(raw as never)
      .children()
      .each((_, child) => {
        revealed += this.stripVslHiddenGateOnSubtree($, child, maxDepth, depth + 1);
      });
    return revealed;
  }

  /**
   * VSL funnels (InLead + ConverteAI/vturb, etc.) hide **entire blocks** until
   * video progress — not only checkout buttons (copy, bullets, guarantees,
   * secondary CTAs). Static clones never run that timer, so we reveal subtrees
   * around detected player/embed roots (siblings after the player stack, plus
   * shallow descendants). Checkout-only unhide runs separately in
   * `unhideCheckoutGatedBlocks` so it still applies when there is no vturb embed.
   */
  private unhideVideoGatedCheckoutCtas($: ReturnType<typeof load>): void {
    const htmlText = $.html() ?? '';
    const hasVslRuntime =
      /(scripts\.converteai\.net|vturb-|vturb_callaction|smartplayer|player[s]?\/[a-z0-9]{16,}\/v4\/embed\.html)/i.test(
        htmlText,
      );
    if (!hasVslRuntime) {
      return;
    }

    let revealed = 0;

    // --- Pass 1: broad — anything structurally “after” or “around” the player.
    const vslRootSelector = [
      'iframe[src*="converteai" i]',
      'iframe[src*="vturb" i]',
      'iframe[src*="smartplayer" i]',
      'iframe[src*="pandavideo" i]',
      'iframe[src*="mymyelin" i]',
      '[data-vturb-player-id]',
      '[data-criaai-vsl]',
      '[class*="vturb" i]',
      '[id*="vturb" i]',
      '.vturb_callaction',
      '.sp-vsl-frame',
    ].join(', ');

    $(vslRootSelector).each((_, raw) => {
      const el = $(raw);
      if (!el.length) return;
      revealed += this.stripVslHiddenGateOnSubtree($, el.get(0) ?? raw, 14);
      // Walk up a few wrappers (nested gates).
      let walk: unknown = el.get(0) ?? raw;
      for (let up = 0; up < 6 && walk; up += 1) {
        revealed += this.stripVslHiddenGateOnElement($, walk);
        walk = (walk as { parent?: unknown } | null)?.parent;
      }
      // Blocks placed as siblings *after* the player column (very common layout).
      const host = el.parent().length ? el.parent() : el;
      host.nextAll().slice(0, 24).each((__, sib) => {
        revealed += this.stripVslHiddenGateOnSubtree($, sib, 16);
      });
    });

    if (revealed > 0) {
      this.logger.debug(
        `[clone] revealed ${revealed} VSL-gated element(s) (content + checkout wrappers)`,
      );
    }
  }

  /**
   * InLead / SPA funnels hide bullets, guarantees and whole columns until a
   * video milestone fires. That pass used to live only inside the VSL branch,
   * so pages **without** a vturb iframe never had checkout-adjacent blocks
   * unhidden. This runs **always** in `prepareCloneHtml` for any URL that
   * `detectCheckoutProvider` recognises (incl. global `external-pay` heuristics).
   */
  private unhideCheckoutGatedBlocks($: ReturnType<typeof load>): void {
    let revealed = 0;
    const checkoutHint =
      'button[data-href], a[href], [data-href], [data-url], [data-link]';
    $(checkoutHint).each((_, raw) => {
      const node = $(raw);
      const url = (
        node.attr('href') ??
        node.attr('data-href') ??
        node.attr('data-url') ??
        node.attr('data-link') ??
        ''
      ).trim();
      if (!url || !detectCheckoutProvider(url)) return;
      revealed += this.stripVslHiddenGateOnSubtree($, raw, 14);
      node.prevAll().slice(0, 10).each((__, sib) => {
        revealed += this.stripVslHiddenGateOnSubtree($, sib, 12);
      });
      node.nextAll().slice(0, 10).each((__, sib) => {
        revealed += this.stripVslHiddenGateOnSubtree($, sib, 12);
      });
      let walk: unknown = raw;
      for (let depth = 0; depth < 10 && walk; depth += 1) {
        revealed += this.stripVslHiddenGateOnElement($, walk);
        walk = (walk as { parent?: unknown } | null)?.parent;
      }
    });
    if (revealed > 0) {
      this.logger.debug(
        `[clone] revealed ${revealed} checkout-gated block(s) (static unhide)`,
      );
    }
  }

  /**
   * Some transient InLead frames render a full-screen fixed overlay before the
   * real content mounts. Static clones keep that blocker forever, producing a
   * white/empty step in the editor/export. We strip only obvious blocker shells.
   */
  private stripBlockingFullscreenOverlays($: ReturnType<typeof load>): void {
    let removed = 0;
    const candidates = [
      'div.fixed.z-\\[1000\\].w-full.h-full.top-0.left-0',
      'div[class*="overlay" i][class*="fixed" i]',
      'div[style*="position:fixed"][style*="top:0"][style*="left:0"][style*="width:100%"][style*="height:100%"]',
    ].join(', ');
    $(candidates).each((_, raw) => {
      const el = $(raw);
      const textLen = (el.text() ?? '').replace(/\s+/g, '').length;
      const hasInteractiveChildren =
        el.find('button, a[href], input, select, textarea, [role="button"]')
          .length > 0;
      if (!hasInteractiveChildren && textLen < 24) {
        el.remove();
        removed += 1;
      }
    });
    if (removed > 0) {
      this.logger.debug(
        `[clone] removed ${removed} fullscreen blocking overlay(s)`,
      );
    }
  }

  private isSkippableBlankStepHtml(html: string): boolean {
    if (!html || html.trim().length < 40) return true;
    const $ = load(html);
    if (!$('body').length) return true;
    const textLen = (($('body').text() ?? '').replace(/\s+/g, ' ').trim()).length;
    const interactiveCount = $(
      'button, [role="button"], a[href], input[type="button"], input[type="submit"], input[type="radio"], input[type="checkbox"]',
    ).length;
    const hasFullscreenOverlay =
      $('div.fixed.z-\\[1000\\].w-full.h-full.top-0.left-0').length > 0 ||
      $(
        'div[style*="position:fixed"][style*="top:0"][style*="left:0"][style*="width:100%"][style*="height:100%"]',
      ).length > 0;
    if (hasFullscreenOverlay && textLen < 140 && interactiveCount <= 3) {
      return true;
    }
    return textLen < 60 && interactiveCount <= 1;
  }

  /**
   * Removes third-party tracking/analytics scripts from a cloned document.
   *
   * Two passes:
   *   1. `<script src="…">` whose hostname matches the curated tracker
   *      blocklist (`tracking-blocklist.ts`).
   *   2. Inline `<script>` whose body matches a known tracking pattern
   *      (gtag(, fbq(, dataLayer.push, _paq.push, etc.).
   *
   * Also drops common pixel images (`facebook.com/tr`, …) and `<noscript>`
   * fallbacks that are pure pixel tags. The cloned page keeps every other
   * script intact — only telemetry is stripped, never functional code.
   */
  private stripTrackingScripts($: ReturnType<typeof load>): void {
    let removedSrc = 0;
    let removedInline = 0;
    let removedPixel = 0;
    $('script[src]').each((_, node) => {
      const el = $(node);
      const src = el.attr('src') ?? '';
      if (!src) return;
      if (isTrackingUrl(src)) {
        el.remove();
        removedSrc += 1;
      }
    });
    $('script:not([src])').each((_, node) => {
      const el = $(node);
      const body = el.html() ?? '';
      if (!body) return;
      if (isTrackingInlineSnippet(body)) {
        el.remove();
        removedInline += 1;
      }
    });
    $('img[src],iframe[src]').each((_, node) => {
      const el = $(node);
      const src = el.attr('src') ?? '';
      if (!src) return;
      if (isTrackingUrl(src)) {
        el.remove();
        removedPixel += 1;
      }
    });
    $('noscript').each((_, node) => {
      const el = $(node);
      const inner = el.html() ?? '';
      if (!inner) return;
      // Tracker noscript blocks are usually a single <img> pointing to a
      // pixel endpoint. Strip those, keep anything else (some sites use
      // noscript for legitimate fallback content).
      if (
        /<img[^>]+(facebook\.com\/tr|google-analytics|googletagmanager|connect\.facebook\.net|analytics\.tiktok|hotjar|clarity\.ms|doubleclick\.net)/i.test(
          inner,
        )
      ) {
        el.remove();
        removedPixel += 1;
      }
    });
    if (removedSrc + removedInline + removedPixel > 0) {
      this.logger.debug(
        `[clone] tracking strip: src=${removedSrc} inline=${removedInline} pixel=${removedPixel}`,
      );
    }
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

  /**
   * Build a `<base href>` from the page's final URL.
   *
   * The browser <base> element changes how relative URLs in the document
   * are resolved. The right reference is **the URL of the document itself
   * including its directory**, not the directory parent — otherwise SPA
   * routes like `https://app.com/q/abc123` would have asset paths
   * resolved one directory too high (`/q/asset.png` instead of
   * `/q/abc123/asset.png`).
   *
   * Rules:
   *   - Drop `?query` and `#hash` so the base is canonical.
   *   - If the last path segment looks like a file (has a `.ext`), strip
   *     it and use the parent directory (typical "/page.html" cases).
   *   - Otherwise the path is treated as a directory: ensure trailing `/`
   *     so `<a href="next">` resolves under it.
   *
   * This unblocks cloning of quizzes/SPAs whose source URL is a deep route
   * with no trailing slash (Cakto, Hotmart, custom Next.js routers, etc.).
   */
  private buildBaseHref(sourceUrl: string): string {
    const parsed = new URL(sourceUrl);
    parsed.hash = '';
    parsed.search = '';
    const lastSegment = parsed.pathname.split('/').pop() ?? '';
    const looksLikeFile = /\.[A-Za-z0-9]{1,8}$/.test(lastSegment);
    if (looksLikeFile) {
      const lastSlashIndex = parsed.pathname.lastIndexOf('/');
      parsed.pathname =
        lastSlashIndex >= 0
          ? parsed.pathname.slice(0, lastSlashIndex + 1)
          : '/';
    } else if (!parsed.pathname.endsWith('/')) {
      parsed.pathname += '/';
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

  /**
   * Quiz navigation edges suppress customization anchors so mid-funnel
   * buttons ("Continuar", opções de quiz) não aparecem como “checkout”.
   * CTAs que levam para URL externa (`pay.*`, `hotmart`, …) também são
   * registrados como edges — precisamos **não** suprimí‑los, senão o painel
   * Personalizar fica vazio mesmo com `data-href`/`href` visíveis no HTML.
   */
  private edgeTargetsExternalHttpUrl(
    $: CheerioAPI,
    edge: NavigationEdge,
  ): boolean {
    const isExternalHttp = (raw: string): boolean =>
      /^https?:\/\//i.test((raw ?? '').trim());

    let target = edge.actionId
      ? $(`[${CRIAAI_ID_ATTR}="${edge.actionId}"]`).first()
      : $('');
    if (!target.length && edge.selector) {
      try {
        target = $(edge.selector).first();
      } catch {
        target = $('');
      }
    }
    if (!target.length) return false;

    const urlsFromNode = (node: {
      attr(name: string): string | undefined;
    }): string[] => {
      const href = (node.attr('href') ?? '').trim();
      const dh = (
        node.attr('data-href') ??
        node.attr('data-url') ??
        ''
      ).trim();
      const out: string[] = [];
      if (href) out.push(href);
      if (dh) out.push(dh);
      return out;
    };

    for (const u of urlsFromNode(target)) {
      if (isExternalHttp(u)) return true;
    }

    const parentA = target.closest('a[href]');
    if (parentA.length) {
      for (const u of urlsFromNode(parentA)) {
        if (isExternalHttp(u)) return true;
      }
    }

    // InLead-style: `<button id="x">` + `<a id="x-button" href="https://pay…">`
    const tid = (target.attr('id') ?? '').trim();
    if (tid) {
      const helper = $(`a[id="${tid}-button"]`).first();
      if (helper.length) {
        for (const u of urlsFromNode(helper)) {
          if (isExternalHttp(u)) return true;
        }
      }
    }

    return false;
  }

  /**
   * Hard-stop guard for quiz walkers: if the current HTML already exposes a
   * checkout URL (href/data-href/form action), the funnel ended.
   */
  private htmlHasCheckoutLink(html: string): boolean {
    if (!html) return false;
    const $ = load(html);
    const candidates = new Set<string>();
    $('[href], [data-href], [data-url], [data-link], form[action]').each(
      (_, raw) => {
        const el = $(raw);
        const href = (el.attr('href') ?? '').trim();
        const dataHref = (el.attr('data-href') ?? '').trim();
        const dataUrl = (el.attr('data-url') ?? '').trim();
        const dataLink = (el.attr('data-link') ?? '').trim();
        const action = (el.attr('action') ?? '').trim();
        if (href) candidates.add(href);
        if (dataHref) candidates.add(dataHref);
        if (dataUrl) candidates.add(dataUrl);
        if (dataLink) candidates.add(dataLink);
        if (action) candidates.add(action);
      },
    );
    for (const url of candidates) {
      if (detectCheckoutProvider(url)) return true;
    }
    return false;
  }

  /**
   * True when the saved HTML already carries a walker-stamped checkout marker
   * whose value is a real provider slug (not the generic placeholder tokens).
   */
  private htmlHasStampedCheckout(html: string): boolean {
    if (!html) return false;
    const $ = load(html);
    const skip = new Set([
      '',
      'text-cta',
      'strong-text-cta',
      'llm-cta',
      'attr-cta',
    ]);
    let found = false;
    $('[data-criaai-checkout]').each((_, raw) => {
      const v = ($(raw).attr('data-criaai-checkout') ?? '').trim().toLowerCase();
      if (v && !skip.has(v)) found = true;
    });
    return found;
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
      const $page = load(page.html);
      const suppressEdge = (edge: NavigationEdge): boolean =>
        !this.edgeTargetsExternalHttpUrl($page, edge);
      const ignoreIds = edgesForStep
        .filter(suppressEdge)
        .map((edge) => edge.actionId)
        .filter((id): id is string => Boolean(id));
      const ignoreSelectors = edgesForStep
        .filter(suppressEdge)
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
    userId?: string | null,
  ): Promise<{ saved: number; updatedAt: string }> {
    const page = await this.prismaService.page.findUnique({
      where: { id: pageId },
    });
    if (!page) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    this.assertPageOwnership(page.userId ?? null, userId);
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
    const nextPublicPages = [...currentPublicPages];
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
    const previousAnchors = Array.isArray(meta.customizationAnchors)
      ? (meta.customizationAnchors as CustomizationAnchor[])
      : [];
    let mergedValues: CustomizationValues = syncCustomizationGroupKeys(
      previousAnchors,
      {
        ...currentValues,
        ...(payload.customizationValues ?? {}),
      },
    );
    const existingNavigationMap = Array.isArray(meta.navigationMap)
      ? (meta.navigationMap as NavigationEdge[])
      : [];
    const nextAnchors = this.buildCustomizationAnchors(
      nextPublicPages,
      existingNavigationMap,
    );
    mergedValues = syncCustomizationGroupKeys(nextAnchors, mergedValues);

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

    // Track which stepIds the user has touched. Subsequent streaming
    // appends from a still-running clone job will park new captures for
    // these steps in `meta.pendingUpdates` instead of overwriting them.
    const editedStepIds = new Set<string>();
    if (payload.steps?.length) {
      for (const step of payload.steps) editedStepIds.add(step.stepId);
    }
    if (payload.mainHtml) editedStepIds.add('main');
    if (editedStepIds.size > 0) {
      await this.markStepsEditedByUser(pageId, [...editedStepIds]).catch(
        (err) => {
          this.logger.warn(
            `[updatePageContent] failed to mark edited steps: ${
              err instanceof Error ? err.message : 'unknown'
            }`,
          );
        },
      );
    }
    return { saved, updatedAt: updated.updatedAt.toISOString() };
  }

  /**
   * Resolves a clone-vs-edit conflict on a specific step by either
   * accepting the incoming captured version (replacing the user's edit)
   * or rejecting it (keeping the user's edit and dropping the pending
   * snapshot). Backed by the same advisory lock as the appender so the
   * resolution can race safely with an in-flight crawler emit.
   */
  async resolveCloneConflict(
    pageId: string,
    stepId: string,
    decision: 'accept' | 'reject',
    userId?: string | null,
  ): Promise<{ resolved: boolean; appliedHtmlSize: number | null }> {
    const page = await this.prismaService.page.findUnique({
      where: { id: pageId },
    });
    if (!page) throw new NotFoundException(`Page ${pageId} not found`);
    this.assertPageOwnership(page.userId ?? null, userId);
    if (!page.latestVersionId) {
      throw new BadRequestException('Page has no version to update');
    }
    return this.prismaService.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext($1)::bigint)`,
          pageId,
        );
        const version = await tx.pageVersion.findUnique({
          where: { id: page.latestVersionId! },
        });
        if (!version) {
          return { resolved: false, appliedHtmlSize: null };
        }
        const meta =
          version.meta && typeof version.meta === 'object'
            ? ({ ...(version.meta as Record<string, unknown>) } as Record<
                string,
                unknown
              >)
            : {};
        const pending =
          meta.pendingUpdates && typeof meta.pendingUpdates === 'object'
            ? ({
                ...(meta.pendingUpdates as Record<string, CapturedPublicPage>),
              } as Record<string, CapturedPublicPage>)
            : {};
        const incoming = pending[stepId];
        if (!incoming) return { resolved: false, appliedHtmlSize: null };
        delete pending[stepId];
        meta.pendingUpdates = pending;

        const userEdited = new Set(
          Array.isArray(meta.userEditedSteps)
            ? (meta.userEditedSteps as string[])
            : [],
        );
        if (decision === 'reject') {
          // Keep the user's edit untouched. Just clear the pending entry.
          userEdited.add(stepId);
          meta.userEditedSteps = [...userEdited];
          await tx.pageVersion.update({
            where: { id: version.id },
            data: { meta: meta as Prisma.InputJsonValue },
          });
          return { resolved: true, appliedHtmlSize: null };
        }
        const currentPages = Array.isArray(meta.publicPages)
          ? ([
              ...(meta.publicPages as CapturedPublicPage[]),
            ] as CapturedPublicPage[])
          : [];
        const idx = currentPages.findIndex(
          (p) => (p.stepId ?? p.url) === stepId,
        );
        if (idx === -1) {
          currentPages.push(incoming);
        } else {
          currentPages[idx] = { ...currentPages[idx], ...incoming };
        }
        meta.publicPages = currentPages;
        // User explicitly accepted the new version — clear the "edited"
        // flag so future captures of the same step can flow through.
        userEdited.delete(stepId);
        meta.userEditedSteps = [...userEdited];
        await tx.pageVersion.update({
          where: { id: version.id },
          data: { meta: meta as Prisma.InputJsonValue },
        });
        return { resolved: true, appliedHtmlSize: incoming.html.length };
      },
      { maxWait: 15_000, timeout: 60_000 },
    );
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

  async exportZip(pageId: string, userId?: string | null): Promise<Buffer> {
    const page = await this.prismaService.page.findUnique({
      where: { id: pageId },
    });
    if (!page?.latestVersionId) {
      throw new NotFoundException(`Page ${pageId} not found`);
    }
    this.assertPageOwnership(page.userId ?? null, userId);
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
      syncCustomizationGroupKeys(customizationAnchors, rawCustomizationValues),
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
    const exportedSteps: CapturedPublicPage[] = [];
    for (const step of steps) {
      if (
        (step.stepId ?? '').startsWith('q') &&
        this.isSkippableBlankStepHtml(step.html)
      ) {
        continue;
      }
      exportedSteps.push(step);
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
      // Final pass: turn the step into a static, self-contained HTML
      // suitable for `file://` browsing. Drops the origin `<base
      // href>`, meta-refreshes, canonical hints and every <script>
      // — see export-html.util.ts for the rationale.
      const exported = prepareExportHtml(rewritten);
      zip.file(filename, exported);
    }
    zip.file(
      'README.txt',
      [
        `Landing page exportada por CriaAI`,
        `Página: ${version.title}`,
        `Gerado em: ${new Date().toISOString()}`,
        ``,
        `Arquivos:`,
        ...exportedSteps.map(
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
