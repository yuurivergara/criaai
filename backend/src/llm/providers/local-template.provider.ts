import { Injectable } from '@nestjs/common';
import { LlmInput, LlmOutput, LlmProvider } from '../llm.types';

@Injectable()
export class LocalTemplateProvider implements LlmProvider {
  readonly providerName = 'local-template';

  generate(input: LlmInput): Promise<LlmOutput> {
    const objective = this.toSafeString(
      input.context.objective ?? input.context.prompt,
      'Landing page',
    );
    const cta = this.toSafeString(input.context.cta, 'Get started');
    const title = this.toSafeString(input.context.title, objective);

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>
    :root { --bg: #0f172a; --fg: #e2e8f0; --accent: #3b82f6; }
    body { margin: 0; font-family: Arial, sans-serif; background: var(--bg); color: var(--fg); }
    .container { max-width: 960px; margin: 0 auto; padding: 48px 24px; }
    h1 { font-size: 40px; margin-bottom: 12px; }
    p { line-height: 1.6; max-width: 720px; }
    .cta { margin-top: 28px; display: inline-block; padding: 12px 18px; color: white; background: var(--accent); border-radius: 8px; text-decoration: none; font-weight: 600; }
  </style>
</head>
<body>
  <main class="container">
    <h1>${title}</h1>
    <p>${objective}</p>
    <a class="cta" href="#start">${cta}</a>
  </main>
</body>
</html>`;

    return Promise.resolve({
      title,
      html,
      meta: {
        instruction: input.instruction,
        provider: this.providerName,
      },
    });
  }

  private toSafeString(value: unknown, fallback: string): string {
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized.length > 0) {
        return normalized;
      }
    }
    return fallback;
  }
}
