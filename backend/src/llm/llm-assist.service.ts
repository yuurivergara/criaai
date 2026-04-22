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

  private safeParseClassification(raw: string): ButtonClassification | null {
    try {
      const data = JSON.parse(raw) as Partial<ButtonClassification>;
      const kind = data.kind as ButtonKind | undefined;
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

  private normalize(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
