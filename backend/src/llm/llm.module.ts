import { Module } from '@nestjs/common';
import { LlmOrchestratorService } from './llm-orchestrator.service';
import { ExternalLlmProvider } from './providers/external-llm.provider';
import { LocalTemplateProvider } from './providers/local-template.provider';

@Module({
  providers: [
    LlmOrchestratorService,
    ExternalLlmProvider,
    LocalTemplateProvider,
  ],
  exports: [LlmOrchestratorService],
})
export class LlmModule {}
