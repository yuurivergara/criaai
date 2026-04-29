import type { CustomizationAnchor } from './customization.util';

export type PageSourceType = 'generate' | 'clone';
export type PageStatus = 'draft' | 'published';

/**
 * Runtime options for a single clone job. Built from `ClonePageDto` in
 * `processCloneJob` and threaded all the way down into the quiz walker so
 * the user can actually control the limits exposed by the API.
 *
 * All fields are required at the runtime layer — `processCloneJob` is
 * responsible for filling defaults from the DTO. The DTO itself keeps
 * everything optional (see `dto/clone-page.dto.ts`).
 */
export interface CloneRunOptions {
  /** Hard upper bound on steps captured per linear walk. */
  quizMaxSteps: number;
  /** Hard upper bound on alternative branches explored. */
  quizMaxForks: number;
  /** Hard upper bound on total distinct states across all walks. */
  quizMaxStates: number;
  /** Wall-clock budget for the whole walker phase (ms). */
  quizMaxTimeMs: number;
  /** Wall-clock budget for a single step transition (ms). */
  quizMaxTimePerStepMs: number;
  /**
   * When false, every Ollama-backed call is bypassed and the heuristic
   * fallback is used directly. The clone is still produced — only some
   * edge cases (form gates with strict validators, language-agnostic
   * checkout detection on novel layouts) degrade to deterministic
   * heuristics.
   */
  useLlmAssist: boolean;
  /**
   * When true (default), quiz steps that match drag/ruler/slider heuristics are
   * rewritten to a plain text input via LLM (with deterministic fallback) so the
   * editor/ZIP behave predictably without brittle SPA gestures.
   */
  simplifyInteractiveWidgets: boolean;
}

export interface PageVersion {
  id: string;
  pageId: string;
  title: string;
  html: string;
  createdAt: string;
  meta: Record<string, unknown>;
}

export interface PageRecord {
  id: string;
  sourceType: PageSourceType;
  status: PageStatus;
  sourceUrl?: string;
  publicUrl?: string;
  createdAt: string;
  updatedAt: string;
  latestVersionId?: string;
}

/**
 * Streaming hooks threaded down through the clone pipeline so each
 * stage (snapshot, crawler, walker) can incrementally publish progress
 * to the editor BEFORE the whole job finishes. The hooks are a thin
 * shim — they are populated by `processCloneJob` and call into
 * `JobsGateway.emitClone…` + `PagesService.appendPublicPagesAtomic`.
 *
 * Every callback is async and best-effort: a slow or failing emit
 * MUST NOT block the pipeline. The wrappers in `pages.service.ts`
 * wrap calls in `.catch()` so a flaky WS client cannot stall a clone.
 */
export interface CloneStreamingHooks {
  /**
   * Fired once, as soon as the entry-page snapshot wins the
   * MHTML/SingleFile/DOM competition. Hands the pipeline a stable
   * `pageId` it can pass to subsequent hooks.
   */
  onEntryReady?: (entry: CloneEntryReadyEvent) => Promise<string>;
  /** Fired every time a public/internal page is consolidated. */
  onPageCaptured?: (event: ClonePageCapturedEvent) => Promise<void>;
  /** Fired every time a navigation edge is appended to the navmap. */
  onEdgeAdded?: (event: CloneEdgeAddedEvent) => Promise<void>;
  /** Coarse-grained progress signal for the topbar/banner. */
  onStage?: (event: CloneStageEvent) => Promise<void>;
}

export interface CloneEntryReadyEvent {
  jobId: string;
  sourceUrl: string;
  title: string;
  /** The first captured page (already PII-sanitized). */
  entryPage: {
    url: string;
    title: string;
    html: string;
    renderMode?: 'runtime' | 'frozen';
    stepId?: string;
    thumbnail?: string;
  };
}

export interface ClonePageCapturedEvent {
  jobId: string;
  pageId: string;
  page: {
    url: string;
    title: string;
    html: string;
    renderMode?: 'runtime' | 'frozen';
    stepId?: string;
    sourceStepId?: string;
    triggerText?: string;
    triggerSelector?: string;
    thumbnail?: string;
  };
  /**
   * Full merged anchor list after persisting this capture (matches
   * `pageVersion.meta.customizationAnchors`). Lets the editor refresh the
   * Personalizar tab during streaming without polling GET /pages/:id.
   */
  customizationAnchors?: CustomizationAnchor[];
}

export interface CloneEdgeAddedEvent {
  jobId: string;
  pageId: string;
  edge: {
    fromStepId: string;
    selector: string;
    toStepId: string;
    triggerText?: string;
    actionId?: string;
  };
}

export interface CloneStageEvent {
  jobId: string;
  pageId?: string;
  stage:
    | 'fetch'
    | 'crawl'
    | 'walk'
    | 'persist'
    | 'interactive'
    | 'completed'
    | 'failed';
  message?: string;
  /** 0–100. Best-effort; UI uses it for the streaming banner only. */
  percent?: number;
}

/**
 * Emitted when the crawler/walker rediscovers a step the user has
 * already manually edited. Backend holds the new version aside (in
 * `meta.pendingUpdates[stepId]`) and the editor decides whether to
 * accept it or keep the manual edit.
 */
export interface CloneConflictEvent {
  jobId: string;
  pageId: string;
  stepId: string;
  /** Title and html size of the freshly captured version. */
  incoming: { title: string; htmlSize: number; thumbnail?: string };
}
