import { load, type Cheerio, type CheerioAPI } from 'cheerio';
import type { Element as CheerioElement } from 'domhandler';
import {
  CRIAAI_ID_ATTR,
  ensureStableId,
  injectStableIdsOnCheerio,
} from './stable-id.util';

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

const CHECKOUT_DOMAIN_PATTERNS: Array<{ regex: RegExp; provider: string }> = [
  { regex: /hotmart\.com/i, provider: 'hotmart' },
  { regex: /kiwify\.com|kiwify\.app/i, provider: 'kiwify' },
  { regex: /monetizze\.com/i, provider: 'monetizze' },
  { regex: /eduzz\.com|sun\.eduzz/i, provider: 'eduzz' },
  { regex: /perfectpay\.com/i, provider: 'perfectpay' },
  { regex: /ticto\.com/i, provider: 'ticto' },
  { regex: /braip\.com/i, provider: 'braip' },
  { regex: /yampi\.com/i, provider: 'yampi' },
  { regex: /cartpanda\.com/i, provider: 'cartpanda' },
  { regex: /payt\.com|voompay/i, provider: 'payt' },
  { regex: /clickbank\.net/i, provider: 'clickbank' },
  { regex: /pagar\.me|pagarme/i, provider: 'pagarme' },
  { regex: /pagseguro|pagseguro\.uol/i, provider: 'pagseguro' },
  {
    regex: /mercadopago|mercadolivre\.com\/checkout/i,
    provider: 'mercadopago',
  },
  {
    regex: /stripe\.com\/(checkout|payment)|buy\.stripe\.com/i,
    provider: 'stripe',
  },
  { regex: /paypal\.com\/checkoutnow|paypal\.me/i, provider: 'paypal' },
  {
    regex: /shopify\.com\/checkouts|myshopify\.com\/[^/]+\/checkouts/i,
    provider: 'shopify',
  },
  { regex: /go\.hyros|go\.tryinfluencer|utmify\.com/i, provider: 'tracker' },
  {
    regex: /\/checkout(\/|\?|$)|\/carrinho|\/cart(\/|\?|$)/i,
    provider: 'checkout-path',
  },
  { regex: /\/obrigado|\/thank-?you|\/success/i, provider: 'thankyou-path' },
];

/**
 * Keyword lists kept intentionally multi-language (PT / EN / ES).
 * Keep in sync with LlmAssistService.classifyButtonFast.
 */
const CHECKOUT_TEXT_KEYWORDS = [
  'comprar',
  'quero agora',
  'quero comprar',
  'quero garantir',
  'garantir',
  'garantir minha',
  'garantir o meu',
  'garantir vaga',
  'adquirir',
  'assinar',
  'assine',
  'finalizar compra',
  'finalizar pedido',
  'ir para o checkout',
  'chamar no whatsapp',
  'meu plano',
  'meu programa',
  'get my plan',
  'get plan',
  'buy now',
  'buy today',
  'get access',
  'get instant access',
  'get started',
  'claim',
  'claim your',
  'subscribe',
  'sign up',
  'order now',
  'add to cart',
  'checkout',
  'proceed to checkout',
  'enroll',
  'comprar ahora',
  'quiero comprar',
  'quiero empezar',
  'suscribirme',
  'inscribirme',
  'ordenar',
  'empezar',
  'continuar con mi plan',
  'continuar con mi programa',
];

/**
 * Advance keywords that we should NOT treat as checkout (quiz navigation).
 */
const ADVANCE_ONLY_TEXTS = new Set<string>([
  'continuar',
  'continue',
  'next',
  'proximo',
  'próximo',
  'siguiente',
  'avancar',
  'avançar',
  'avanzar',
  'submit',
  'enviar',
  'ok',
  'aceitar',
  'aceptar',
  'concordo',
  'i agree',
  'start',
  'begin',
  'empezar',
]);

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

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isLikelyCheckoutText(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length > 120) return false;
  if (ADVANCE_ONLY_TEXTS.has(normalized)) return false;
  return CHECKOUT_TEXT_KEYWORDS.some((keyword) => normalized.includes(keyword));
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

function detectCheckoutProvider(url: string): string | undefined {
  for (const entry of CHECKOUT_DOMAIN_PATTERNS) {
    if (entry.regex.test(url)) return entry.provider;
  }
  return undefined;
}

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
    }
  });

  $('button, [role="button"], input[type="submit"], input[type="button"]').each(
    (_, raw) => {
      const el = $(raw);
      const text = el.text().trim() || (el.attr('value') ?? '').trim();
      if (!isLikelyCheckoutText(text)) return;

      const onclick = el.attr('onclick') ?? '';
      const dataHref = el.attr('data-href') ?? el.attr('data-url') ?? '';
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
        provider = detectCheckoutProvider(dataHref);
        behavior = 'inject-click';
      }
      if (!currentValue && onclick) {
        const match = onclick.match(/https?:[^'"\s)]+/);
        if (match) {
          currentValue = match[0];
          provider = detectCheckoutProvider(currentValue);
        }
      }

      // Even without any URL — if the button TEXT is clearly a CTA
      // ("Get my plan", "Quero comprar") we still expose it: the user will
      // supply the URL and we inject an onclick at apply-time.
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
    const el = $(raw as CheerioElement);
    const label =
      el.text().trim() ||
      (el.attr('aria-label') ?? '').trim() ||
      `Checkout · ${(el.attr('data-criaai-checkout') ?? 'slot').trim()}`;
    const tag = (
      (el.get(0) as CheerioElement).tagName ?? 'div'
    ).toLowerCase();
    const href = (el.attr('href') ?? '').trim();
    let behavior: CustomizationBehavior;
    if (tag === 'a') behavior = 'rewrite-href';
    else if (tag === 'form') behavior = 'rewrite-action';
    else behavior = 'inject-click';
    const provider =
      (href && detectCheckoutProvider(href)) ||
      `criaai-${(el.attr('data-criaai-checkout') ?? 'primary').trim()}`;
    pushAnchor(
      'checkout',
      el,
      label,
      href || undefined,
      provider,
      behavior,
    );
  });

  return anchors;
}

/**
 * Copies a value set on one anchor to every other anchor in the same
 * `groupId`. Lets the user edit the checkout URL in step q05 and have it
 * automatically apply to the same button in steps q12, q18, etc.
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
    const v = (values[anchor.id] ?? '').trim();
    if (v && !byGroup.has(anchor.groupId)) {
      byGroup.set(anchor.groupId, v);
    }
  }
  if (!byGroup.size) return expanded;
  for (const anchor of anchors) {
    if (!anchor.groupId) continue;
    if (expanded[anchor.id] && expanded[anchor.id].trim()) continue;
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
