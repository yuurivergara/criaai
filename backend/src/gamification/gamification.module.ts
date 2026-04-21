import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';

@Module({
  imports: [JobsModule],
  controllers: [GamificationController],
  providers: [GamificationService],
})
export class GamificationModule {}
