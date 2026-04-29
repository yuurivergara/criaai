import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { Element as CheerioElement } from 'domhandler';
import {
  CRIAAI_ID_ATTR,
  ensureStableId,
  injectStableIdsOnCheerio,
} from './stable-id.util';
import {
  CHECKOUT_DOMAIN_PATTERNS as CHECKOUT_DOMAIN_PATTERNS_SHARED,
  CHECKOUT_TEXT_KEYWORDS as CHECKOUT_TEXT_KEYWORDS_SHARED,
  ADVANCE_ONLY_TEXTS as ADVANCE_ONLY_TEXTS_SHARED,
  CHECKOUT_ATTR_REGEX,
  isLikelyCheckoutText as isLikelyCheckoutTextShared,
  isStrongCheckoutText,
  detectCheckoutProvider as detectCheckoutProviderShared,
  isQuizBuilderHostUrl,
  normalizeCheckoutText,
} from './checkout-vocab.util';

export type CustomizationKind = 'checkout' | 'video';

/**
 * How the `applyCustomizationValues` step should wire the user-supplied value
 * back onto the element:
 *
 * - `rewrite-href`    : target is an <a> / parent <a>, swap href
 * - `rewrite-action`  : target is a <form>, swap action
 * - `rewrite-src`     : target is <iframe>/<video>, swap src
 * - `inject-click`    : target is a button/div with no URL — inject an
 *                       onclick handler that routes to the user value
 * - `replace-embed`   : custom VSL container: swap for a plain iframe
 */
export type CustomizationBehavior =
  | 'rewrite-href'
  | 'rewrite-action'
  | 'rewrite-src'
  | 'inject-click'
  | 'replace-embed';

export interface CustomizationAnchor {
  id: string;
  stepId: string;
  kind: CustomizationKind;
  /**
   * Preferred selector. Always `[data-criaai-id="..."]` when the pipeline
   * injected stable ids. The editor uses this as the primary lookup.
   */
  selector: string;
  /** Stable id of the element (mirror of the attribute) — may be empty. */
  stableId?: string;
  label: string;
  currentValue?: string;
  tag: string;
  provider?: string;
  /** How to re-apply a user value on this element. */
  behavior: CustomizationBehavior;
  /**
   * Identifier shared across steps for the SAME logical CTA. Because the
   * stable-id algorithm is deterministic, a checkout button rendered on
   * step q03 and step q17 has the same stableId → the same groupId →
   * editing one URL propagates to every occurrence. Falls back to a hash
   * of label+provider+behavior when no stableId is available.
   */
  groupId?: string;
}

export type CustomizationValues = Record<string, string>;

// Checkout vocabulary moved to `./checkout-vocab.util.ts` so the walker
// (browser-side) and the cloner anchor detector both consume the same lists.
// We keep local aliases for readability throughout this file.
const CHECKOUT_DOMAIN_PATTERNS = CHECKOUT_DOMAIN_PATTERNS_SHARED;
const CHECKOUT_TEXT_KEYWORDS = CHECKOUT_TEXT_KEYWORDS_SHARED;
const ADVANCE_ONLY_TEXTS = ADVANCE_ONLY_TEXTS_SHARED;

const VIDEO_IFRAME_PATTERNS: Array<{ regex: RegExp; provider: string }> = [
  { regex: /youtube\.com\/embed|youtu\.be/i, provider: 'youtube' },
  { regex: /player\.vimeo\.com/i, provider: 'vimeo' },
  { regex: /fast\.wistia\.net|wistia\.com/i, provider: 'wistia' },
  {
    regex: /scripts\.converteai\.net|players\.converteai\.net/i,
    provider: 'converteai',
  },
  {
    regex: /vturb\.com|cdn\.vturb\.io|players\.vturb\.com/i,
    provider: 'vturb',
  },
  {
    regex: /panda\.video|play\.panda\.video|pandavideo/i,
    provider: 'pandavideo',
  },
  { regex: /video\.mymyelin|mymyelin/i, provider: 'myelin' },
  { regex: /vidalytics/i, provider: 'vidalytics' },
  {
    regex: /fast\.pages\.bunny\.net|iframe\.mediadelivery\.net/i,
    provider: 'bunny',
  },
  { regex: /vsl|video-sales|videoask|loom\.com/i, provider: 'vsl-generic' },
];

const VIDEO_CONTAINER_ATTRS = [
  'data-vturb-player-id',
  'data-video-id',
  'data-vimeo-id',
  'data-panda-id',
  'data-wistia-id',
  'data-youtube-id',
  // CriaAI-native VSL slot marker emitted by the page generator.
  'data-criaai-vsl',
];

// Local aliases — implementations live in checkout-vocab.util.ts so the
// browser-side walker uses the exact same logic.
const normalizeText = normalizeCheckoutText;
const isLikelyCheckoutText = isLikelyCheckoutTextShared;

/**
 * Returns true when the element (or any of its first two ancestors) has an
 * attribute value that matches `CHECKOUT_ATTR_REGEX`. Mirrors the browser
 * probe's `detectCheckoutByAttr` so the static Cheerio pass agrees with the
 * live walker about what counts as an explicit checkout tag. Property-first:
 * this is the signal that elevates a button from "maybe checkout" to
 * "definitely customization-worthy".
 */
function elementHasCheckoutAttr(
  el: Cheerio<CheerioElement>,
  $: CheerioAPI,
): boolean {
  const ATTR_NAMES = [
    'data-testid',
    'data-test',
    'data-qa',
    'id',
    'name',
    'class',
    'data-event',
    'data-analytics',
    'aria-label',
  ];
  const check = (node: Cheerio<CheerioElement>): boolean => {
    if (!node.length) return false;
    for (const attr of ATTR_NAMES) {
      const value = (node.attr(attr) ?? '').trim();
      if (value && CHECKOUT_ATTR_REGEX.test(value)) return true;
    }
    return false;
  };
  if (check(el)) return true;
  const parent = el.parent();
  if (check(parent)) return true;
  const grand = parent.parent();
  if (check(grand)) return true;
  return false;
}

/**
 * Returns true when the href is most likely just intra-site/quiz navigation.
 */
function isInternalNavigationHref(href: string): boolean {
  if (!href) return true;
  const trimmed = href.trim();
  if (!trimmed) return true;
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:')
  ) {
    return true;
  }
  if (!/^https?:\/\//i.test(trimmed)) {
    return true;
  }
  return false;
}

function isExternalHttpHref(href: string): boolean {
  return /^https?:\/\//i.test((href ?? '').trim());
}

const detectCheckoutProvider = detectCheckoutProviderShared;

function detectVideoProvider(src: string): string | undefined {
  for (const entry of VIDEO_IFRAME_PATTERNS) {
    if (entry.regex.test(src)) return entry.provider;
  }
  return undefined;
}

function shortenLabel(text: string, max = 70): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function resolveStableId(
  $: CheerioAPI,
  el: Cheerio<CheerioElement>,
): { selector: string; stableId: string } {
  const id = ensureStableId($, el, 'i');
  return {
    stableId: id,
    selector: `[${CRIAAI_ID_ATTR}="${id}"]`,
  };
}

export interface DetectCustomizationOptions {
  /** Stable ids (`data-criaai-id`) to skip (usually navigation actions). */
  ignoreIds?: string[];
  /** Legacy: selectors to skip — applied as substring match for resilience. */
  ignoreSelectors?: string[];
}

/**
 * Scans the HTML and emits a list of "customization anchors".
 *
 * Anchors are keyed by `[data-criaai-id="..."]` selectors, which stay valid
 * across captures and editor sessions (the stable id layer ensures the same
 * HTML produces the same id).
 */
export function detectCustomizationAnchors(
  html: string,
  stepId: string,
  options?: DetectCustomizationOptions,
): CustomizationAnchor[] {
  if (!html) return [];
  const $ = load(html);
  // Ensure stable ids exist (idempotent — no-ops if already injected).
  injectStableIdsOnCheerio($);

  const anchors: CustomizationAnchor[] = [];
  const seenStableIds = new Set<string>();
  const ignoreIds = new Set(
    (options?.ignoreIds ?? []).map((s) => s.trim()).filter(Boolean),
  );
  const ignoreSelectors = (options?.ignoreSelectors ?? []).filter(Boolean);
  let counter = 0;

  const pushAnchor = (
    kind: CustomizationKind,
    el: Cheerio<CheerioElement>,
    label: string,
    currentValue: string | undefined,
    provider: string | undefined,
    behavior: CustomizationBehavior,
  ) => {
    const { selector, stableId } = resolveStableId($, el);
    if (ignoreIds.has(stableId)) return;
    if (seenStableIds.has(stableId)) return;
    if (
      ignoreSelectors.some(
        (ignore) => ignore === selector || ignore.includes(stableId),
      )
    ) {
      return;
    }
    seenStableIds.add(stableId);
    counter += 1;
    const tag = ((el.get(0) as CheerioElement).tagName ?? 'div').toLowerCase();
    const groupId = stableId
      ? `${kind}-${stableId}`
      : `${kind}-${shortenLabel(label || tag, 40)}-${behavior}`;
    anchors.push({
      id: `${kind === 'checkout' ? 'ck' : 'vid'}-${stepId}-${counter.toString().padStart(3, '0')}`,
      stepId,
      kind,
      selector,
      stableId,
      label: shortenLabel(label || tag),
      currentValue,
      tag,
      provider,
      behavior,
      groupId,
    });
  };

  // PRIORITY PASS — elements stamped with `data-criaai-checkout` by the
  // walker probe (it ran in the live DOM, so it had access to runtime
  // state the static HTML doesn't always show). The marker carries the
  // detected provider as its value ("hotmart", "stripe", "text-cta", …).
  $('[data-criaai-checkout]').each((_, raw) => {
    const el = $(raw);
    const markerValue = (el.attr('data-criaai-checkout') ?? '').trim();
    const provider =
      markerValue &&
      markerValue !== 'text-cta' &&
      markerValue !== 'strong-text-cta' &&
      markerValue !== 'llm-cta' &&
      markerValue !== 'attr-cta'
        ? markerValue
        : undefined;
    const tagName = (el.get(0)?.tagName ?? '').toLowerCase();
    const text = el.text().trim();
    const href = (el.attr('href') ?? '').trim();
    if (tagName === 'a') {
      pushAnchor(
        'checkout',
        el,
        text || href,
        href || undefined,
        provider,
        'rewrite-href',
      );
    } else if (tagName === 'form') {
      const action = (el.attr('action') ?? '').trim();
      pushAnchor(
        'checkout',
        el,
        text || action,
        action || undefined,
        provider,
        'rewrite-action',
      );
    } else {
      const dataHref = (el.attr('data-href') ?? el.attr('data-url') ?? '').trim();
      let checkoutUrl = dataHref;
      if (!checkoutUrl) {
        const bid = (el.attr('id') ?? '').trim();
        if (/^[a-zA-Z0-9_-]+$/.test(bid)) {
          const helperHref = $(`a[id="${bid}-button"]`).first().attr('href');
          if (helperHref) checkoutUrl = helperHref.trim();
        }
      }
      pushAnchor(
        'checkout',
        el,
        text || tagName || 'cta',
        checkoutUrl || undefined,
        provider,
        'inject-click',
      );
    }
  });

  $('a[href]').each((_, raw) => {
    const el = $(raw);
    const href = (el.attr('href') ?? '').trim();
    const text = el.text().trim();
    const provider = href ? detectCheckoutProvider(href) : undefined;
    const matchesText = isLikelyCheckoutText(text);
    if (provider) {
      pushAnchor('checkout', el, text || href, href, provider, 'rewrite-href');
    } else if (matchesText && !isInternalNavigationHref(href)) {
      pushAnchor('checkout', el, text || href, href, undefined, 'rewrite-href');
    } else if (matchesText && isInternalNavigationHref(href)) {
      // Internal link with buy-like text — still a customizable CTA: user can
      // swap the href for their own checkout URL.
      pushAnchor('checkout', el, text || href, href, undefined, 'rewrite-href');
    } else if (isExternalHttpHref(href) && !isQuizBuilderHostUrl(href)) {
      // Any external URL editable — except quiz-builder hosts (InLead footer, etc.).
      pushAnchor(
        'checkout',
        el,
        text || `Link externo · ${href}`,
        href,
        'external-link',
        'rewrite-href',
      );
    }
  });

  $('form[action]').each((_, raw) => {
    const el = $(raw);
    const action = (el.attr('action') ?? '').trim();
    if (!action) return;
    const provider = detectCheckoutProvider(action);
    const hasSubmit =
      el.find('button[type="submit"], input[type="submit"]').length > 0;
    const text = el.text().trim();
    const matchesText = hasSubmit && isLikelyCheckoutText(text);
    if (provider) {
      pushAnchor(
        'checkout',
        el,
        text || action,
        action,
        provider,
        'rewrite-action',
      );
    } else if (matchesText && !isInternalNavigationHref(action)) {
      pushAnchor(
        'checkout',
        el,
        text || action,
        action,
        undefined,
        'rewrite-action',
      );
    } else if (isExternalHttpHref(action) && !isQuizBuilderHostUrl(action)) {
      pushAnchor(
        'checkout',
        el,
        text || `Form externo · ${action}`,
        action,
        'external-link',
        'rewrite-action',
      );
    }
  });

  $('button, [role="button"], input[type="submit"], input[type="button"]').each(
    (_, raw) => {
      const el = $(raw);
      const text = el.text().trim() || (el.attr('value') ?? '').trim();

      // PROPERTY-FIRST: the static pass only turns a plain button into a
      // checkout anchor when we have HARD evidence on the element itself:
      //   1) the walker already stamped it with `data-criaai-checkout`
      //      (handled by the priority pass above — skip here to avoid
      //      duplicates), OR
      //   2) an attribute (data-testid, id, class, aria-label, …) matches
      //      the checkout attribute regex — framework-agnostic, language-
      //      agnostic, explicit author intent, OR
      //   3) the visible label matches the NARROW strong-text list (e.g.
      //      "OBTENER MI PLAN", "Buy now", "Comprar agora"). Plain
      //      "Continuar" / "Continue" does NOT qualify here, even when the
      //      surrounding heading mentions "plan" / "plano".
      // This keeps results/upsell screens out of the editor's Checkout tab.
      if (el.attr('data-criaai-checkout') != null) return;
      const dataHref = (el.attr('data-href') ?? el.attr('data-url') ?? '').trim();
      const hasDataHrefSignal = Boolean(
        dataHref &&
          (detectCheckoutProvider(dataHref) ||
            (isExternalHttpHref(dataHref) && !isQuizBuilderHostUrl(dataHref))),
      );
      const hasAttrSignal = elementHasCheckoutAttr(el, $);
      const hasStrongText = isStrongCheckoutText(text);
      if (!hasAttrSignal && !hasStrongText && !hasDataHrefSignal) return;

      const onclick = el.attr('onclick') ?? '';
      const parentLink = el.closest('a[href]');

      let currentValue: string | undefined;
      let provider: string | undefined;
      let behavior: CustomizationBehavior = 'inject-click';

      if (parentLink.length) {
        // The <a> itself will be detected in the previous pass with
        // rewrite-href. Skip the nested button so we don't duplicate.
        return;
      }
      if (dataHref) {
        currentValue = dataHref;
        provider =
          detectCheckoutProvider(dataHref) ??
          (isExternalHttpHref(dataHref) && !isQuizBuilderHostUrl(dataHref)
            ? 'external-link'
            : undefined);
        behavior = 'inject-click';
      }
      if (!currentValue && onclick) {
        const match = onclick.match(/https?:[^'"\s)]+/);
        if (match) {
          currentValue = match[0];
          provider = detectCheckoutProvider(currentValue);
        }
      }

      // Even without any URL — if the button carries explicit property or
      // strong-text evidence we still expose it: the user will supply the
      // URL and we inject an onclick at apply-time.
      pushAnchor('checkout', el, text, currentValue, provider, behavior);
    },
  );

  $('iframe[src]').each((_, raw) => {
    const el = $(raw);
    const src = (el.attr('src') ?? '').trim();
    if (!src) return;
    const provider = detectVideoProvider(src);
    if (!provider) return;
    pushAnchor('video', el, src, src, provider, 'rewrite-src');
  });

  $('video').each((_, raw) => {
    const el = $(raw);
    const src = el.attr('src') ?? el.find('source').first().attr('src') ?? '';
    pushAnchor(
      'video',
      el,
      src || 'video element',
      src || undefined,
      'native',
      'rewrite-src',
    );
  });

  for (const attr of VIDEO_CONTAINER_ATTRS) {
    $(`[${attr}]`).each((_, raw) => {
      const el = $(raw as CheerioElement);
      const identifier = el.attr(attr) ?? '';
      const providerMatch = attr.replace('data-', '').replace('-id', '');
      const isCriaaiSlot = attr === 'data-criaai-vsl';
      const prettyLabel = isCriaaiSlot
        ? `VSL · ${identifier || 'slot'}`
        : `${providerMatch}: ${identifier}`.trim();
      const prettyProvider = isCriaaiSlot ? 'criaai-vsl' : providerMatch;
      pushAnchor(
        'video',
        el,
        prettyLabel,
        identifier || undefined,
        prettyProvider,
        'replace-embed',
      );
    });
  }

  // CriaAI-native checkout marker — guarantees detection on generator-emitted
  // CTAs regardless of copy language. The tag decides the wire behavior.
  $('[data-criaai-checkout]').each((_, raw) => {
    const el = $(raw);
    const label =
      el.text().trim() ||
      (el.attr('aria-label') ?? '').trim() ||
      `Checkout · ${(el.attr('data-criaai-checkout') ?? 'slot').trim()}`;
    const tag = ((el.get(0) as CheerioElement).tagName ?? 'div').toLowerCase();
    const href = (el.attr('href') ?? '').trim();
    let behavior: CustomizationBehavior;
    if (tag === 'a') behavior = 'rewrite-href';
    else if (tag === 'form') behavior = 'rewrite-action';
    else behavior = 'inject-click';
    const provider =
      (href && detectCheckoutProvider(href)) ||
      `criaai-${(el.attr('data-criaai-checkout') ?? 'primary').trim()}`;
    pushAnchor('checkout', el, label, href || undefined, provider, behavior);
  });

  return anchors;
}

/**
 * Keeps `customizationValues` keyed by both ephemeral anchor ids (`ck-q03-005`)
 * and stable `groupId`s (`checkout-<stableId>`). Anchor counters are regenerated
 * whenever HTML changes; syncing prevents orphaned ids so ZIP export still sees
 * the user's URLs.
 */
export function syncCustomizationGroupKeys(
  anchors: CustomizationAnchor[],
  values: CustomizationValues,
): CustomizationValues {
  const next = { ...values };
  for (const anchor of anchors) {
    if (!anchor.groupId) continue;
    const byId = (next[anchor.id] ?? '').trim();
    const byGroup = (next[anchor.groupId] ?? '').trim();
    if (byId && !byGroup) next[anchor.groupId] = byId;
    else if (byGroup && !byId) next[anchor.id] = byGroup;
  }
  return next;
}

/**
 * Copies a value set on one anchor to every other anchor in the same
 * `groupId`. Lets the user edit the checkout URL in step q05 and have it
 * automatically apply to the same button in steps q12, q18, etc.
 *
 * Also honors values stored directly under `groupId` (stable across counter churn).
 */
export function expandValuesAcrossGroups(
  anchors: CustomizationAnchor[],
  values: CustomizationValues,
): CustomizationValues {
  if (!anchors.length || !values) return values ?? {};
  const expanded: CustomizationValues = { ...values };
  const byGroup = new Map<string, string>();

  for (const anchor of anchors) {
    if (!anchor.groupId) continue;
    const fromGroupKey = (values[anchor.groupId] ?? '').trim();
    if (fromGroupKey && !byGroup.has(anchor.groupId)) {
      byGroup.set(anchor.groupId, fromGroupKey);
    }
  }
  for (const anchor of anchors) {
    if (!anchor.groupId) continue;
    const v = (values[anchor.id] ?? '').trim();
    if (v && !byGroup.has(anchor.groupId)) {
      byGroup.set(anchor.groupId, v);
    }
  }
  if (!byGroup.size) return expanded;
  for (const anchor of anchors) {
    if (!anchor.groupId) continue;
    if ((expanded[anchor.id] ?? '').trim()) continue;
    const groupV = byGroup.get(anchor.groupId);
    if (groupV) expanded[anchor.id] = groupV;
  }
  return expanded;
}

/**
 * Applies customization values to a given HTML snapshot.
 *
 * Lookup strategy per anchor:
 *   1. `[data-criaai-id="..."]`  (preferred, deterministic)
 *   2. fall back to the legacy `selector` field
 *   3. if neither matches, try a text-content match against `label`
 */
export function applyCustomizationValues(
  html: string,
  anchors: CustomizationAnchor[],
  values: CustomizationValues,
): string {
  if (!html || !anchors.length || !values || !Object.keys(values).length) {
    return html;
  }
  const $ = load(html);
  injectStableIdsOnCheerio($);

  for (const anchor of anchors) {
    const value = (
      values[anchor.id] ??
      (anchor.groupId ? values[anchor.groupId] : '') ??
      ''
    ).trim();
    if (!value) continue;

    let target = anchor.stableId
      ? $(`[${CRIAAI_ID_ATTR}="${anchor.stableId}"]`).first()
      : $('');
    if (!target.length && anchor.selector) {
      try {
        target = $(anchor.selector).first();
      } catch {
        /* ignore bad selector */
      }
    }
    if (!target.length && anchor.label) {
      const normalized = normalizeText(anchor.label);
      $('a,button,[role="button"],iframe,video,form').each((_, raw) => {
        if (target.length) return;
        const el = $(raw);
        const text = normalizeText(el.text());
        if (
          text &&
          text.includes(normalized.slice(0, Math.min(40, normalized.length)))
        ) {
          target = el;
        }
      });
    }
    if (!target.length) continue;

    target.attr('data-criaai-custom', anchor.id);

    switch (anchor.behavior) {
      case 'rewrite-href':
        if (anchor.tag === 'a') {
          target.attr('href', value);
          target.removeAttr('target');
        } else {
          const parentLink = target.closest('a[href]');
          if (parentLink.length) {
            parentLink.attr('href', value);
            parentLink.removeAttr('target');
          } else {
            target.attr('href', value);
          }
        }
        break;
      case 'rewrite-action':
        target.attr('action', value);
        target.attr('method', target.attr('method') ?? 'get');
        break;
      case 'rewrite-src':
        target.attr('src', value);
        target.removeAttr('srcdoc');
        if (anchor.tag === 'video') target.find('source').remove();
        break;
      case 'inject-click': {
        const escaped = value.replace(/'/g, "\\'");
        target.attr('data-href', value);
        target.attr(
          'onclick',
          `window.top?window.top.location.href='${escaped}':window.location.href='${escaped}';return false;`,
        );
        break;
      }
      case 'replace-embed': {
        const width = target.attr('width') ?? '100%';
        const height = target.attr('height') ?? '420';
        // Preserve the slot container (important for CriaAI-native VSL slots
        // marked with data-criaai-vsl) so the anchor stays findable on the
        // next edit — otherwise replaceWith would destroy the stable id and
        // further edits would miss the target.
        const isSlotContainer =
          target.attr('data-criaai-vsl') !== undefined ||
          target.hasClass('sp-vsl-frame');
        const iframe = `<iframe src="${value}" width="${width}" height="${height}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen data-criaai-custom="${anchor.id}" data-criaai-id="${anchor.stableId ?? ''}" style="width:100%;height:100%;border:0;display:block;"></iframe>`;
        if (isSlotContainer) {
          target.empty();
          target.removeClass('sp-vsl-placeholder');
          target.append(iframe);
        } else {
          target.replaceWith(iframe);
        }
        break;
      }
    }
  }
  return $.html();
}
