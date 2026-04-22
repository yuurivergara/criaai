import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { LlmModule } from '../llm/llm.module';
import { PagesController, PublicPagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { SalesPageGeneratorService } from './sales-page-generator.service';

@Module({
  imports: [JobsModule, LlmModule],
  controllers: [PagesController, PublicPagesController],
  providers: [PagesService, SalesPageGeneratorService],
})
export class PagesModule {}
