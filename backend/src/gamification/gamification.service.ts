import { Injectable } from '@nestjs/common';
import { JobsService } from '../jobs/jobs.service';

export interface LeaderboardItem {
  workspaceId: string;
  completedJobs: number;
  successRate: number;
}

@Injectable()
export class GamificationService {
  constructor(private readonly jobsService: JobsService) {}

  async getLeaderboard(
    days: number,
    limit: number,
  ): Promise<LeaderboardItem[]> {
    const completed = await this.jobsService.listCompletedJobsSince(days);
    const failed = await this.jobsService.listFailedJobsSince(days);
    const counter = new Map<string, { completed: number; failed: number }>();

    for (const job of completed) {
      const workspaceId = this.resolveWorkspaceId(job.payload);
      const current = counter.get(workspaceId) ?? { completed: 0, failed: 0 };
      current.completed += 1;
      counter.set(workspaceId, current);
    }

    for (const job of failed) {
      const workspaceId = this.resolveWorkspaceId(job.payload);
      const current = counter.get(workspaceId) ?? { completed: 0, failed: 0 };
      current.failed += 1;
      counter.set(workspaceId, current);
    }

    return [...counter.entries()]
      .map(([workspaceId, score]) => {
        const total = score.completed + score.failed;
        const successRate =
          total > 0 ? Math.round((score.completed / total) * 100) : 100;
        return {
          workspaceId,
          completedJobs: score.completed,
          successRate,
        };
      })
      .sort(
        (a, b) =>
          b.completedJobs - a.completedJobs || b.successRate - a.successRate,
      )
      .slice(0, limit);
  }

  private resolveWorkspaceId(payload: Record<string, unknown>) {
    const candidate = payload.workspaceId;
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate.trim();
    }
    return 'default-workspace';
  }
}
