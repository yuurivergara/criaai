import { load, type Cheerio } from 'cheerio';
import type { Element as CheerioElement } from 'domhandler';

export type CustomizationKind = 'checkout' | 'video';

export interface CustomizationAnchor {
  id: string;
  stepId: string;
  kind: CustomizationKind;
  selector: string;
  /** Short preview text/URL to help the user recognize the element. */
  label: string;
  /** The current href / src / action — useful as a placeholder and fallback. */
  currentValue?: string;
  /** Element tag (a, button, iframe, video, form, ...). */
  tag: string;
  /** Provider hint (youtube, vimeo, hotmart, kiwify, etc) when detectable. */
  provider?: string;
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
  { regex: /mercadopago|mercadolivre\.com\/checkout/i, provider: 'mercadopago' },
  { regex: /stripe\.com\/(checkout|payment)|buy\.stripe\.com/i, provider: 'stripe' },
  { regex: /paypal\.com\/checkoutnow|paypal\.me/i, provider: 'paypal' },
  { regex: /shopify\.com\/checkouts|myshopify\.com\/[^/]+\/checkouts/i, provider: 'shopify' },
  { regex: /go\.hyros|go\.tryinfluencer|utmify\.com/i, provider: 'tracker' },
  { regex: /\/checkout(\/|\?|$)|\/carrinho|\/cart(\/|\?|$)/i, provider: 'checkout-path' },
  { regex: /\/obrigado|\/thank-?you|\/success/i, provider: 'thankyou-path' },
];

const CHECKOUT_TEXT_KEYWORDS = [
  // PT
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
  'continuar',
  'finalizar compra',
  'finalizar pedido',
  'ir para o checkout',
  'chamar no whatsapp',
  // EN
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
  // ES
  'comprar ahora',
  'quiero comprar',
  'adquirir',
  'suscribirme',
  'inscribirme',
  'ordenar',
];

const VIDEO_IFRAME_PATTERNS: Array<{ regex: RegExp; provider: string }> = [
  { regex: /youtube\.com\/embed|youtu\.be/i, provider: 'youtube' },
  { regex: /player\.vimeo\.com/i, provider: 'vimeo' },
  { regex: /fast\.wistia\.net|wistia\.com/i, provider: 'wistia' },
  { regex: /scripts\.converteai\.net|players\.converteai\.net/i, provider: 'converteai' },
  { regex: /vturb\.com|cdn\.vturb\.io|players\.vturb\.com/i, provider: 'vturb' },
  { regex: /panda\.video|play\.panda\.video|pandavideo/i, provider: 'pandavideo' },
  { regex: /video\.mymyelin|mymyelin/i, provider: 'myelin' },
  { regex: /vidalytics/i, provider: 'vidalytics' },
  { regex: /fast\.pages\.bunny\.net|iframe\.mediadelivery\.net/i, provider: 'bunny' },
  { regex: /vsl|video-sales|videoask|loom\.com/i, provider: 'vsl-generic' },
];

const VIDEO_CONTAINER_ATTRS = [
  'data-vturb-player-id',
  'data-video-id',
  'data-vimeo-id',
  'data-panda-id',
  'data-wistia-id',
  'data-youtube-id',
];

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildSelector(el: Cheerio<CheerioElement>, $: ReturnType<typeof load>): string {
  const segments: string[] = [];
  let node = el;
  const MAX = 12;
  let depth = 0;
  while (node.length && depth < MAX) {
    const tag = (node.get(0) as CheerioElement).tagName?.toLowerCase();
    if (!tag || tag === 'html' || tag === 'body') break;
    const parent = node.parent();
    if (!parent.length) {
      segments.unshift(tag);
      break;
    }
    const sameTagSiblings = parent.children(tag);
    let segment = tag;
    if (sameTagSiblings.length > 1) {
      const index = sameTagSiblings.toArray().indexOf(node.get(0) as CheerioElement) + 1;
      if (index > 0) {
        segment = `${tag}:nth-of-type(${index})`;
      }
    }
    segments.unshift(segment);
    node = parent;
    depth += 1;
  }
  return segments.join(' > ');
}

function isLikelyCheckoutText(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized || normalized.length > 120) return false;
  return CHECKOUT_TEXT_KEYWORDS.some((keyword) =>
    normalized.includes(keyword),
  );
}

/**
 * Returns true when the href is most likely just intra-site/quiz navigation
 * (anchors, javascript:, relative paths, same-host). Such hrefs are not
 * checkout candidates unless they explicitly hit a known payment gateway.
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

/**
 * Scans the HTML and emits a list of "customization anchors" the end-user may
 * want to rewire on their cloned page (checkout URLs, VSL embeds).
 *
 * Generic by design: uses text keywords + provider regex libraries,
 * not per-site hardcoded selectors.
 */
export function detectCustomizationAnchors(
  html: string,
  stepId: string,
  options?: { ignoreSelectors?: string[] },
): CustomizationAnchor[] {
  if (!html) return [];
  const $ = load(html);
  const anchors: CustomizationAnchor[] = [];
  const seenSelectors = new Set<string>();
  const ignoreSelectors = new Set(
    (options?.ignoreSelectors ?? []).map((s) => s.trim()).filter(Boolean),
  );
  let counter = 0;

  const pushAnchor = (
    kind: CustomizationKind,
    el: Cheerio<CheerioElement>,
    label: string,
    currentValue: string | undefined,
    provider: string | undefined,
  ) => {
    const selector = buildSelector(el, $);
    if (!selector || seenSelectors.has(selector)) return;
    if (ignoreSelectors.has(selector)) return;
    seenSelectors.add(selector);
    counter += 1;
    const tag = ((el.get(0) as CheerioElement).tagName ?? 'div').toLowerCase();
    anchors.push({
      id: `${kind === 'checkout' ? 'ck' : 'vid'}-${stepId}-${counter.toString().padStart(3, '0')}`,
      stepId,
      kind,
      selector,
      label: shortenLabel(label || tag),
      currentValue,
      tag,
      provider,
    });
  };

  $('a[href], form[action]').each((_, raw) => {
    const el = $(raw);
    const href = (el.attr('href') ?? el.attr('action') ?? '').trim();
    if (!href) return;
    const text = el.text().trim();
    const provider = detectCheckoutProvider(href);
    const matchesText = isLikelyCheckoutText(text);
    // Provider hit always wins (real gateway). Text-only matches require an
    // EXTERNAL http(s) URL — internal/relative hrefs are quiz navigation.
    if (provider) {
      pushAnchor('checkout', el, text || href, href, provider);
    } else if (matchesText && !isInternalNavigationHref(href)) {
      pushAnchor('checkout', el, text || href, href, undefined);
    }
  });

  $('button, [role="button"]').each((_, raw) => {
    const el = $(raw);
    const text = el.text().trim();
    if (!isLikelyCheckoutText(text)) return;
    const onclick = el.attr('onclick') ?? '';
    const dataHref = el.attr('data-href') ?? el.attr('data-url') ?? '';
    const parentLink = el.closest('a[href]');
    let currentValue: string | undefined;
    let provider: string | undefined;
    if (parentLink.length) {
      currentValue = parentLink.attr('href');
      provider = currentValue
        ? detectCheckoutProvider(currentValue)
        : undefined;
    }
    if (!currentValue && dataHref) {
      currentValue = dataHref;
      provider = detectCheckoutProvider(dataHref);
    }
    if (!currentValue && onclick) {
      const match = onclick.match(/https?:[^'"\\s]+/);
      if (match) {
        currentValue = match[0];
        provider = detectCheckoutProvider(currentValue);
      }
    }
    // Without any URL — or with only an internal/relative URL and no known
    // provider — this is just quiz/site navigation, not a checkout button.
    if (!currentValue) return;
    if (!provider && isInternalNavigationHref(currentValue)) return;
    pushAnchor('checkout', el, text, currentValue, provider);
  });

  $('iframe[src]').each((_, raw) => {
    const el = $(raw);
    const src = (el.attr('src') ?? '').trim();
    if (!src) return;
    const provider = detectVideoProvider(src);
    if (!provider) return;
    pushAnchor('video', el, src, src, provider);
  });

  $('video').each((_, raw) => {
    const el = $(raw);
    const src = el.attr('src') ?? el.find('source').first().attr('src') ?? '';
    pushAnchor('video', el, src || 'video element', src || undefined, 'native');
  });

  for (const attr of VIDEO_CONTAINER_ATTRS) {
    $(`[${attr}]`).each((_, raw) => {
      const el = $(raw as CheerioElement);
      const identifier = el.attr(attr) ?? '';
      const providerMatch = attr.replace('data-', '').replace('-id', '');
      pushAnchor(
        'video',
        el,
        `${providerMatch}: ${identifier}`.trim(),
        identifier,
        providerMatch,
      );
    });
  }

  return anchors;
}

/**
 * Applies customization values to a given HTML snapshot. Each anchor's
 * selector is matched with Cheerio and rewritten according to its kind.
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
  for (const anchor of anchors) {
    const value = (values[anchor.id] ?? '').trim();
    if (!value) continue;
    const target = $(anchor.selector).first();
    if (!target.length) continue;
    target.attr('data-criaai-custom', anchor.id);

    if (anchor.kind === 'checkout') {
      const tag = anchor.tag;
      if (tag === 'a') {
        target.attr('href', value);
        target.removeAttr('target');
      } else if (tag === 'form') {
        target.attr('action', value);
        target.attr('method', target.attr('method') ?? 'get');
      } else {
        const parentLink = target.closest('a[href]');
        if (parentLink.length) {
          parentLink.attr('href', value);
          parentLink.removeAttr('target');
        } else {
          target.attr('data-href', value);
          target.attr('onclick', `window.location.href='${value.replace(/'/g, "\\'")}';return false;`);
        }
      }
    } else if (anchor.kind === 'video') {
      if (anchor.tag === 'iframe') {
        target.attr('src', value);
        target.removeAttr('srcdoc');
      } else if (anchor.tag === 'video') {
        target.attr('src', value);
        target.find('source').remove();
      } else {
        // Custom player container: replace it with a plain iframe pointing to
        // the user-provided VSL URL (best effort for non-iframe widgets).
        const width = target.attr('width') ?? '100%';
        const iframe = `<iframe src="${value}" width="${width}" height="${target.attr('height') ?? '420'}" frameborder="0" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen data-criaai-custom="${anchor.id}"></iframe>`;
        target.replaceWith(iframe);
      }
    }
  }
  return $.html();
}
