import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalLlmProvider } from './providers/external-llm.provider';
import { LocalTemplateProvider } from './providers/local-template.provider';
import { OllamaLlmProvider } from './providers/ollama-llm.provider';
import { LlmInput, LlmOutput } from './llm.types';

/**
 * Orchestrates the three providers, in priority:
 *   1. Ollama (local, zero cost) — used when `OLLAMA_HOST` is reachable.
 *   2. ExternalLlmProvider — used when `LLM_API_URL` is configured.
 *   3. LocalTemplateProvider — deterministic fallback that never fails.
 *
 * A simple per-provider circuit breaker prevents the orchestrator from
 * retrying a provider that recently failed N times in a row.
 */
@Injectable()
export class LlmOrchestratorService {
  private readonly logger = new Logger(LlmOrchestratorService.name);
  private failureCount = 0;
  private openedUntil = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly externalProvider: ExternalLlmProvider,
    private readonly localProvider: LocalTemplateProvider,
    private readonly ollamaProvider: OllamaLlmProvider,
  ) {}

  async generate(input: LlmInput): Promise<LlmOutput> {
    if (await this.ollamaProvider.isReachable()) {
      try {
        return await this.ollamaProvider.generate(input);
      } catch (err) {
        this.logger.warn(
          `Ollama failed, falling through: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        );
      }
    }

    if (
      this.configService.get<string>('LLM_API_URL') &&
      !this.isCircuitOpen()
    ) {
      const maxRetries = Number(this.configService.get('LLM_MAX_RETRIES') ?? 2);
      const baseDelay = Number(
        this.configService.get('LLM_BASE_RETRY_DELAY_MS') ?? 250,
      );
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          const output = await this.externalProvider.generate(input);
          this.registerSuccess();
          return output;
        } catch {
          this.registerFailure();
          if (attempt < maxRetries) {
            await this.delay(baseDelay * 2 ** attempt);
          }
        }
      }
    }

    return this.localProvider.generate(input);
  }

  private isCircuitOpen() {
    return Date.now() < this.openedUntil;
  }

  private registerSuccess() {
    this.failureCount = 0;
    this.openedUntil = 0;
  }

  private registerFailure() {
    this.failureCount += 1;
    const threshold = Number(
      this.configService.get('LLM_CIRCUIT_BREAKER_FAILURE_THRESHOLD') ?? 3,
    );
    if (this.failureCount < threshold) return;
    const cooldown = Number(
      this.configService.get('LLM_CIRCUIT_BREAKER_COOLDOWN_MS') ?? 10000,
    );
    this.openedUntil = Date.now() + cooldown;
    this.failureCount = 0;
  }

  private async delay(ms: number) {
    await new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
