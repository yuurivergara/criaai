import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { LlmModule } from './llm/llm.module';
import { PagesModule } from './pages/pages.module';
import { PrismaModule } from './prisma/prisma.module';
import { QueueModule } from './queue/queue.module';
import { RealtimeModule } from './realtime/realtime.module';
import { GamificationModule } from './gamification/gamification.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuthModule,
    QueueModule,
    RealtimeModule,
    HealthModule,
    JobsModule,
    LlmModule,
    PagesModule,
    GamificationModule,
  ],
})
export class AppModule {}
