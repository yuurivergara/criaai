import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmInput, LlmOutput, LlmProvider } from '../llm.types';

/**
 * Ollama local LLM provider.
 *
 * Talks to an Ollama daemon (default http://localhost:11434) via its native
 * REST API. No paid token usage, no third-party key required.
 *
 * Used by LlmOrchestratorService for `generate(...)` (HTML generation), and
 * exposed directly to LlmAssistService for structured classification / analysis
 * tasks during quiz cloning.
 */
@Injectable()
export class OllamaLlmProvider implements LlmProvider {
  readonly providerName = 'ollama';
  private readonly logger = new Logger(OllamaLlmProvider.name);
  private availableCache: { at: number; ok: boolean } = { at: 0, ok: false };

  constructor(private readonly configService: ConfigService) {}

  get host(): string {
    return (
      this.configService.get<string>('OLLAMA_HOST') ?? 'http://localhost:11434'
    );
  }

  get model(): string {
    return (
      this.configService.get<string>('OLLAMA_MODEL') ?? 'qwen2.5:7b-instruct'
    );
  }

  get timeoutMs(): number {
    return Number(this.configService.get('OLLAMA_TIMEOUT_MS') ?? 30000);
  }

  async isReachable(forceRefresh = false): Promise<boolean> {
    const now = Date.now();
    if (!forceRefresh && now - this.availableCache.at < 15_000) {
      return this.availableCache.ok;
    }
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.host}/api/tags`, {
        signal: controller.signal,
      });
      clearTimeout(timer);
      const ok = res.ok;
      this.availableCache = { at: now, ok };
      if (!ok) {
        this.logger.warn(
          `Ollama /api/tags returned HTTP ${res.status} @ ${this.host}`,
        );
      }
      return ok;
    } catch (error) {
      this.availableCache = { at: now, ok: false };
      this.logger.debug(
        `Ollama unreachable @ ${this.host}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return false;
    }
  }

  /**
   * Low-level chat call. Returns raw string content.
   *
   * - `jsonMode` forces Ollama to return strict JSON via `format: 'json'`.
   * - `temperature` stays low by default (more deterministic behavior for
   *   classification / extraction tasks).
   */
  async chat(params: {
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;
    jsonMode?: boolean;
    temperature?: number;
    timeoutMs?: number;
    model?: string;
  }): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      params.timeoutMs ?? this.timeoutMs,
    );
    try {
      const body = {
        model: params.model ?? this.model,
        messages: params.messages,
        stream: false,
        format: params.jsonMode ? 'json' : undefined,
        options: {
          temperature: params.temperature ?? 0.1,
          num_ctx: 4096,
        },
      };
      const res = await fetch(`${this.host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(
          `Ollama /api/chat status=${res.status} body=${text.slice(0, 200)}`,
        );
      }
      const data = (await res.json()) as { message?: { content?: string } };
      return data.message?.content ?? '';
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * LlmProvider contract — used by LlmOrchestratorService. Generates a full
   * landing page HTML. Kept simple: we just ask the model for a self-contained
   * HTML doc and extract title from it.
   */
  async generate(input: LlmInput): Promise<LlmOutput> {
    if (!(await this.isReachable())) {
      throw new Error('Ollama not reachable');
    }
    const prompt = [
      'You are a landing-page copywriter and front-end developer.',
      'Return a self-contained HTML5 document (with embedded <style>) for the brief below.',
      'No markdown, no code fences, no commentary — output HTML only.',
      'Instruction: ' + input.instruction,
      'Context: ' + JSON.stringify(input.context),
    ].join('\n');

    const raw = await this.chat({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      timeoutMs: Math.max(this.timeoutMs, 45_000),
    });
    const html = this.extractHtml(raw);
    const title = this.extractTitle(html) || 'Generated landing';
    return {
      title,
      html,
      meta: {
        provider: this.providerName,
        model: this.model,
      },
    };
  }

  private extractHtml(raw: string): string {
    const fence = raw.match(/```html\n([\s\S]*?)\n```/i);
    if (fence) return fence[1].trim();
    const doctypeIdx = raw.toLowerCase().indexOf('<!doctype');
    if (doctypeIdx >= 0) return raw.slice(doctypeIdx).trim();
    const htmlIdx = raw.toLowerCase().indexOf('<html');
    if (htmlIdx >= 0) return raw.slice(htmlIdx).trim();
    return raw.trim();
  }

  private extractTitle(html: string): string | null {
    const m = html.match(/<title>([^<]+)<\/title>/i);
    return m ? m[1].trim() : null;
  }
}
