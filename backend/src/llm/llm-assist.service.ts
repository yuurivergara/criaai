import { Injectable, Logger } from '@nestjs/common';
import { OllamaLlmProvider } from './providers/ollama-llm.provider';

/**
 * Possible semantic roles for a clickable element inside a cloned funnel.
 *
 * - `checkout`: leads to payment / product checkout (external) — should become
 *   a customizable anchor.
 * - `advance`: moves the quiz one step forward (e.g., "Continue", "Next").
 * - `option`: a selectable choice inside a question (e.g., radio card).
 * - `nav`: internal navigation / menu / back / skip / auth.
 * - `unknown`: model was not confident enough.
 */
export type ButtonKind = 'checkout' | 'advance' | 'option' | 'nav' | 'unknown';

export interface ButtonClassification {
  kind: ButtonKind;
  confidence: number;
  reason?: string;
}

export interface ButtonClassifyInput {
  text: string;
  tag: string;
  href?: string;
  ariaLabel?: string;
  surroundingHeading?: string;
  pageContext?: string;
}

export interface QuizGapSuggestion {
  fromStepId: string;
  suggestedActionText: string;
  reason: string;
}

export interface GateFieldContext {
  /** CSS selector used to find the input/select/textarea. */
  selector: string;
  /** input | select | textarea. */
  tag: string;
  /** type attribute of the element (text|number|email...). */
  type: string;
  /** name|id|data-testid — helps the LLM identify the field semantically. */
  idLabel: string;
  /** Nearby label/heading/placeholder describing the question. */
  questionText: string;
}

export interface GateFieldAnswer {
  selector: string;
  value: string;
}

/**
 * Possible roles for a full quiz screen, as decided by the LLM arbiter.
 *
 *  - `lead_gate`: collects data (email, phone, name, age…) before moving on.
 *     The primary CTA is NOT a checkout even if its copy says "Get my plan".
 *  - `checkout_end`: the user is one click away from payment — either a
 *     gateway-hosted checkout or the sales page's "BUY NOW" button. Walker
 *     should stop and surface the button for the user to point at their own
 *     checkout URL.
 *  - `branching`: multiple option-cards, each leads to a different sub-flow
 *     (e.g. "men" vs "women"). Walker should fork and explore every branch.
 *  - `radio_then_continue` / `checkbox_then_continue`: question with choices
 *     plus a continue button.
 *  - `generic`: normal quiz step (non-branching, non-form, non-terminal).
 *  - `fake_loader`: transient "calculating…" screen. Walker should wait.
 */
export type QuizScreenKind =
  | 'lead_gate'
  | 'checkout_end'
  | 'branching'
  | 'radio_then_continue'
  | 'checkbox_then_continue'
  | 'generic'
  | 'fake_loader';

export interface QuizScreenActionHint {
  /** Stable id (data-criaai-id) of a button/link on the screen. */
  actionId?: string;
  /** CSS selector; always provided. */
  selector: string;
  /** Visible text — what the user would read on the button. */
  triggerText: string;
  /** What the fast heuristic thinks it is. */
  probeKind: 'advance' | 'option' | 'link';
  /** True when the probe already thinks this element is a checkout CTA. */
  probeIsCheckoutCta: boolean;
  /** True when the probe matched by attribute (data-testid=button-checkout, …). */
  probeIsCheckoutByAttr: boolean;
  /** True when the probe matched by a known payment provider href. */
  probeIsCheckoutByHref: boolean;
  /**
   * True when the label itself is an unambiguous buy verb ("OBTENER MI
   * PLAN", "BUY NOW", "COMPRAR AGORA", etc). Strong enough to stand on
   * its own but NOT as strong as href/attr signals.
   */
  probeIsCheckoutByStrongText?: boolean;
  /** Matched provider name if any (hotmart, stripe, …). */
  provider?: string;
}

export interface QuizScreenInput {
  /** URL of the current screen — helps the model understand position in funnel. */
  url: string;
  /** Fingerprint/signature the walker uses — used ONLY as cache key. */
  signature: string;
  /** Step type the heuristic probe came up with. */
  probeStepType:
    | 'radio_then_continue'
    | 'checkbox_then_continue'
    | 'branching'
    | 'fake_loader'
    | 'checkout_end'
    | 'generic';
  /** Primary heading / question text, if any. */
  questionText: string;
  /** Up to ~4000 chars of visible body text. */
  bodyText: string;
  /** All clickable actions captured on the screen (ranked). */
  actions: QuizScreenActionHint[];
  /** True when a text-like input still needs to be filled in. */
  hasVisibleTextInput: boolean;
  /** True when any action targets a known payment provider href. */
  hasProviderHref: boolean;
}

export interface QuizScreenVerdict {
  kind: QuizScreenKind;
  confidence: number;
  /** actionId of the button the walker should treat as the real checkout. */
  checkoutActionIds?: string[];
  /** actionIds that should be explored as forks (branching). */
  branchActionIds?: string[];
  /** Short explanation (for logs). */
  reason?: string;
}

/**
 * High-level LLM helpers dedicated to the page-clone pipeline.
 *
 * Every method is resilient:
 *   1. It first tries deterministic rules (cheap, zero-latency, works offline).
 *   2. If the rules are inconclusive AND Ollama is reachable, it falls back to
 *      Ollama in JSON mode for a structured answer.
 *   3. If Ollama is unreachable, it returns the best deterministic guess.
 *
 * Nothing blocks or fails — the clone pipeline always gets an answer.
 */
@Injectable()
export class LlmAssistService {
  private readonly logger = new Logger(LlmAssistService.name);

  /**
   * Cache for `resolveFormGate`. Keyed by the browser-side gate signature
   * (FNV-1a of all field labels + question text). This lives for the whole
   * Node process lifetime — the clone pipeline is short-lived in practice
   * and re-hitting the same gate inside a single walk (across forks) is the
   * common case we want to cheapen.
   */
  private readonly gateCache = new Map<string, GateFieldAnswer[]>();

  /**
   * Cache for `isTransientLoadingScreen` verdicts. Keyed by an FNV-1a hash
   * of the page's visible text + host — the same "Analisando suas
   * respostas…" screen across walker forks is decided ONCE.
   */
  private readonly transientScreenCache = new Map<string, boolean>();

  /**
   * Cache for `classifyQuizScreen` verdicts. Keyed by the snapshot fingerprint
   * (path + stepType + hashes) + buttons — deterministic and cheap to compute.
   */
  private readonly screenVerdictCache = new Map<string, QuizScreenVerdict>();

  constructor(private readonly ollama: OllamaLlmProvider) {}

  /**
   * Classify a button-like element as checkout / advance / option / nav.
   */
  async classifyButton(
    input: ButtonClassifyInput,
  ): Promise<ButtonClassification> {
    const fast = this.classifyButtonFast(input);
    if (fast.confidence >= 0.9) return fast;

    if (!(await this.ollama.isReachable())) return fast;

    try {
      const prompt = [
        'You classify a single button/link inside a cloned quiz or sales funnel.',
        'Respond with JSON only: {"kind":"checkout|advance|option|nav|unknown","confidence":0..1,"reason":"short"}.',
        'Definitions:',
        '- checkout: goes to a paid product / payment gateway (external).',
        '- advance: moves quiz forward ("Continue","Next","Submit", etc).',
        '- option: is a user choice inside a question (radio/card).',
        '- nav: internal navigation / menu / login / back.',
        `Input: ${JSON.stringify({
          text: input.text?.slice(0, 200) ?? '',
          tag: input.tag,
          href: input.href?.slice(0, 200) ?? '',
          ariaLabel: input.ariaLabel?.slice(0, 120) ?? '',
          surroundingHeading: input.surroundingHeading?.slice(0, 160) ?? '',
          pageContext: input.pageContext?.slice(0, 400) ?? '',
        })}`,
      ].join('\n');

      const raw = await this.ollama.chat({
        messages: [
          {
            role: 'system',
            content:
              'You are a funnel-classification assistant. Only respond with valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        jsonMode: true,
        timeoutMs: 8000,
      });
      const parsed = this.safeParseClassification(raw);
      if (parsed) return parsed;
      return fast;
    } catch (err) {
      this.logger.debug(
        `classifyButton ollama fallback: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      return fast;
    }
  }

  /**
   * Deterministic classifier — uses keyword lists + heuristics.
   *
   * Mirrors the keyword lists already used elsewhere in the pipeline, kept
   * centralized here so the LLM layer and the regex layer stay in sync.
   */
  classifyButtonFast(input: ButtonClassifyInput): ButtonClassification {
    const text = this.normalize(`${input.text ?? ''} ${input.ariaLabel ?? ''}`);
    const href = (input.href ?? '').toLowerCase().trim();

    if (!text && !href) {
      return { kind: 'unknown', confidence: 0.2 };
    }

    const externalHttp = /^https?:\/\//i.test(href);
    const isCheckoutDomain =
      externalHttp &&
      /(hotmart|kiwify|monetizze|eduzz|perfectpay|ticto|braip|yampi|cartpanda|pagarme|pagseguro|mercadopago|stripe\.com|buy\.stripe\.com|paypal\.com|myshopify|clickbank|go\.hyros|utmify\.com|\/checkout|\/cart(\/|\?|$)|\/obrigado|\/thank-?you)/i.test(
        href,
      );

    if (isCheckoutDomain) {
      return { kind: 'checkout', confidence: 0.98, reason: 'known gateway' };
    }

    const ADVANCE = [
      'continuar',
      'continue',
      'next',
      'proximo',
      'siguiente',
      'avancar',
      'avanzar',
      'submit',
      'enviar',
      'comecar',
      'empezar',
      'start',
      'begin',
      'finalizar',
      'concluir',
      'finish',
      'ok',
      'aceitar',
      'aceptar',
      'i agree',
      'concordo',
      'ver resultado',
      'ver plano',
    ];
    const NAV = [
      'login',
      'sign in',
      'entrar',
      'acessar',
      'voltar',
      'back',
      'previous',
      'anterior',
      'volver',
      'cancelar',
      'cancel',
      'fechar',
      'close',
      'pular',
      'skip',
      'menu',
    ];
    const CHECKOUT_TEXT = [
      'comprar',
      'quero comprar',
      'quero garantir',
      'garantir',
      'adquirir',
      'assinar',
      'assine',
      'finalizar compra',
      'ir para o checkout',
      'buy now',
      'order now',
      'add to cart',
      'checkout',
      'get access',
      'get instant access',
      'claim your',
      'subscribe',
      'enroll',
      'comprar ahora',
      'quiero comprar',
      'get my plan',
      'get plan',
      'meu plano',
      'get started',
    ];

    if (
      ADVANCE.some((k) => text === k || text.includes(k)) &&
      !CHECKOUT_TEXT.some((k) => text.includes(k))
    ) {
      return { kind: 'advance', confidence: 0.9, reason: 'advance keyword' };
    }
    if (NAV.some((k) => text === k || text.startsWith(k + ' '))) {
      return { kind: 'nav', confidence: 0.88, reason: 'nav keyword' };
    }
    if (CHECKOUT_TEXT.some((k) => text.includes(k))) {
      return {
        kind: 'checkout',
        confidence: externalHttp ? 0.85 : 0.75,
        reason: 'checkout keyword',
      };
    }

    if (
      input.tag === 'input' ||
      input.tag === 'label' ||
      input.surroundingHeading
    ) {
      if (text.length > 0 && text.length <= 80 && !externalHttp) {
        return {
          kind: 'option',
          confidence: 0.6,
          reason: 'short label inside form',
        };
      }
    }

    if (text.length > 0 && text.length <= 60 && !externalHttp) {
      return {
        kind: 'option',
        confidence: 0.5,
        reason: 'short internal click target',
      };
    }

    if (externalHttp) {
      return {
        kind: 'nav',
        confidence: 0.4,
        reason: 'external link (no keywords)',
      };
    }
    return { kind: 'unknown', confidence: 0.3 };
  }

  /**
   * Given the list of (title, visible-text) tuples captured from a walk,
   * asks the LLM whether the quiz probably ended or whether steps seem to
   * be missing. Returns `null` when the LLM is unreachable.
   */
  async findQuizGaps(
    states: Array<{ stepId: string; title: string; visibleText: string }>,
  ): Promise<QuizGapSuggestion[] | null> {
    if (!states.length) return [];
    if (!(await this.ollama.isReachable())) return null;

    try {
      const payload = states.map((s) => ({
        stepId: s.stepId,
        title: s.title.slice(0, 120),
        text: s.visibleText.slice(0, 400),
      }));
      const prompt = [
        'You audit the capture of a multi-step quiz.',
        'Given the list of captured states (in walk order), respond with JSON:',
        '{"gaps":[{"fromStepId":"<id>","suggestedActionText":"<button text to click>","reason":"why"}]}',
        'Only list gaps if there is clear evidence a middle step is missing (e.g. answer page without a results page, payment page without confirmation).',
        'Return empty "gaps":[] if the capture looks complete.',
        `States: ${JSON.stringify(payload)}`,
      ].join('\n');

      const raw = await this.ollama.chat({
        messages: [
          {
            role: 'system',
            content: 'You only output valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        jsonMode: true,
        timeoutMs: 12_000,
      });
      const parsed = JSON.parse(raw) as { gaps?: unknown[] };
      if (!parsed || !Array.isArray(parsed.gaps)) return [];
      return parsed.gaps
        .map((g): QuizGapSuggestion | null => {
          if (!g || typeof g !== 'object') return null;
          const entry = g as Record<string, unknown>;
          if (
            typeof entry.fromStepId !== 'string' ||
            typeof entry.suggestedActionText !== 'string'
          )
            return null;
          return {
            fromStepId: entry.fromStepId,
            suggestedActionText: entry.suggestedActionText,
            reason:
              typeof entry.reason === 'string' ? entry.reason : 'LLM hint',
          };
        })
        .filter((x): x is QuizGapSuggestion => x !== null);
    } catch (err) {
      this.logger.debug(
        `findQuizGaps failed: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      return null;
    }
  }

  /**
   * Resolve a "form gate" where the deterministic heuristic could not find
   * a sensible value for every unfilled field. Returns the selectors paired
   * with the value the LLM thinks makes sense so the walker can fill them.
   *
   * Results are cached by `gateSignature` — the same gate on a different
   * walker/fork does NOT trigger another LLM roundtrip.
   *
   * Returns an empty array when Ollama is unreachable or the response is
   * malformed. The walker is expected to degrade gracefully in that case.
   */
  async resolveFormGate(
    gateSignature: string,
    fields: GateFieldContext[],
    questionHeading = '',
  ): Promise<GateFieldAnswer[]> {
    if (!fields.length) return [];
    const cached = this.gateCache.get(gateSignature);
    if (cached) return cached;
    if (!(await this.ollama.isReachable())) return [];

    try {
      const payload = fields.slice(0, 12).map((f) => ({
        selector: f.selector,
        tag: f.tag,
        type: f.type,
        id: f.idLabel.slice(0, 80),
        question: f.questionText.slice(0, 240),
      }));
      const prompt = [
        'You are assisting a quiz cloner. The quiz has a "Continue" button that is DISABLED until the fields below are filled with values that pass strict client-side validation.',
        'Return JSON only: {"fields":[{"selector":"<copied from input>","value":"<string to type>"}]}.',
        'Rules (MUST pass strict HTML5 + custom JS validators):',
        '- Email: must use a REAL public domain. Prefer "criaai.tester@gmail.com". NEVER use .local, .test, .example, .invalid TLDs.',
        '- Phone: Brazilian mobile, 11 digits, no country code, no spaces: "11987654321". If the field clearly expects international format, use "+5511987654321".',
        '- CPF/DNI/tax ID: use "52998224725" (valid BR modulo-11 CPF). Zeros like "00000000000" fail most validators — do NOT use them.',
        '- CEP/ZIP (Brazil): "01310100" (Av. Paulista). US ZIP: "10001".',
        '- Age: 30. Height: 170 (cm) or 67 (in). Weight: 70 (kg) or 154 (lb).',
        '- Respect the apparent unit (cm vs in, kg vs lb) from question/label text.',
        '- Name: "Maria Silva". City: "São Paulo".',
        '- Date of birth: "2000-01-01" (ISO). If the input uses dd/mm/yyyy, format accordingly.',
        '- For selects, pick the FIRST non-placeholder option value (if unclear, guess a common value).',
        '- Never output empty strings. Never output code or explanations.',
        '- If the button was still disabled AFTER a first attempt, assume the previous default was rejected — pick a different, stricter-safe value.',
        `Question heading: ${questionHeading.slice(0, 240)}`,
        `Fields: ${JSON.stringify(payload)}`,
      ].join('\n');

      const raw = await this.ollama.chat({
        messages: [
          {
            role: 'system',
            content:
              'You only output valid JSON that matches the requested schema.',
          },
          { role: 'user', content: prompt },
        ],
        jsonMode: true,
        // Hard cap aligned with the plan: gate resolution runs on the hot
        // path of every quiz step. 8s is enough for a small local model
        // to answer a single-shot prompt; longer waits eat the entire
        // step budget.
        timeoutMs: 8000,
      });
      const answers = this.safeParseGateFields(raw);
      if (answers.length) {
        this.gateCache.set(gateSignature, answers);
      }
      return answers;
    } catch (err) {
      this.logger.debug(
        `resolveFormGate failed: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      return [];
    }
  }

  /**
   * LAST-LINE fallback for loader detection.
   *
   * The walker already detects loading screens via (a) CSS class patterns,
   * (b) multilingual keyword matching in the body text, and (c) small
   * animated shapes. Exotic cases still slip through: custom GIF loaders,
   * Lottie animations with no CSS signals, or quirky phrases not covered
   * by the keyword list.
   *
   * This method asks the LLM to decide: given a tiny snippet of the
   * page, is it a transient "we're calculating / analyzing / preparing"
   * screen, or a real quiz step that the walker should capture?
   *
   * The verdict is cached by content hash — re-visiting the same loader
   * across walker forks costs zero tokens after the first call.
   *
   * Returns `null` when Ollama is unreachable so the caller can fall back
   * to the safe default (assume NOT transient, i.e. accept the state).
   */
  async isTransientLoadingScreen(
    bodyText: string,
    visibleButtons: string[],
    hasAnyQuestion: boolean,
  ): Promise<boolean | null> {
    const trimmedText = (bodyText || '').trim();
    // FNV-1a hash of (text + buttons) for a cheap cache key.
    const digest = ((): string => {
      const seed = `${trimmedText.slice(0, 2000)}§${visibleButtons.join('|')}`;
      let h = 2166136261;
      for (let i = 0; i < seed.length; i += 1) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      return `t${h.toString(16)}`;
    })();
    const cached = this.transientScreenCache.get(digest);
    if (cached !== undefined) return cached;

    if (!(await this.ollama.isReachable())) return null;

    try {
      const prompt = [
        'You audit ONE screen of a multi-step quiz while it is being cloned.',
        'The walker just clicked "Continue" and needs to know: is the screen it sees now a TRANSIENT loader (a screen that will auto-advance after a few seconds, like "Analyzing your answers…", "Creating your plan…", or an animated progress screen), or is it a REAL step with content the user must read/interact with?',
        'Loaders ALWAYS auto-advance; real steps always require user input (a question, a decision, a CTA).',
        'Respond with JSON only: {"transient": true|false, "confidence": 0..1, "reason": "short"}.',
        'If clearly a real step (has a question, multiple choices, or a paid CTA), say transient=false.',
        'If the screen is waiting/processing/personalizing with minimal interactivity, say transient=true.',
        'If unsure, prefer transient=false (do not skip real content).',
        `Input: ${JSON.stringify({
          text: trimmedText.slice(0, 900),
          buttons: visibleButtons.slice(0, 8).map((b) => b.slice(0, 60)),
          hasQuestion: hasAnyQuestion,
        })}`,
      ].join('\n');

      const raw = await this.ollama.chat({
        messages: [
          {
            role: 'system',
            content: 'You only output valid JSON.',
          },
          { role: 'user', content: prompt },
        ],
        jsonMode: true,
        timeoutMs: 8000,
        temperature: 0,
      });
      const parsed = JSON.parse(raw) as { transient?: unknown };
      const verdict =
        parsed &&
        typeof parsed === 'object' &&
        typeof parsed.transient === 'boolean'
          ? parsed.transient
          : null;
      if (verdict === null) return null;
      this.transientScreenCache.set(digest, verdict);
      return verdict;
    } catch (err) {
      this.logger.debug(
        `isTransientLoadingScreen failed: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      return null;
    }
  }

  /**
   * Decide the semantic role of a full quiz screen in a **language-agnostic**
   * way. Replaces the previous keyword-only classification when the Ollama
   * backend is reachable.
   *
   * Three layers, same pattern as the rest of this service:
   *   1. Deterministic short-circuits (provider-href, attribute-checkout with
   *      no form input, etc.) — zero latency, zero tokens.
   *   2. Cache by fingerprint/signature — same screen across forks is decided
   *      once.
   *   3. Ollama arbitration for ambiguous cases — understands the full
   *      semantic picture (copy in any language, layout hints, action
   *      affordances) and points the walker at the true checkout button.
   *
   * The function NEVER blocks cloning: if the LLM is unreachable or returns
   * garbage, the best deterministic guess is returned instead.
   */
  async classifyQuizScreen(input: QuizScreenInput): Promise<QuizScreenVerdict> {
    const cached = this.screenVerdictCache.get(input.signature);
    if (cached) return cached;

    // Fast deterministic short-circuits — trust the browser probe on the
    // strongest signals so we don't spend a token on obvious cases.
    const fast = this.classifyQuizScreenFast(input);
    if (fast.confidence >= 0.95) {
      this.screenVerdictCache.set(input.signature, fast);
      return fast;
    }

    if (!(await this.ollama.isReachable())) {
      return fast;
    }

    try {
      const payloadActions = input.actions.slice(0, 18).map((a) => ({
        id: a.actionId ?? a.selector.slice(0, 80),
        text: (a.triggerText ?? '').slice(0, 140),
        probeKind: a.probeKind,
        probeCheckout: a.probeIsCheckoutCta,
        probeCheckoutByAttr: a.probeIsCheckoutByAttr,
        probeCheckoutByHref: a.probeIsCheckoutByHref,
        probeCheckoutByStrongText: !!a.probeIsCheckoutByStrongText,
        provider: a.provider ?? null,
      }));
      const prompt = [
        'You analyze ONE screen of a multi-step sales/quiz funnel being cloned.',
        'Your job: decide what this screen IS and (if relevant) which button is the REAL checkout — the one that would charge the user or take them to a payment gateway.',
        'Respond with JSON only, no prose, matching the schema:',
        '{"kind":"lead_gate|checkout_end|branching|radio_then_continue|checkbox_then_continue|generic|fake_loader",',
        ' "confidence":0..1,',
        ' "checkoutActionIds":["<id>", ...],',
        ' "branchActionIds":["<id>", ...],',
        ' "reason":"<=120 chars"}',
        '',
        'Definitions:',
        '- lead_gate: the user must FIRST type information (email/phone/name/etc.) before anything happens. The submit button is NOT checkout, even if its copy is "Reclamar mi plan" / "Get my plan" / "Claim". Set kind=lead_gate and checkoutActionIds=[] in this case.',
        '- checkout_end: the next click sends the user to pay. This is the LAST real step.',
        '- branching: 2+ buttons that LOOK like distinct paths ("Men" vs "Women", "Plan A" vs "Plan B" where plans are visual cards not pricing, …). Put all such button ids in branchActionIds.',
        '- radio_then_continue / checkbox_then_continue: a question with multiple choices AND a separate Continue button.',
        '- generic: any other quiz step — mid-funnel results, testimonials, upsell screens, "Your plan includes…" informational pages.',
        '- fake_loader: "Analyzing your answers…", spinner, auto-advancing screen with no real user input.',
        '',
        '### PROPERTY-FIRST RULE (critical)',
        'Identify the checkout button from the ELEMENT PROPERTIES first, the visible TEXT second.',
        '1. A button is the checkout ONLY if ONE of these is true:',
        '     - `probeCheckoutByHref=true` (a known payment provider URL), OR',
        '     - `probeCheckoutByAttr=true` (data-testid / id / class / aria-label explicitly names buy/checkout/purchase), OR',
        '     - `probeCheckoutByStrongText=true` (label is an unambiguous buy verb).',
        '2. If NO action on the screen has any of these three flags, the screen is NOT checkout_end. Return "generic" (or "radio_then_continue" / "lead_gate" / …) and checkoutActionIds=[].',
        '3. Even if the heading mentions "plan", "plano", "results", "your no.Diet plan" — a generic "Continue/Continuar/Next" button without one of the three flags is NEVER a checkout. Those are mid-funnel results pages.',
        '4. If the screen has a visible text input (hasVisibleTextInput=true) AND there is no provider href, it is almost always a lead_gate, NOT checkout_end, regardless of button copy.',
        '5. checkoutActionIds MUST only contain ids that appear in the actions list above AND have at least one of the three property flags set to true.',
        '',
        `Input: ${JSON.stringify({
          url: (input.url || '').slice(0, 240),
          probeStepType: input.probeStepType,
          hasVisibleTextInput: input.hasVisibleTextInput,
          hasProviderHref: input.hasProviderHref,
          question: (input.questionText || '').slice(0, 240),
          bodyPreview: (input.bodyText || '').slice(0, 1600),
          actions: payloadActions,
        })}`,
      ].join('\n');

      const raw = await this.ollama.chat({
        messages: [
          {
            role: 'system',
            content:
              'You are a funnel-classification assistant. You only output valid JSON matching the requested schema.',
          },
          { role: 'user', content: prompt },
        ],
        jsonMode: true,
        // Tightened from 9s → 4s. classifyQuizScreen runs on every step
        // (including unambiguous ones that already short-circuit fast)
        // so its tail latency directly grows the per-step budget. The
        // deterministic fallback in `classifyQuizScreenFast` handles
        // every aborted call gracefully.
        timeoutMs: 4000,
        temperature: 0,
      });

      const parsed = this.safeParseScreenVerdict(raw, input);
      if (parsed) {
        this.screenVerdictCache.set(input.signature, parsed);
        return parsed;
      }
      return fast;
    } catch (err) {
      this.logger.debug(
        `classifyQuizScreen ollama fallback: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      return fast;
    }
  }

  /**
   * Deterministic short-circuit for the screen classifier. Returns a verdict
   * with high confidence (≥ 0.95) only for cases we are sure about; ambiguous
   * cases fall through to the LLM.
   */
  private classifyQuizScreenFast(input: QuizScreenInput): QuizScreenVerdict {
    const providerActions = input.actions.filter(
      (a) => a.probeIsCheckoutByHref,
    );
    const attrActions = input.actions.filter((a) => a.probeIsCheckoutByAttr);
    const strongTextActions = input.actions.filter(
      (a) => a.probeIsCheckoutByStrongText,
    );
    const hasAnyProperty =
      providerActions.length > 0 ||
      attrActions.length > 0 ||
      strongTextActions.length > 0;

    // (A) Strongest possible signal: a payment-provider href is present.
    //     Terminal screen regardless of anything else.
    if (providerActions.length > 0) {
      return {
        kind: 'checkout_end',
        confidence: 0.98,
        checkoutActionIds: providerActions.map((a) => a.actionId ?? a.selector),
        reason: 'payment-provider href detected',
      };
    }

    // (B) Attribute-tagged checkout (data-testid=button-checkout, id="buy",
    //     class containing "checkout", …) with NO pending form input —
    //     explicit author intent, language-independent.
    if (attrActions.length > 0 && !input.hasVisibleTextInput) {
      return {
        kind: 'checkout_end',
        confidence: 0.96,
        checkoutActionIds: attrActions.map((a) => a.actionId ?? a.selector),
        reason: 'attribute-tagged checkout (no form input)',
      };
    }

    // (C) No property-level evidence at all. This is NOT checkout_end — no
    //     matter what the probe or the copy hints at. We return with high
    //     confidence so the LLM is not even consulted: a screen whose ONLY
    //     checkout signal is copy like "Qué incluye tu plan" + a plain
    //     "Continuar" button is not terminal. Let the heuristic step type
    //     drive exploration.
    if (!hasAnyProperty) {
      const safeKind: QuizScreenKind =
        input.probeStepType === 'checkout_end'
          ? 'generic'
          : (input.probeStepType as QuizScreenKind);
      if (input.hasVisibleTextInput) {
        return {
          kind: 'lead_gate',
          confidence: 0.95,
          checkoutActionIds: [],
          reason: 'visible text input + no property-level checkout signal',
        };
      }
      if (input.probeStepType === 'fake_loader') {
        return {
          kind: 'fake_loader',
          confidence: 0.95,
          reason: 'probe fake_loader',
        };
      }
      return {
        kind: safeKind,
        confidence: 0.95,
        checkoutActionIds: [],
        reason: 'no property-level checkout signal on screen',
      };
    }

    // (D) Probe says fake_loader — trust even when there is a property
    //     signal (rare; a transient page might still load a provider SDK).
    if (input.probeStepType === 'fake_loader') {
      return {
        kind: 'fake_loader',
        confidence: 0.95,
        reason: 'probe fake_loader',
      };
    }

    // (E) Ambiguous: we have a strong-text CTA but also a visible input, or
    //     exactly one attr CTA with a visible input. Defer to the LLM.
    const probeCandidates = [
      ...providerActions,
      ...attrActions,
      ...strongTextActions,
    ];
    return {
      kind: (input.probeStepType === 'checkout_end'
        ? 'checkout_end'
        : input.probeStepType) as QuizScreenKind,
      confidence: 0.55,
      checkoutActionIds: probeCandidates.map((a) => a.actionId ?? a.selector),
      reason: 'property signal present but ambiguous — LLM arbitration',
    };
  }

  private safeParseScreenVerdict(
    raw: string,
    input: QuizScreenInput,
  ): QuizScreenVerdict | null {
    try {
      const data = JSON.parse(raw) as Record<string, unknown>;
      const kindRaw = typeof data.kind === 'string' ? data.kind.trim() : '';
      const validKinds: QuizScreenKind[] = [
        'lead_gate',
        'checkout_end',
        'branching',
        'radio_then_continue',
        'checkbox_then_continue',
        'generic',
        'fake_loader',
      ];
      const kind = validKinds.includes(kindRaw as QuizScreenKind)
        ? (kindRaw as QuizScreenKind)
        : null;
      if (!kind) return null;
      const confidence =
        typeof data.confidence === 'number'
          ? Math.max(0, Math.min(1, data.confidence))
          : 0.6;
      const knownIds = new Set<string>();
      const propertyIds = new Set<string>();
      for (const a of input.actions) {
        const k = a.actionId ?? a.selector;
        knownIds.add(k);
        if (a.actionId) knownIds.add(a.actionId);
        knownIds.add(a.selector);
        if (
          a.probeIsCheckoutByHref ||
          a.probeIsCheckoutByAttr ||
          a.probeIsCheckoutByStrongText
        ) {
          if (a.actionId) propertyIds.add(a.actionId);
          propertyIds.add(a.selector);
          propertyIds.add(k);
        }
      }
      const toList = (v: unknown): string[] =>
        Array.isArray(v)
          ? v
              .map((x) => (typeof x === 'string' ? x.trim() : ''))
              .filter((x) => x && knownIds.has(x))
          : [];
      // Filter LLM-returned checkoutActionIds down to ids that actually
      // carry a property-level signal. This is the "LLM can pick from
      // candidates but can't invent one" guarantee.
      const rawCheckoutIds = toList(data.checkoutActionIds);
      const checkoutActionIds = rawCheckoutIds.filter((id) =>
        propertyIds.has(id),
      );
      const branchActionIds = toList(data.branchActionIds);
      // If the LLM said `checkout_end` but we dropped every id (no property
      // evidence on the screen), downgrade the verdict — see PROPERTY-FIRST
      // RULE in the prompt. Fall back to a generic step-type so the walker
      // keeps exploring.
      let effectiveKind: QuizScreenKind = kind;
      if (
        effectiveKind === 'checkout_end' &&
        rawCheckoutIds.length > 0 &&
        checkoutActionIds.length === 0
      ) {
        effectiveKind = input.hasVisibleTextInput ? 'lead_gate' : 'generic';
      }
      if (effectiveKind === 'checkout_end' && propertyIds.size === 0) {
        effectiveKind = input.hasVisibleTextInput ? 'lead_gate' : 'generic';
      }
      return {
        kind: effectiveKind,
        confidence,
        checkoutActionIds,
        branchActionIds,
        reason:
          typeof data.reason === 'string'
            ? data.reason.slice(0, 160)
            : 'LLM verdict',
      };
    } catch {
      return null;
    }
  }

  private safeParseGateFields(raw: string): GateFieldAnswer[] {
    try {
      const data = JSON.parse(raw) as { fields?: unknown };
      if (!data || !Array.isArray(data.fields)) return [];
      const out: GateFieldAnswer[] = [];
      for (const entry of data.fields) {
        if (!entry || typeof entry !== 'object') continue;
        const rec = entry as Record<string, unknown>;
        if (typeof rec.selector !== 'string' || !rec.selector.trim()) continue;
        // Reject non-primitive values — the LLM sometimes hallucinates
        // nested objects here ("value": { ... }) which would stringify to
        // "[object Object]" and get typed verbatim.
        const rawValue = rec.value;
        let value = '';
        if (typeof rawValue === 'string') value = rawValue;
        else if (typeof rawValue === 'number' || typeof rawValue === 'boolean')
          value = String(rawValue);
        value = value.slice(0, 200);
        if (!value) continue;
        out.push({ selector: rec.selector.trim(), value });
      }
      return out;
    } catch {
      return [];
    }
  }

  private safeParseClassification(raw: string): ButtonClassification | null {
    try {
      const data = JSON.parse(raw) as Partial<ButtonClassification>;
      const kind = data.kind;
      if (
        kind === 'checkout' ||
        kind === 'advance' ||
        kind === 'option' ||
        kind === 'nav' ||
        kind === 'unknown'
      ) {
        return {
          kind,
          confidence:
            typeof data.confidence === 'number' ? data.confidence : 0.5,
          reason: typeof data.reason === 'string' ? data.reason : undefined,
        };
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  /**
   * Rewrites a quiz step so JS-heavy drag rulers / fake sliders become a
   * plain `<input type="text">`, which survives editing and export better than
   * brittle SPA widgets inside our iframe.
   */
  async simplifyInteractiveWidgetsToPlainInputs(
    html: string,
  ): Promise<string | null> {
    if (!html || html.length < 120) return null;
    if (!(await this.ollama.isReachable())) return null;

    const maxChars = 48_000;
    const chunk =
      html.length > maxChars ? `${html.slice(0, maxChars)}\n<!-- truncated -->` : html;

    try {
      const prompt = [
        'You rewrite ONE HTML document captured from a quiz funnel.',
        'GOAL: Locate UI that looks like a drag ruler, fake horizontal slider, height/weight dial, or custom range control that requires JavaScript drag gestures.',
        'REPLACE only that interactive block with a polished, sales-ready block:',
        '- Wrapper: <div class="criaai-widget-plain-wrap criaai-widget-plain" data-criaai-replaced="llm-drag"> centered (margin:auto; max-width ~26rem), subtle gradient/peach card border — looks premium, NOT developer-meta.',
        '- Inside: short label (question-related), one <input type="text" inputmode="decimal" data-criaai-simple-input autocomplete="off" /> with placeholder showing units.',
        '- REQUIRED: add <button type="button" class="criaai-widget-continue-btn">Continuar</button> below the input (orange gradient pill, full-width max ~21rem). No technical disclaimers or text saying widgets were removed.',
        'RULES:',
        '- Preserve the document structure: <!DOCTYPE>, <html>, <head>, <body>, all <link>/<style>/<script> that you did not need to delete for the removed widget.',
        '- Keep the visible question heading(s) and copy ABOVE the widget.',
        '- If the original step already had a Continuar button visible outside the ruler, KEEP it — still add class="criaai-widget-continue-btn" duplicate only when no obvious advance button remains.',
        '- NEVER insert explanations like "removed ruler", "simplified field", or internal notes — end users must not see implementation commentary.',
        '- Keep footer buttons (Continuar / Next), option cards, and layout OUTSIDE the widget intact.',
        '- Do NOT strip every script globally — only remove nodes that belonged exclusively to the drag widget when unavoidable.',
        '- Add minimal scoped <style> for .criaai-widget-plain-wrap / label / input / .criaai-widget-continue-btn if missing (centered layout, readable typography).',
        '- Respond with JSON ONLY: {"html":"..." } where value is the FULL rewritten HTML string with quotes escaped properly.',
        html.length > maxChars
          ? `Input was truncated at ${maxChars} chars — close tags sensibly.`
          : '',
        'HTML:',
        chunk,
      ]
        .filter(Boolean)
        .join('\n');

      const raw = await this.ollama.chat({
        messages: [
          {
            role: 'system',
            content:
              'You respond with valid JSON only: {"html":"<full html>"}. No markdown fences.',
          },
          { role: 'user', content: prompt },
        ],
        jsonMode: true,
        temperature: 0.12,
        timeoutMs: 120_000,
      });
      const parsed = this.safeParseHtmlRewrite(raw);
      if (parsed && parsed.includes('<body') && parsed.length > 400) return parsed;
      if (parsed && parsed.includes('<') && parsed.length > 400) return parsed;
      return null;
    } catch (err) {
      this.logger.debug(
        `simplifyInteractiveWidgetsToPlainInputs: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
      return null;
    }
  }

  private safeParseHtmlRewrite(raw: string): string | null {
    try {
      const data = JSON.parse(raw) as { html?: unknown };
      if (typeof data.html !== 'string') return null;
      const html = data.html.trim();
      return html.length ? html : null;
    } catch {
      return null;
    }
  }

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
