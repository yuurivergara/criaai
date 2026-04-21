import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalLlmProvider } from './providers/external-llm.provider';
import { LocalTemplateProvider } from './providers/local-template.provider';
import { LlmInput, LlmOutput } from './llm.types';

@Injectable()
export class LlmOrchestratorService {
  private failureCount = 0;
  private openedUntil = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly externalProvider: ExternalLlmProvider,
    private readonly localProvider: LocalTemplateProvider,
  ) {}

  async generate(input: LlmInput): Promise<LlmOutput> {
    if (this.isCircuitOpen()) {
      return this.localProvider.generate(input);
    }

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
    if (this.failureCount < threshold) {
      return;
    }
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
