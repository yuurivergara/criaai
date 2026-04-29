import {
  Module,
  type MiddlewareConsumer,
  type NestModule,
} from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { LlmModule } from '../llm/llm.module';
import { PagesController, PublicPagesController } from './pages.controller';
import { PagesService } from './pages.service';
import { SalesPageGeneratorService } from './sales-page-generator.service';
import { DomainsController } from './domains.controller';
import { DomainsService } from './domains.service';
import { CustomDomainMiddleware } from './custom-domain.middleware';
import { InternalDomainsController } from './internal-domains.controller';

@Module({
  imports: [JobsModule, LlmModule],
  controllers: [
    PagesController,
    PublicPagesController,
    DomainsController,
    InternalDomainsController,
  ],
  providers: [PagesService, SalesPageGeneratorService, DomainsService],
  exports: [DomainsService],
})
export class PagesModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Wildcard match — middleware itself filters out API/editor paths.
    // Express 5 needs '/*splat' wildcard syntax.
    consumer.apply(CustomDomainMiddleware).forRoutes('*splat');
  }
}
