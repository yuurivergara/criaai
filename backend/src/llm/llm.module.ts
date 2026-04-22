import { Module } from '@nestjs/common';
import { LlmAssistService } from './llm-assist.service';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { ExternalLlmProvider } from './providers/external-llm.provider';
import { LocalTemplateProvider } from './providers/local-template.provider';
import { OllamaLlmProvider } from './providers/ollama-llm.provider';

@Module({
  providers: [
    LlmOrchestratorService,
    LlmAssistService,
    ExternalLlmProvider,
    LocalTemplateProvider,
    OllamaLlmProvider,
  ],
  exports: [LlmOrchestratorService, LlmAssistService, OllamaLlmProvider],
})
export class LlmModule {}
