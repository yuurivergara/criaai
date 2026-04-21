export interface LlmInput {
  instruction: string;
  context: Record<string, unknown>;
}

export interface LlmOutput {
  title: string;
  html: string;
  meta: Record<string, unknown>;
}

export interface LlmProvider {
  readonly providerName: string;
  generate(input: LlmInput): Promise<LlmOutput>;
}
