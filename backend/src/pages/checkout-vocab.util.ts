/**
 * Single source-of-truth for "is this thing a checkout/buy CTA?".
 *
 * Used by:
 *   - The browser-side walker probe (`quiz-state.util.ts`) to mark
 *     `isCheckoutCta` and trigger the `checkout_end` step type.
 *   - The cloner anchor detector (`customization.util.ts`) to surface
 *     editable checkout slots in the editor.
 *   - The publish pipeline (`pages.service.ts`) when stamping
 *     `data-criaai-checkout` markers onto detected buttons.
 *
 * Keep these lists exhaustive — every keyword/regex added here improves
 * detection across ALL three call sites simultaneously.
 */

/**
 * Patterns matched against `href` / form `action` URLs to detect known
 * checkout providers regardless of button label/text.
 */
export const CHECKOUT_DOMAIN_PATTERNS: Array<{
  regex: RegExp;
  provider: string;
}> = [
  { regex: /hotmart\.com/i, provider: 'hotmart' },
  { regex: /pay\.hotmart\.com|checkout\.hotmart/i, provider: 'hotmart' },
  { regex: /kiwify\.com|kiwify\.app|kiwify\.com\.br/i, provider: 'kiwify' },
  { regex: /pay\.kiwify/i, provider: 'kiwify' },
  { regex: /monetizze\.com/i, provider: 'monetizze' },
  { regex: /eduzz\.com|sun\.eduzz/i, provider: 'eduzz' },
  { regex: /perfectpay\.com/i, provider: 'perfectpay' },
  { regex: /ticto\.com|ticto\.app/i, provider: 'ticto' },
  { regex: /braip\.com/i, provider: 'braip' },
  { regex: /yampi\.com/i, provider: 'yampi' },
  { regex: /cartpanda\.com/i, provider: 'cartpanda' },
  { regex: /payt\.com|voompay/i, provider: 'payt' },
  { regex: /clickbank\.net/i, provider: 'clickbank' },
  { regex: /pagar\.me|pagarme/i, provider: 'pagarme' },
  { regex: /pagseguro|pagseguro\.uol/i, provider: 'pagseguro' },
  { regex: /cakto\.com|cakto\.app/i, provider: 'cakto' },
  // OnProfit payment host (InLead funnels: `data-href` on button). Distinct
  // from inlead.digital (quiz UI) which stays in `QUIZ_BUILDER_HOST_SUFFIXES`.
  {
    regex: /pay\.onprofit|\.onprofit\.com|onprofit\.com\.br/i,
    provider: 'onprofit',
  },
  {
    regex: /mercadopago|mercadolivre\.com\/checkout/i,
    provider: 'mercadopago',
  },
  {
    regex:
      /stripe\.com\/(checkout|payment|pay)|buy\.stripe\.com|checkout\.stripe/i,
    provider: 'stripe',
  },
  { regex: /paypal\.com\/checkoutnow|paypal\.me/i, provider: 'paypal' },
  {
    regex: /shopify\.com\/checkouts|myshopify\.com\/[^/]+\/checkouts/i,
    provider: 'shopify',
  },
  { regex: /go\.hyros|go\.tryinfluencer|utmify\.com/i, provider: 'tracker' },
  // Generic "checkout-shaped" URL paths — last-resort, but very common on
  // independent funnels.
  {
    regex:
      /\/checkout(\/|\?|$)|\/carrinho|\/cart(\/|\?|$)|\/buy(\/|\?|$)|\/comprar(\/|\?|$)|\/pricing(\/|\?|$)|\/order(\/|\?|$)/i,
    provider: 'checkout-path',
  },
  {
    regex: /\/obrigado|\/thank-?you|\/success|\/completed/i,
    provider: 'thankyou-path',
  },
];

/**
 * Host suffixes for quiz / landing builders (NOT merchant checkout).
 * Matched on full hostname: exact match or subdomain (`www.` / `app.`).
 * Applied before `CHECKOUT_DOMAIN_PATTERNS` so paths like `/checkout` on
 * these hosts never count as checkout; footer / attribution links also
 * stay out of customization.
 */
export const QUIZ_BUILDER_HOST_SUFFIXES: readonly string[] = [
  'inlead.digital',
  'inlead.com',
];

/**
 * Normalized hostname for an absolute or root-relative URL string, or null.
 */
export function hostnameForUrlCandidate(raw: string): string | null {
  const u = (raw ?? '').trim();
  if (!u) return null;
  try {
    return new URL(u).hostname.toLowerCase();
  } catch {
    try {
      return new URL(u, 'https://placeholder.invalid').hostname.toLowerCase();
    } catch {
      return null;
    }
  }
}

/** True when the URL's host is a known quiz-platform / generator domain. */
export function isQuizBuilderHostUrl(url: string): boolean {
  const host = hostnameForUrlCandidate(url);
  if (!host) return false;
  for (const suf of QUIZ_BUILDER_HOST_SUFFIXES) {
    const s = suf.toLowerCase();
    if (host === s || host.endsWith('.' + s)) return true;
  }
  return false;
}

/**
 * Payment / offer gateway URLs for PSPs we do not list explicitly.
 * Excludes quiz-builder hosts via `isQuizBuilderHostUrl`.
 *
 * Intended for `<a href>` / `button[data-href]` style funnels so checkout
 * detection works globally without maintaining every domain.
 */
export function isLikelyGlobalMerchantPayUrl(raw: string): boolean {
  const url = (raw ?? '').trim();
  if (!/^https?:\/\//i.test(url)) return false;
  if (isQuizBuilderHostUrl(url)) return false;
  let host = '';
  let path = '';
  try {
    const u = new URL(url);
    host = u.hostname.toLowerCase();
    path = (u.pathname || '').toLowerCase();
  } catch {
    return false;
  }
  const full = url.toLowerCase();
  if (host.startsWith('pay.')) return true;
  if (/\.(pay|checkout|payments)\./.test(host) || host.startsWith('checkout.'))
    return true;
  if (
    /(^|\/)(checkout|pay|payment|pagamento|comprar|buy|order)(\/|$|\?)/i.test(
      path,
    )
  )
    return true;
  if (/[?&](off|offer|checkout|payment|tid|pid|token)(=|%3d)/i.test(full))
    return true;
  return false;
}

/**
 * Multi-language keyword list for "this label is a buy/subscribe CTA".
 * Normalize input via `normalizeCheckoutText` before matching.
 */
export const CHECKOUT_TEXT_KEYWORDS = [
  // pt-BR
  'comprar',
  'comprar agora',
  'compre agora',
  'quero comprar',
  'quero agora',
  'quero garantir',
  'quero o meu',
  'quero o meu plano',
  'quero meu plano',
  'garantir',
  'garantir agora',
  'garantir minha',
  'garantir o meu',
  'garantir vaga',
  'garantir desconto',
  'adquirir',
  'adquirir agora',
  'assinar',
  'assinar agora',
  'assine',
  'finalizar compra',
  'finalizar pedido',
  'ir para o checkout',
  'ir pro checkout',
  'fazer pedido',
  'pagar agora',
  'pagar',
  'chamar no whatsapp',
  'obter meu plano',
  'obter plano',
  'liberar meu plano',
  'receber meu plano',
  'plano completo',
  'desbloquear',
  'desbloquear agora',
  'desbloquear plano',
  'desbloquear acesso',
  'continuar com meu plano',
  'continuar com meu programa',
  'reservar',
  'reservar agora',
  'comecar plano',
  'começar plano',
  'comecar minha jornada',
  'começar minha jornada',
  // en-US
  'get my plan',
  'get plan',
  'buy now',
  'buy today',
  'buy',
  'purchase',
  'order now',
  'order today',
  'add to cart',
  'checkout',
  'proceed to checkout',
  'pay now',
  'pay',
  'get access',
  'get instant access',
  'get started now',
  'claim',
  'claim your',
  'claim my',
  'subscribe',
  'subscribe now',
  'sign up',
  'sign up now',
  'enroll',
  'enroll now',
  'unlock',
  'unlock plan',
  'unlock access',
  'reserve',
  'reserve now',
  'continue with my plan',
  'continue with my program',
  'start my plan',
  'start my journey',
  'see my plan',
  'see my results',
  'view my plan',
  'view my results',
  // es-ES / es-LATAM
  'comprar ahora',
  'quiero comprar',
  'quiero empezar',
  'quiero garantizar',
  'quiero mi plan',
  'suscribirme',
  'suscribir',
  'inscribirme',
  'ordenar',
  'pagar ahora',
  'reservar ahora',
  'desbloquear plan',
  'desbloquear acceso',
  'ver mi plan',
  'ver mis resultados',
  'continuar con mi plan',
  'continuar con mi programa',
  'empezar plan',
  'empezar mi plan',
  'obtener mi plan',
  'obtener plan',
  'obtener acceso',
  'conseguir mi plan',
  'conseguir plan',
  'activar mi plan',
  'activar plan',
];

/**
 * Pure-advance ("Continue", "Next", "OK") — explicitly NOT checkout, even
 * if it appears in a checkout-shaped URL. Helps avoid false positives in
 * mid-funnel quizzes that route through `/cart/preview` etc.
 */
export const ADVANCE_ONLY_TEXTS = new Set<string>([
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
  'comenzar',
  'comecar',
  'começar',
]);

export function normalizeCheckoutText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isLikelyCheckoutText(text: string): boolean {
  const normalized = normalizeCheckoutText(text);
  if (!normalized || normalized.length > 120) return false;
  if (ADVANCE_ONLY_TEXTS.has(normalized)) return false;
  return CHECKOUT_TEXT_KEYWORDS.some((kw) => normalized.includes(kw));
}

export function detectCheckoutProvider(url: string): string | undefined {
  if (!url || isQuizBuilderHostUrl(url)) return undefined;
  for (const entry of CHECKOUT_DOMAIN_PATTERNS) {
    if (entry.regex.test(url)) return entry.provider;
  }
  if (isLikelyGlobalMerchantPayUrl(url)) return 'external-pay';
  return undefined;
}

/**
 * Regex used to identify checkout intent in element ATTRIBUTES (as opposed to
 * visible text). Framework-agnostic — most funnel builders ship buttons with
 * `data-testid="button-checkout"`, `id="checkout-button"`, `class="btn-buy"`
 * or similar. This is a very strong positive signal: language-independent,
 * stable across locales, and set intentionally by the site authors.
 *
 * Applied to: `data-testid`, `data-test`, `data-qa`, `id`, `name`, `class`,
 * `data-event`, `data-analytics`, `aria-label` of the button itself AND up
 * to two ancestors (captures wrapper divs like
 * `<div id="checkout-btn"><button>…</button></div>`).
 *
 * We use word-boundary-ish separators so "checkout" matches inside
 * "button-checkout", "checkout-button", "btnCheckout", "checkout_cta" but
 * NOT inside unrelated words like "checkoutline" / "checkoutline-wrap".
 */
export const CHECKOUT_ATTR_REGEX =
  /(^|[-_ /.])(checkout|buy-?now|purchase|pay-?now|subscribe-?btn|btn-?compra|btn-?buy|btn-?checkout|cta-?checkout|cta-?buy|order-?now|place-?order|finalizar-?compra|comprar-?ahora|comprar-?agora|obtener-?plan|get-?plan)($|[-_ /.])/i;

/**
 * Strong checkout keywords — when the BUTTON LABEL contains one of these,
 * we treat it as a checkout CTA *without* requiring any attribute hint.
 * These are specific enough to be unambiguous across languages and are the
 * ONLY text-only triggers allowed to stamp `data-criaai-checkout`.
 *
 * Intentionally narrower than `CHECKOUT_TEXT_KEYWORDS` (which is OK for
 * secondary signals). Words like "mi plan", "see my results" or even
 * "continuar con mi plan" DO NOT belong here — they trigger false positives
 * on mid-funnel results/confirmation screens that just happen to mention
 * "plan" in the heading.
 */
export const CHECKOUT_STRONG_TEXT_KEYWORDS = [
  // Explicit buy / subscribe / order verbs + object
  'comprar agora',
  'compre agora',
  'comprar ahora',
  'comprar ya',
  'quiero comprar',
  'quero comprar',
  'finalizar compra',
  'finalizar pedido',
  'fazer pedido',
  'ir para o checkout',
  'ir pro checkout',
  'proceed to checkout',
  'checkout',
  'add to cart',
  'anadir al carrito',
  'añadir al carrito',
  'adicionar ao carrinho',
  'buy now',
  'buy today',
  'order now',
  'place order',
  'purchase now',
  'purchase',
  'subscribe now',
  'subscribe',
  'suscribirme',
  'suscribir',
  'enroll now',
  // Plan-claim verbs with clear "get/activate/claim" prefix (the verb is
  // what makes it unambiguous — a bare "Continue" + "my plan" heading is
  // NOT a checkout).
  'obtener mi plan',
  'obtener plan',
  'obtener acceso',
  'conseguir mi plan',
  'conseguir plan',
  'activar mi plan',
  'activar plan',
  'get my plan',
  'get plan',
  'get instant access',
  'get access',
  'claim my plan',
  'claim plan',
  'unlock plan',
  'unlock access',
  'desbloquear plan',
  'desbloquear plano',
  'desbloquear acceso',
  'desbloquear acesso',
  'liberar meu plano',
  'liberar plano',
  'obter meu plano',
  // Spanish "pedir ahora" / "pedir mi plan" (no.Diet-style sticky CTA)
  'pedir ahora',
  'pedir mi plan',
  'pedir plan',
  // Portuguese: garantir + object
  'garantir agora',
  'garantir minha vaga',
  'garantir o meu',
  'garantir minha',
  'quero garantir',
  'quero garantizar',
  // Pricing card CTAs
  'escoger plan',
  'escolher plano',
  'choose plan',
  'select plan',
  'seleccionar plan',
];

export function isStrongCheckoutText(text: string): boolean {
  const normalized = normalizeCheckoutText(text);
  if (!normalized || normalized.length > 120) return false;
  if (ADVANCE_ONLY_TEXTS.has(normalized)) return false;
  return CHECKOUT_STRONG_TEXT_KEYWORDS.some((kw) => normalized.includes(kw));
}

/**
 * Convenience: full classification for a single button-like element. Returns
 * the dominant signal and (when applicable) the matched provider so the
 * caller can stamp `data-criaai-checkout="<provider>"` for the editor.
 */
export interface CheckoutVerdict {
  isCheckout: boolean;
  matchedBy: 'text' | 'href' | 'action' | 'none';
  provider?: string;
}

export function classifyCheckoutCandidate(input: {
  text?: string;
  href?: string;
  formAction?: string;
}): CheckoutVerdict {
  const href = input.href || '';
  const action = input.formAction || '';
  const text = input.text || '';

  const hrefProvider = href ? detectCheckoutProvider(href) : undefined;
  if (hrefProvider) {
    return { isCheckout: true, matchedBy: 'href', provider: hrefProvider };
  }
  const actionProvider = action ? detectCheckoutProvider(action) : undefined;
  if (actionProvider) {
    return { isCheckout: true, matchedBy: 'action', provider: actionProvider };
  }
  if (isLikelyCheckoutText(text)) {
    return { isCheckout: true, matchedBy: 'text' };
  }
  return { isCheckout: false, matchedBy: 'none' };
}
