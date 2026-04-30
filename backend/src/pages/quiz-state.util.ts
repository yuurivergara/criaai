import { CRIAAI_ID_ATTR } from './stable-id.util';
import {
  CHECKOUT_ATTR_REGEX,
  CHECKOUT_DOMAIN_PATTERNS,
  CHECKOUT_STRONG_TEXT_KEYWORDS,
  CHECKOUT_TEXT_KEYWORDS,
  QUIZ_BUILDER_HOST_SUFFIXES,
} from './checkout-vocab.util';

// Serialize once for the browser-side IIFE. Using JSON.stringify on the
// regex SOURCES (not the RegExp objects, which don't survive JSON) so the
// helper can rebuild them inside the page context.
const CHECKOUT_DOMAIN_PATTERNS_BROWSER_JSON = JSON.stringify(
  CHECKOUT_DOMAIN_PATTERNS.map((p) => ({
    source: p.regex.source,
    flags: p.regex.flags,
    provider: p.provider,
  })),
);
const CHECKOUT_TEXT_KEYWORDS_BROWSER_JSON = JSON.stringify(
  CHECKOUT_TEXT_KEYWORDS,
);
const CHECKOUT_STRONG_TEXT_KEYWORDS_BROWSER_JSON = JSON.stringify(
  CHECKOUT_STRONG_TEXT_KEYWORDS,
);
const CHECKOUT_ATTR_REGEX_BROWSER_JSON = JSON.stringify({
  source: CHECKOUT_ATTR_REGEX.source,
  flags: CHECKOUT_ATTR_REGEX.flags,
});
const QUIZ_BUILDER_HOST_SUFFIXES_BROWSER_JSON = JSON.stringify([
  ...QUIZ_BUILDER_HOST_SUFFIXES,
]);

/**
 * Shared vocabulary for the quiz walker. Each captured state has a StepType
 * that governs which click strategy is used, and a multi-signal fingerprint
 * that is far more robust than "title + N chars of body".
 *
 * This file is isomorphic: `QUIZ_STATE_BROWSER_JS` is the serialized version
 * of the same logic, executed inside Playwright via page.evaluate. Any logic
 * change here MUST be mirrored there.
 */

export type StepType =
  | 'radio_then_continue' // one radio/card must be selected, then a continue button advances
  | 'checkbox_then_continue' // multiple boxes possible, then continue
  | 'branching' // N buttons, each leads to a distinct next state (no continue)
  | 'fake_loader' // only spinners/skeletons visible, no interactives — transient screen
  | 'checkout_end' // a strong buy/subscribe CTA is the primary focus → terminal
  | 'generic'; // fallback: random set of clickable things

export interface QuizAction {
  selector: string;
  actionId?: string;
  triggerText: string;
  kind: 'advance' | 'option' | 'link';
  score: number;
  isAdvance: boolean;
  isOption: boolean;
  isCheckoutCta: boolean;
  /**
   * True when the checkout classification came from a known provider href
   * (Hotmart, Stripe, …) — strongest signal possible. Differentiates real
   * payment CTAs from generic "Continue" buttons that happen to match a
   * checkout text keyword.
   */
  isCheckoutByHref?: boolean;
  /**
   * True when the button or an ancestor carries an attribute (data-testid,
   * id, class, name, data-event, aria-label) that explicitly names a
   * checkout/buy intent — e.g. `data-testid="button-checkout"`. Very strong
   * signal: language-independent, set deliberately by site authors, and
   * frequently present in funnel builders even when the visible text is a
   * localized CTA that our keyword list doesn't know about.
   */
  isCheckoutByAttr?: boolean;
  /**
   * True when the visible label matches an *unambiguous* buy/subscribe/claim
   * keyword (narrow list, `CHECKOUT_STRONG_TEXT_KEYWORDS`). Enough on its
   * own to stamp `data-criaai-checkout`. Distinguished from the wider
   * `isCheckoutCta` which may also flip for softer text matches that are
   * NOT sufficient to create a customization anchor on their own.
   */
  isCheckoutByStrongText?: boolean;
  /** Matched provider name when `isCheckoutByHref` is true. */
  checkoutProvider?: string;
  isRadioLike: boolean;
  isCheckboxLike: boolean;
  isSelected: boolean;
}

export interface QuizReadiness {
  interactiveCount: number;
  textLen: number;
  hasLoader: boolean;
  hasQuestion: boolean;
  domChildCount: number;
  /** Matched loading keyword ("analisando", "analyzing", ...) when text-based detection fired. */
  loadingTextSample?: string;
  /** True when a big animated shape (spinner-like div) is visible. */
  hasAnimatedShape?: boolean;
}

export interface QuizStateSnapshot {
  stepType: StepType;
  questionText: string;
  optionLabels: string[];
  actions: QuizAction[];
  readiness: QuizReadiness;
  advanceButtonCount: number;
  radioCount: number;
  checkboxCount: number;
  optionCount: number;
  buttonCount: number;
  linkCount: number;
  loaderCount: number;
  pathname: string;
  /**
   * True when the page has a visible text-like input that still needs to be
   * filled in — e-mail, phone, name, height, weight, DOB, etc. Walker uses
   * this to avoid misclassifying a lead/email gate as `checkout_end`: a
   * single button that looks like a CTA but gates a form field is NOT the
   * end of the funnel.
   */
  hasVisibleTextInput?: boolean;
  /**
   * Up to ~4000 chars of visible body text. Used by the LLM arbiter to make
   * screen-level decisions (is this a lead gate? a price/plan selector? a
   * branching question?) without extra page.evaluate calls.
   */
  bodyTextSample?: string;
  /**
   * Fully-qualified iframe URLs that look like third-party quiz / funnel
   * hosts (Cakto, Hotmart, Kiwify, Eduzz, …) discovered on the parent
   * page. The walker uses this to detect "host page is just a wrapper for
   * a producer-side quiz" and redirect the clone job at the iframe URL
   * instead of capturing an empty shell.
   */
  iframeQuizCandidates?: string[];
  /**
   * When the walker can't make progress because the screen relies on UI
   * that we can't simulate (canvas-only games, swipe gestures, drag &
   * drop), it sets a short reason code here so the caller can stop
   * gracefully and surface it in the job's error.
   */
  unsupportedReason?:
    | 'canvas_dominant_no_buttons'
    | 'swipe_only'
    | 'pointer_events_blocked'
    | string;
}

export interface QuizFingerprint {
  signature: string;
  humanTitle: string;
  stepType: StepType;
}

export function computeQuizFingerprint(
  snapshot: QuizStateSnapshot,
  currentUrl: string,
): QuizFingerprint {
  let pathname = '';
  try {
    pathname = new URL(currentUrl).pathname;
  } catch {
    pathname = snapshot.pathname || '';
  }
  const questionHash = fnv1a9(snapshot.questionText);
  const optionsHash = fnv1a9(
    snapshot.optionLabels.slice(0, 20).sort().join('|'),
  );
  const signature = [
    `p:${pathname}`,
    `t:${snapshot.stepType}`,
    `q:${questionHash}`,
    `o:${optionsHash}`,
    `oC:${snapshot.optionCount}`,
    `aC:${snapshot.advanceButtonCount}`,
  ].join('|');
  const humanTitle =
    snapshot.questionText.slice(0, 80) ||
    snapshot.optionLabels.slice(0, 2).join(' / ') ||
    snapshot.stepType;
  return {
    signature,
    humanTitle,
    stepType: snapshot.stepType,
  };
}

function fnv1a9(str: string): string {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(36).padStart(7, '0').slice(0, 9);
}

/**
 * Browser-side IIFE that returns a QuizStateSnapshot. Takes ONE page.evaluate
 * call instead of the previous 3-4 — cuts ~200ms per step.
 */
export const QUIZ_STATE_BROWSER_JS = `
(() => {
  const ATTR = ${JSON.stringify(CRIAAI_ID_ATTR)};

  const ADVANCE_TEXTS = [
    'continuar','continue','continúa','continua','next','proximo','próximo','seguinte',
    'siguiente','avanzar','avançar','submit','enviar','comenzar','começar','empezar',
    'start','comecar','concluir','finalizar','finish','confirmar','confirm','ok',
    'aceptar','aceitar','i agree','concordo','proceed','adelante','vamos','go',
  ];
  // Multi-language checkout vocabulary, sourced from checkout-vocab.util.ts so
  // the walker, the customization detector and the publish pipeline all agree
  // on what counts as a "buy" CTA.
  //
  //   CHECKOUT_TEXTS (wide): secondary hint — can influence the step-type
  //     classification when combined with another strong signal, but NEVER
  //     stamps data-criaai-checkout on its own. Catches cases like
  //     "quero meu plano" where the verb leaves no ambiguity, plus gentler
  //     localized variants.
  //   CHECKOUT_STRONG_TEXTS (narrow): unambiguous buy/subscribe/checkout
  //     verbs. Sufficient on its own to mark an element as a checkout CTA
  //     (stamp + step-type promotion). Keeps out generic "Continuar" even
  //     when surrounded by "plan" / "plano" headings.
  const CHECKOUT_TEXTS = ${CHECKOUT_TEXT_KEYWORDS_BROWSER_JSON};
  const CHECKOUT_STRONG_TEXTS = ${CHECKOUT_STRONG_TEXT_KEYWORDS_BROWSER_JSON};
  // Provider URL regexes (Hotmart, Stripe, Kiwify, …). Rebuilt from
  // {source, flags} because RegExp doesn't round-trip through JSON.
  const CHECKOUT_DOMAIN_REGEXES = (function () {
    var raw = ${CHECKOUT_DOMAIN_PATTERNS_BROWSER_JSON};
    var out = [];
    for (var i = 0; i < raw.length; i += 1) {
      try { out.push({ regex: new RegExp(raw[i].source, raw[i].flags), provider: raw[i].provider }); } catch (_) {}
    }
    return out;
  })();
  var QUIZ_BUILDER_HOST_SUFFIXES = ${QUIZ_BUILDER_HOST_SUFFIXES_BROWSER_JSON};
  function isQuizBuilderHostFromUrl(url) {
    if (!url) return false;
    var host = '';
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch (_) {
      try {
        host = new URL(url, 'https://placeholder.invalid').hostname.toLowerCase();
      } catch (__) {
        return false;
      }
    }
    for (var j = 0; j < QUIZ_BUILDER_HOST_SUFFIXES.length; j += 1) {
      var suf = String(QUIZ_BUILDER_HOST_SUFFIXES[j] || '').toLowerCase();
      if (!suf) continue;
      if (host === suf || host.endsWith('.' + suf)) return true;
    }
    return false;
  }
  const isLikelyGlobalMerchantPayUrl = function (raw) {
    var url = (raw || '').trim();
    var low = url.toLowerCase();
    if (low.indexOf('https://') !== 0 && low.indexOf('http://') !== 0) return false;
    if (isQuizBuilderHostFromUrl(url)) return false;
    var host = '';
    var path = '';
    try {
      var u = new URL(url);
      host = (u.hostname || '').toLowerCase();
      path = ((u.pathname || '') + '').toLowerCase();
    } catch (_) {
      return false;
    }
    var full = url.toLowerCase();
    if (host.indexOf('pay.') === 0) return true;
    if (/\\.(pay|checkout|payments)\\./.test(host) || host.indexOf('checkout.') === 0)
      return true;
    if (/(^|\\/)(checkout|pay|payment|pagamento|comprar|buy|order)(\\/|$|\\?)/i.test(path))
      return true;
    if (/[?&](off|offer|checkout|payment|tid|pid|token)(=|%3d)/i.test(full)) return true;
    return false;
  };
  const detectCheckoutHref = function (url) {
    if (!url || isQuizBuilderHostFromUrl(url)) return null;
    for (var i = 0; i < CHECKOUT_DOMAIN_REGEXES.length; i += 1) {
      if (CHECKOUT_DOMAIN_REGEXES[i].regex.test(url)) return CHECKOUT_DOMAIN_REGEXES[i].provider;
    }
    if (isLikelyGlobalMerchantPayUrl(url)) return 'external-pay';
    return null;
  };
  // Attribute-level checkout signal. Reads a small set of attributes from
  // the element and up to TWO ancestors — covers \`<div id="checkout-btn"><button>…</button></div>\`
  // as well as \`<button data-testid="button-checkout">\`. Framework-agnostic,
  // language-independent.
  const CHECKOUT_ATTR_RE = (function () {
    var meta = ${CHECKOUT_ATTR_REGEX_BROWSER_JSON};
    try { return new RegExp(meta.source, meta.flags); } catch (_) { return null; }
  })();
  const CHECKOUT_ATTRS_TO_SCAN = [
    'data-testid', 'data-test', 'data-qa', 'data-cy', 'data-event',
    'data-analytics', 'id', 'name', 'class', 'aria-label', 'role',
  ];
  const hasCheckoutAttrOnElement = function (el) {
    if (!el || !CHECKOUT_ATTR_RE) return false;
    for (var i = 0; i < CHECKOUT_ATTRS_TO_SCAN.length; i += 1) {
      var v = el.getAttribute ? el.getAttribute(CHECKOUT_ATTRS_TO_SCAN[i]) : null;
      if (v && CHECKOUT_ATTR_RE.test(v)) return true;
    }
    return false;
  };
  const detectCheckoutByAttr = function (el) {
    if (hasCheckoutAttrOnElement(el)) return true;
    var p = el && el.parentElement;
    if (hasCheckoutAttrOnElement(p)) return true;
    var pp = p && p.parentElement;
    if (hasCheckoutAttrOnElement(pp)) return true;
    return false;
  };
  const BOILERPLATE_RE =
    /(privacy|privacidade|politica|policy|policies|terms|termos|tos|cookie|cookies|gdpr|lgpd|imprint|impressum|disclaimer|refund|reembolso|cancelamento|cancellation|sitemap|about[- ]us|sobre[- ]nos|contact|contato|fale[- ]conosco|faq|help|ajuda|support|suporte)/;

  const normalize = (v) =>
    (v || '')
      .toString()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .replace(/\\s+/g, ' ')
      .trim();

  const stripDigits = (v) => normalize(v).replace(/\\d+/g, '#');

  const visibleArea = (el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width <= 3 || rect.height <= 3) return 0;
    if (rect.bottom <= 0 || rect.right <= 0) return 0;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
    if (parseFloat(cs.opacity || '1') < 0.05) return 0;
    return rect.width * rect.height;
  };
  const isVisible = (el) => visibleArea(el) > 10;

  // Shadow-DOM-aware query. document.querySelectorAll only walks the light
  // DOM, so any quiz built with web components (Stencil, Lit, custom
  // <my-quiz>...) hides its buttons/options behind one or more shadow
  // roots. deepQueryAll recurses into every open shadowRoot AND every
  // same-origin iframe document so the action enumeration sees the same
  // set of elements a real user would.
  const deepQueryAll = (selector) => {
    const out = [];
    const visited = new Set();
    const walk = (root) => {
      if (!root || visited.has(root)) return;
      visited.add(root);
      try {
        const matches = root.querySelectorAll
          ? root.querySelectorAll(selector)
          : [];
        for (let i = 0; i < matches.length; i += 1) out.push(matches[i]);
      } catch (_) { /* ignore */ }
      try {
        const descendants = root.querySelectorAll
          ? root.querySelectorAll('*')
          : [];
        for (let i = 0; i < descendants.length; i += 1) {
          const el = descendants[i];
          if (el && el.shadowRoot) walk(el.shadowRoot);
          if (el && el.tagName === 'IFRAME') {
            try {
              const doc = el.contentDocument;
              if (doc) walk(doc);
            } catch (_) { /* cross-origin */ }
          }
        }
      } catch (_) { /* ignore */ }
    };
    walk(document);
    return out;
  };

  const cssPathOf = (el) => {
    const segments = [];
    let node = el;
    while (node && node.nodeType === 1 && node !== document.body) {
      const tag = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (!parent) { segments.unshift(tag); break; }
      const sameTag = Array.from(parent.children).filter(c => c.tagName === node.tagName);
      let seg = tag;
      if (sameTag.length > 1) seg = tag + ':nth-of-type(' + (sameTag.indexOf(node) + 1) + ')';
      segments.unshift(seg);
      node = parent;
    }
    return segments.join(' > ');
  };

  const firstQuestionText = () => {
    const heads = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"]'));
    for (const h of heads) {
      if (!isVisible(h)) continue;
      const t = (h.textContent || '').trim();
      if (t.length >= 3 && t.length < 260) return t;
    }
    // Fallback: biggest visible block of <p> / <span> with reasonable length
    const candidates = Array.from(document.querySelectorAll('p, span, strong, div[class*="question"], div[class*="title"]'));
    let best = '';
    let bestScore = 0;
    for (const el of candidates) {
      if (!isVisible(el)) continue;
      const t = (el.textContent || '').trim();
      if (t.length < 6 || t.length > 260) continue;
      const fontSize = parseFloat(getComputedStyle(el).fontSize || '0');
      const score = fontSize * 2 + Math.min(60, t.length);
      if (score > bestScore) { bestScore = score; best = t; }
    }
    return best;
  };

  // Thin top-of-page progress chrome (funnel bar, role=progressbar on every
  // step) must NOT count as "blocking loader" — otherwise hasLoader is true
  // forever, waitForQuizStepReady never settles, and we capture blank shells.
  const loaderSelector =
    '[class*="loader" i], [class*="spinner" i], [class*="skeleton" i], [class*="shimmer" i], [class*="placeholder" i], [aria-busy="true"], [role="progressbar"], progress, [class*="progress-ring"], [class*="circular-progress"], [class*="loading" i], [class*="analyzing" i], [class*="analisando" i], [class*="analizando" i], [class*="preparando" i], [class*="calculating" i]';
  const loaderCandidates = deepQueryAll(loaderSelector).filter(isVisible);
  const isAmbientQuizProgressChrome = function (el) {
    try {
      var rect = el.getBoundingClientRect();
      if (rect.width <= 3 || rect.height <= 3) return false;
      var thinHorizontal =
        rect.height <= 40 &&
        rect.width >= Math.min(window.innerWidth * 0.32, 360);
      if (!thinHorizontal) return false;
      if (rect.top > 110) return false;
      var tag = el.tagName ? el.tagName.toLowerCase() : '';
      var role = el.getAttribute ? el.getAttribute('role') : '';
      if (role === 'progressbar' || tag === 'progress') return true;
      var cls = ((el.className || '') + '').toLowerCase();
      if (
        tag === 'div' &&
        (cls.indexOf('rounded-full') >= 0 ||
          cls.indexOf('overflow-hidden') >= 0 ||
          cls.indexOf('duration') >= 0 ||
          cls.indexOf('bg-featured') >= 0 ||
          cls.indexOf('ease') >= 0)
      ) {
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  };
  var loaderCount = 0;
  for (var lc = 0; lc < loaderCandidates.length; lc++) {
    if (!isAmbientQuizProgressChrome(loaderCandidates[lc])) loaderCount++;
  }

  // Text-based loader detection: some quiz platforms use custom CSS animations
  // (no spinner classname in the DOM) to show "Analisando suas respostas…" /
  // "Creating your plan…" / "Calculating…" — these ARE fake-loader screens,
  // the walker must wait instead of capturing them as real steps.
  const LOADING_TEXT_PATTERNS = [
    // pt-BR
    'analisando', 'analisando suas respostas', 'calculando',
    'processando', 'personalizando', 'criando seu plano',
    'gerando seu plano', 'criando seu', 'preparando',
    'um momento', 'aguarde', 'carregando', 'so um momento',
    'quase la', 'quase pronto', 'estamos preparando',
    // es-ES / es-MX
    'analizando', 'analizando tus respuestas', 'procesando',
    'creando tu plan', 'generando', 'un momento', 'cargando',
    'espera', 'estamos preparando', 'casi listo', 'preparando tu',
    // en-US
    'analyzing', 'analyzing your answers', 'calculating',
    'creating your plan', 'generating your', 'personalizing your',
    'one moment', 'please wait', 'loading', 'preparing',
    'hold tight', 'almost there', 'working on it', 'crunching',
  ];
  let hasLoadingText = false;
  let loadingTextSample = '';
  (function detectLoadingText() {
    const body = document.body;
    if (!body) return;
    const raw = (body.innerText || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    // Scan the visible-first slice only — long pages (privacy/footer) made
    // raw.length >= 500 so we skipped "analisando…" entirely and missed fake loaders.
    const headSample = raw.slice(0, 2200);
    if (headSample.length > 0) {
      for (const kw of LOADING_TEXT_PATTERNS) {
        if (headSample.includes(kw)) {
          hasLoadingText = true;
          loadingTextSample = kw;
          break;
        }
      }
    }
  })();

  // Additional signal: big animated elements (CSS animation/transition on
  // an element with no children and a size that suggests a spinner/dot).
  let hasAnimatedShape = false;
  (function detectAnimatedLoaderShape() {
    try {
      const all = Array.from(document.querySelectorAll('div, span, svg'));
      for (const el of all) {
        if (!isVisible(el)) continue;
        if (el.childElementCount > 0) continue;
        const cs = getComputedStyle(el);
        const hasAnim =
          (cs.animationName && cs.animationName !== 'none') ||
          (cs.animationDuration && cs.animationDuration !== '0s');
        if (!hasAnim) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width >= 12 && rect.width <= 160 && rect.height >= 12 && rect.height <= 160) {
          hasAnimatedShape = true;
          break;
        }
      }
    } catch (_) {}
  })();

  let interactiveEls = deepQueryAll(
    'button, [role="button"], a[href], [role="radio"], [role="option"], [role="tab"], [role="checkbox"], [role="switch"], input[type="submit"], input[type="button"], input[type="radio"], input[type="checkbox"], label, summary, [data-testid], [data-cy], [onclick], [tabindex]'
  );
  // Fallback for quizzes that render answer cards as plain div/li/span
  // with JS handlers and no semantic role/button markup.
  if (interactiveEls.length === 0) {
    const pointerLike = deepQueryAll('div, li, span').filter((el) => {
      if (!isVisible(el)) return false;
      const txt = normalize(el.textContent || '');
      if (!txt || txt.length > 80) return false;
      if (BOILERPLATE_RE.test(txt)) return false;
      if (el.closest('header, nav, footer')) return false;
      const cs = getComputedStyle(el);
      if (cs.cursor === 'pointer') return true;
      // Common utility-style classes seen in quiz builders.
      const cls = ((el.getAttribute('class') || '') + '').toLowerCase();
      return (
        cls.indexOf('option') >= 0 ||
        cls.indexOf('answer') >= 0 ||
        cls.indexOf('choice') >= 0 ||
        cls.indexOf('radio') >= 0
      );
    });
    if (pointerLike.length > 0) {
      interactiveEls = pointerLike;
    }
  }

  const actions = [];
  const seen = new Set();
  let advanceCount = 0;
  let radioCount = 0;
  let checkboxCount = 0;
  let optionCount = 0;
  let buttonCount = 0;
  let linkCount = 0;
  const optionLabels = [];

  for (const el of interactiveEls) {
    const role = (el.getAttribute('role') || '').toLowerCase();
    const tag = el.tagName.toLowerCase();
    const rawText =
      el instanceof HTMLInputElement
        ? el.value || el.getAttribute('aria-label') || ''
        : el.textContent || el.getAttribute('aria-label') || '';
    const text = normalize(rawText);
    const href = (el.getAttribute('href') || '').toLowerCase();
    // Funnel builders (InLead, etc.) put the real checkout URL on data-href
    // while the visible <button> has no href — we must read it or the walker
    // never reaches checkout_end and spins on "branching" forever.
    const attrCheckoutUrl = (
      el.getAttribute('data-href') ||
      el.getAttribute('data-url') ||
      el.getAttribute('data-link') ||
      ''
    )
      .toString()
      .toLowerCase()
      .trim();
    // Visibility-first generally avoids hidden/template noise. But for
    // explicit payment URLs on CTA-like nodes (button/a with data-href/href),
    // keep the element even when hidden by platform gating styles, otherwise
    // the walker misses checkout_end and keeps capturing indefinitely.
    const preVisibilityHrefProvider =
      detectCheckoutHref(href) || detectCheckoutHref(attrCheckoutUrl);
    if (!isVisible(el) && !preVisibilityHrefProvider) continue;
    if (!text && !href && !attrCheckoutUrl) continue;
    if (text.length > 300) continue;

    if (
      BOILERPLATE_RE.test(text) ||
      BOILERPLATE_RE.test(href) ||
      BOILERPLATE_RE.test(attrCheckoutUrl)
    )
      continue;

    if (el instanceof HTMLInputElement && (el.type || '').toLowerCase() === 'checkbox') {
      // standalone hidden checkbox without wrapping label — skip; the wrapping
      // label or role=checkbox card will be picked up instead.
      continue;
    }
    if (el instanceof HTMLInputElement && (el.type || '').toLowerCase() === 'radio') {
      continue;
    }
    if (tag === 'label' && el.querySelector('label, button, [role="button"]')) continue;

    const actionId = el.getAttribute(ATTR) || undefined;
    const selector = actionId ? '[' + ATTR + '="' + actionId + '"]' : cssPathOf(el);
    if (!selector || seen.has(selector)) continue;
    seen.add(selector);

    const isRadioLike =
      role === 'radio' || role === 'option' || role === 'tab' ||
      (tag === 'label' && !!el.querySelector('input[type="radio"]'));
    const isCheckboxLike =
      role === 'checkbox' || role === 'switch' ||
      (tag === 'label' && !!el.querySelector('input[type="checkbox"]'));
    const isSubmit = (el instanceof HTMLButtonElement && el.type === 'submit');
    const isButton = tag === 'button' || role === 'button';
    const isLink = tag === 'a' && href && !href.startsWith('javascript:');
    const isInHeaderNav = !!el.closest('header, nav, footer');

    const isAdvance =
      !isRadioLike && !isCheckboxLike &&
      ADVANCE_TEXTS.some(s => text === s || text.endsWith(' ' + s) || text.startsWith(s + ' ') || text.includes(s));
    // Multi-signal checkout detection:
    //   1) Explicit buy/subscribe text in the visible label.
    //   2) Element href OR any href found on a descendant points to a known
    //      payment provider (Hotmart, Stripe, Kiwify, …) — catches CTAs
    //      whose label is just "Continuar" but actually leave the funnel.
    //   3) Form ancestor whose action targets a checkout provider — covers
    //      classic <form action="https://pay.hotmart.com/…"><button>Pagar</button></form>.
    var hrefProvider =
      detectCheckoutHref(href) || detectCheckoutHref(attrCheckoutUrl);
    if (!hrefProvider) {
      var inner = el.querySelector && el.querySelector('a[href]');
      if (inner) hrefProvider = detectCheckoutHref(inner.getAttribute('href') || '');
    }
    if (!hrefProvider && el.querySelector) {
      var innerData = el.querySelector('[data-href], [data-url], [data-link]');
      if (innerData) {
        var du =
          innerData.getAttribute('data-href') ||
          innerData.getAttribute('data-url') ||
          innerData.getAttribute('data-link') ||
          '';
        hrefProvider = detectCheckoutHref((du || '').toLowerCase());
      }
    }
    if (!hrefProvider) {
      var formAncestor = el.closest && el.closest('form[action]');
      if (formAncestor) hrefProvider = detectCheckoutHref(formAncestor.getAttribute('action') || '');
    }
    // Checkout signals, ranked by strength:
    //  1) hrefProvider    — payment provider URL (Hotmart/Stripe/...)
    //  2) isCheckoutByAttr — data-testid="button-checkout", id/class/name hints
    //  3) isCheckoutByStrongText — unambiguous buy/subscribe/claim verb
    //  4) isCheckoutByText — wide text match (secondary hint; NEVER stamps alone)
    var isCheckoutByStrongText =
      !!text && CHECKOUT_STRONG_TEXTS.some(function (s) { return text.includes(s); });
    var isCheckoutByText =
      !!text && CHECKOUT_TEXTS.some(function (s) { return text.includes(s); });
    var isCheckoutByAttr = detectCheckoutByAttr(el);
    // "isCheckoutCta" controls scoring/ranking within the page — a wide net
    // is fine here because the caller filters by the stronger booleans when
    // deciding step types or stamping markers.
    var isCheckoutCta =
      !!hrefProvider || isCheckoutByAttr || isCheckoutByStrongText || isCheckoutByText;
    // Only stamp "data-criaai-checkout" when we have a PROPERTY-level or
    // strong-text signal. A plain "Continuar" button on a screen whose
    // heading says "Qué incluye tu plan" does NOT deserve a checkout
    // marker — that's navigation, not a buy CTA. This rule is what keeps
    // the editor's Checkout tab from filling up with advance buttons.
    var shouldStamp = !!hrefProvider || isCheckoutByAttr || isCheckoutByStrongText;
    if (shouldStamp) {
      try {
        el.setAttribute(
          'data-criaai-checkout',
          hrefProvider || (isCheckoutByAttr ? 'attr-cta' : 'strong-text-cta'),
        );
      } catch (_) {}
    }

    let kind = 'option';
    let score = 50;
    if (isCheckoutCta) { kind = 'advance'; score = 1500 - text.length; }
    else if (isAdvance) { kind = 'advance'; score = 1000 - text.length; }
    else if (isSubmit) { kind = 'advance'; score = 800; }
    else if (isRadioLike) { kind = 'option'; score = 320; }
    else if (isCheckboxLike) { kind = 'option'; score = 260; }
    else if (isButton && rawText.length > 0 && rawText.length < 60 && !isInHeaderNav) {
      // Branching card without advance wording — counts as option.
      kind = 'option';
      score = 180;
    } else if (isLink) {
      kind = 'link';
      score = 80;
    }

    // Selected state
    let isSelected = false;
    if (el instanceof HTMLInputElement) isSelected = !!el.checked;
    else if (el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true') isSelected = true;
    else if (tag === 'label') {
      const inner = el.querySelector('input[type="radio"], input[type="checkbox"]');
      if (inner && inner.checked) isSelected = true;
    }

    if (kind === 'advance' && !isRadioLike && !isCheckboxLike) advanceCount += 1;
    if (isRadioLike) radioCount += 1;
    if (isCheckboxLike) checkboxCount += 1;
    if (kind === 'option') {
      optionCount += 1;
      const lbl = stripDigits(rawText).slice(0, 60);
      if (lbl) optionLabels.push(lbl);
    }
    if (isButton && !isAdvance && !isCheckoutCta) buttonCount += 1;
    if (isLink) linkCount += 1;

    actions.push({
      selector: selector,
      actionId: actionId,
      triggerText: (rawText || '').replace(/\\s+/g, ' ').trim().slice(0, 140),
      kind: kind,
      score: score,
      isAdvance: isAdvance || isCheckoutCta,
      isOption: kind === 'option',
      isCheckoutCta: isCheckoutCta,
      isCheckoutByHref: !!hrefProvider,
      isCheckoutByAttr: isCheckoutByAttr,
      isCheckoutByStrongText: isCheckoutByStrongText,
      checkoutProvider: hrefProvider || undefined,
      isRadioLike: isRadioLike,
      isCheckboxLike: isCheckboxLike,
      isSelected: isSelected,
    });
  }

  actions.sort((a, b) => b.score - a.score);

  // Step-type classification: look at what's visible on the page NOW.
  const interactiveCount = actions.length;
  const bodyText = (document.body && document.body.innerText || '').trim();
  const textLen = bodyText.length;
  // Presence of a visible text-like input the user still has to fill —
  // e-mail, phone, name, height, weight, DOB, etc. A screen with a pending
  // form input is a LEAD GATE, not a terminal checkout, even when its
  // submit button has buy-ish copy ("Reclamar meu plano", "Get my plan").
  const hasVisibleTextInput = (function () {
    try {
      var inputs = Array.from(document.querySelectorAll(
        'input:not([type]), input[type=""], input[type="text"], input[type="email"], input[type="tel"], input[type="number"], input[type="password"], input[type="date"], input[type="search"], input[type="url"], textarea'
      ));
      for (var i = 0; i < inputs.length; i += 1) {
        var inp = inputs[i];
        if (inp.disabled || inp.readOnly) continue;
        if (!isVisible(inp)) continue;
        // Skip hidden-but-rendered tokens (width < 20px).
        var r = inp.getBoundingClientRect();
        if (r.width < 20 || r.height < 8) continue;
        return true;
      }
      return false;
    } catch (_) { return false; }
  })();
  // A loader is present if ANY of the signals fire: class-based spinner, or
  // loading text keyword on a short page, or big animated shape with no
  // children. This makes the "Analisando suas respostas…" screen classify
  // as fake_loader even when the platform uses a custom CSS animation.
  const hasLoader = loaderCount > 0 || hasLoadingText || hasAnimatedShape;
  const hasQuestion = firstQuestionText().length >= 6;

  let stepType = 'generic';
  // If we detected loading text on a page with at most one interactive (often
  // a disabled "skip" or a back arrow), treat it as a fake loader. Purely-
  // class-based detection still requires zero interactives.
  if (interactiveCount === 0 && hasLoader) {
    stepType = 'fake_loader';
  } else if (interactiveCount <= 1 && (hasLoadingText || hasAnimatedShape) && !hasQuestion) {
    stepType = 'fake_loader';
  } else if (
    // PROPERTY-FIRST checkout detection. We only promote a screen to
    // checkout_end when we have property-level evidence (provider href
    // or explicit data-*/id/class attribute) OR an unambiguous buy verb
    // in the label. Plain "Continuar" buttons never reach this branch.
    //   (a) ANY action points at a known payment provider (Hotmart, Stripe…).
    //   (b) Attribute-tagged CTA (data-testid=button-checkout, id=buy, …)
    //       and no pending visible text input.
    //   (c) Unambiguous buy-verb copy (STRONG list only) and no input.
    //   (d) Multiple STRONG text matches on the same screen (pricing cards).
    actions.some((a) => a.isCheckoutByHref) ||
    (!hasVisibleTextInput && actions.some((a) => a.isCheckoutByAttr)) ||
    (!hasVisibleTextInput && actions.some((a) => a.isCheckoutByStrongText)) ||
    actions.filter((a) => a.isCheckoutByStrongText).length >= 2
  ) {
    stepType = 'checkout_end';
  } else if (radioCount >= 1 && advanceCount >= 1) {
    stepType = 'radio_then_continue';
  } else if (checkboxCount >= 1 && advanceCount >= 1) {
    stepType = 'checkbox_then_continue';
  } else if (advanceCount === 0 && optionCount >= 2) {
    stepType = 'branching';
  } else if (radioCount + checkboxCount === 0 && advanceCount >= 1 && optionCount >= 2) {
    // Multiple option cards + a continue button without explicit radio wiring:
    // treat as radio-style for walker purposes (select one then advance).
    stepType = 'radio_then_continue';
  }

  const question = firstQuestionText();

  // Iframe-as-source detection. Some funnels (Cakto, Hotmart-hosted
  // quizzes, Kiwify/Eduzz/Ticto/Monetizze widgets) embed the entire
  // experience inside an iframe whose src points at the producer's
  // domain. Cloning the parent gives an empty wrapper; the real quiz
  // lives in the iframe.
  const iframeQuizCandidates = (function () {
    var producerHosts = [
      'cakto', 'hotmart', 'kiwify', 'eduzz', 'ticto', 'monetizze', 'doppus',
      'perfectpay', 'pagar.me', 'lastlink', 'kirvano', 'yampi',
    ];
    var out = [];
    var seen = {};
    var iframes = Array.from(document.querySelectorAll('iframe[src]'));
    for (var i = 0; i < iframes.length; i += 1) {
      var iframe = iframes[i];
      if (!isVisible(iframe)) continue;
      var src = iframe.getAttribute('src') || '';
      if (!src || src.indexOf('http') !== 0) continue;
      var lower = src.toLowerCase();
      var matched = false;
      for (var j = 0; j < producerHosts.length; j += 1) {
        if (lower.indexOf(producerHosts[j]) >= 0) { matched = true; break; }
      }
      if (matched && !seen[src]) {
        seen[src] = true;
        out.push(src);
      }
    }
    return out;
  })();

  // Unsupported screen detector. Heuristic — only fires when the page
  // really looks unsalvageable so the walker can stop with a clear
  // error rather than spin forever.
  var unsupportedReason = '';
  (function detectUnsupportedScreen() {
    try {
      var canvases = Array.from(document.querySelectorAll('canvas'))
        .filter(isVisible);
      if (canvases.length > 0 && interactiveCount === 0) {
        var maxArea = 0;
        for (var i = 0; i < canvases.length; i += 1) {
          var rect = canvases[i].getBoundingClientRect();
          var area = rect.width * rect.height;
          if (area > maxArea) maxArea = area;
        }
        if (maxArea > 200000) {
          unsupportedReason = 'canvas_dominant_no_buttons';
          return;
        }
      }
      // Pointer-events:none on every clickable child of a swipe surface.
      // Surfaces with pointerdown/touchmove handlers and zero pointer-
      // accepting children mean the site relies on swipe gestures we
      // cannot dispatch reliably from Playwright's actionability model.
      var swipeCandidates = Array.from(document.querySelectorAll(
        '[data-swipe], [class*="swipe" i], [class*="carousel" i]'
      )).filter(isVisible);
      if (
        !actions.some(function (a) { return a.isCheckoutByHref; }) &&
        swipeCandidates.length > 0 &&
        interactiveCount > 0 &&
        actions.every(function (a) { return a.kind === 'link'; })
      ) {
        unsupportedReason = 'swipe_only';
      }
    } catch (_) { /* never break the snapshot */ }
  })();

  return {
    stepType: stepType,
    questionText: stripDigits(question),
    optionLabels: optionLabels,
    actions: actions,
    readiness: {
      interactiveCount: interactiveCount,
      textLen: textLen,
      hasLoader: hasLoader,
      hasQuestion: hasQuestion,
      domChildCount: document.body ? document.body.childElementCount : 0,
      loadingTextSample: loadingTextSample,
      hasAnimatedShape: hasAnimatedShape,
    },
    advanceButtonCount: advanceCount,
    radioCount: radioCount,
    checkboxCount: checkboxCount,
    optionCount: optionCount,
    buttonCount: buttonCount,
    linkCount: linkCount,
    loaderCount: loaderCount,
    pathname: location.pathname || '',
    hasVisibleTextInput: hasVisibleTextInput,
    bodyTextSample: (bodyText || '').slice(0, 4000),
    iframeQuizCandidates: iframeQuizCandidates,
    unsupportedReason: unsupportedReason || undefined,
  };
})()
`;
