import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmInput, LlmOutput, LlmProvider } from '../llm.types';

@Injectable()
export class ExternalLlmProvider implements LlmProvider {
  readonly providerName = 'external-llm';

  constructor(private readonly configService: ConfigService) {}

  async generate(input: LlmInput): Promise<LlmOutput> {
    const endpoint = this.configService.get<string>('LLM_API_URL');
    const apiKey = this.configService.get<string>('LLM_API_KEY');

    if (!endpoint) {
      throw new Error('LLM_API_URL is not configured');
    }

    const timeoutMs = Number(
      this.configService.get<string>('LLM_TIMEOUT_MS') ?? 10000,
    );
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Provider responded with status ${response.status}`);
      }

      const data = (await response.json()) as Partial<LlmOutput>;
      if (!data.html || !data.title) {
        throw new Error('Provider response is missing html or title');
      }

      return {
        title: data.title,
        html: data.html,
        meta: {
          ...(data.meta ?? {}),
          provider: this.providerName,
        },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
