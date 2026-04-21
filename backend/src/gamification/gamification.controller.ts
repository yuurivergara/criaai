import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { GamificationService } from './gamification.service';

@ApiTags('gamification')
@Controller('gamification')
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @ApiOperation({ summary: 'Get weekly leaderboard by workspace' })
  @Get('leaderboard')
  async getLeaderboard(
    @Query('days') daysRaw?: string,
    @Query('limit') limitRaw?: string,
  ) {
    const days = Number(daysRaw ?? 7);
    const limit = Number(limitRaw ?? 10);
    return this.gamificationService.getLeaderboard(
      Number.isFinite(days) ? days : 7,
      Number.isFinite(limit) ? limit : 10,
    );
  }
}
