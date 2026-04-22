import { CRIAAI_ID_ATTR } from './stable-id.util';

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
  const CHECKOUT_TEXTS = [
    'comprar','comprar ahora','buy','buy now','purchase','checkout','finalizar compra',
    'confirmar compra','pagar','pay','subscribe','subscribir','assinar','get my plan',
    'get plan','meu plano','my plan','ver mi plan','my results','ver mis resultados',
    'meu resultado','ver resultado','unlock plan','desbloquear plan','start plan',
    'começar plano','claim','reservar','garantir','quiero comprar','quero comprar',
  ];
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

  const loaderCount = Array.from(document.querySelectorAll(
    '[class*="loader" i], [class*="spinner" i], [class*="skeleton" i], [class*="shimmer" i], [class*="placeholder" i], [aria-busy="true"], [role="progressbar"], progress'
  )).filter(isVisible).length;

  const interactiveEls = Array.from(document.querySelectorAll(
    'button, [role="button"], a[href], [role="radio"], [role="option"], [role="tab"], [role="checkbox"], [role="switch"], input[type="submit"], input[type="button"], input[type="radio"], input[type="checkbox"], label, summary, [data-testid], [data-cy]'
  ));

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
    if (!isVisible(el)) continue;
    const role = (el.getAttribute('role') || '').toLowerCase();
    const tag = el.tagName.toLowerCase();
    const rawText =
      el instanceof HTMLInputElement
        ? el.value || el.getAttribute('aria-label') || ''
        : el.textContent || el.getAttribute('aria-label') || '';
    const text = normalize(rawText);
    const href = (el.getAttribute('href') || '').toLowerCase();
    if (!text && !href) continue;
    if (text.length > 300) continue;

    if (BOILERPLATE_RE.test(text) || BOILERPLATE_RE.test(href)) continue;

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
    const isCheckoutCta = CHECKOUT_TEXTS.some(s => text.includes(s));

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
  const hasLoader = loaderCount > 0;
  const hasQuestion = firstQuestionText().length >= 6;

  let stepType = 'generic';
  if (interactiveCount === 0 && hasLoader) {
    stepType = 'fake_loader';
  } else if (
    actions.some((a) => a.isCheckoutCta) &&
    actions.filter((a) => a.isOption).length <= 1
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
    },
    advanceButtonCount: advanceCount,
    radioCount: radioCount,
    checkboxCount: checkboxCount,
    optionCount: optionCount,
    buttonCount: buttonCount,
    linkCount: linkCount,
    loaderCount: loaderCount,
    pathname: location.pathname || '',
  };
})()
`;
