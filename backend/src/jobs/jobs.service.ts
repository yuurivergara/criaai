import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '../../generated/prisma-v2';
import { PrismaService } from '../prisma/prisma.service';
import { JobRecord, JobStatus, JobType } from './job.types';
import { JobsGateway } from '../realtime/jobs.gateway';

@Injectable()
export class JobsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly jobsGateway: JobsGateway,
  ) {}

  async create(
    type: JobType,
    payload: Record<string, unknown>,
    userId?: string | null,
  ): Promise<JobRecord> {
    const now = new Date().toISOString();
    const job: JobRecord = {
      id: randomUUID(),
      type,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      userId: userId ?? null,
      payload,
    };
    await this.prismaService.job.create({
      data: {
        id: job.id,
        type: job.type,
        status: job.status,
        payload: payload as Prisma.InputJsonValue,
        userId: job.userId ?? null,
        createdAt: new Date(job.createdAt),
        updatedAt: new Date(job.updatedAt),
      },
    });
    this.jobsGateway.emitJobUpdated(job);
    return job;
  }

  async getById(jobId: string): Promise<JobRecord> {
    const job = await this.prismaService.job.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return this.mapToRecord(job);
  }

  /**
   * Same as `getById`, but raises 404 if the job doesn't belong to the
   * given user. Pass `null` to allow only userless rows (rare).
   */
  async getByIdForUser(jobId: string, userId: string): Promise<JobRecord> {
    const job = await this.getById(jobId);
    if (job.userId && job.userId !== userId) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }
    return job;
  }

  async updateStatus(
    jobId: string,
    status: JobStatus,
    patch: Partial<JobRecord> = {},
  ): Promise<JobRecord> {
    const current = await this.getById(jobId);
    const updated: JobRecord = {
      ...current,
      ...patch,
      status,
      updatedAt: new Date().toISOString(),
    };
    await this.prismaService.job.update({
      where: { id: jobId },
      data: {
        status: updated.status,
        updatedAt: new Date(updated.updatedAt),
        error: updated.error ?? null,
        result: updated.result
          ? (updated.result as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      },
    });
    this.jobsGateway.emitJobUpdated(updated);
    return updated;
  }

  async listCompletedJobsSince(days: number): Promise<JobRecord[]> {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const records = await this.prismaService.job.findMany({
      where: {
        status: 'completed',
        updatedAt: {
          gte: from,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    return records.map((item) => this.mapToRecord(item));
  }

  /**
   * Looks up the most recent non-terminal job of a given type that
   * targets the same source URL for a given user. Used by the
   * clone-job dedup path so a duplicate submission within the dedup
   * window resolves to the existing in-flight job rather than spawning
   * a parallel pipeline.
   *
   * `sourceUrl` is matched against `payload.sourceUrl` exactly as the
   * caller stores it. `windowMs` bounds how far back we look so an
   * unrelated old failure doesn't get reused.
   */
  async findRecentByTypeAndUrl(
    type: JobType,
    sourceUrl: string,
    userId: string | null,
    windowMs: number,
  ): Promise<JobRecord | null> {
    const from = new Date(Date.now() - windowMs);
    const records = await this.prismaService.job.findMany({
      where: {
        type,
        userId: userId ?? null,
        status: {
          in: ['pending', 'processing'],
        },
        createdAt: {
          gte: from,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 25,
    });
    for (const record of records) {
      const payload = (record.payload ?? {}) as Record<string, unknown>;
      if (
        typeof payload.sourceUrl === 'string' &&
        payload.sourceUrl === sourceUrl
      ) {
        return this.mapToRecord(record);
      }
    }
    return null;
  }

  async listFailedJobsSince(days: number): Promise<JobRecord[]> {
    const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const records = await this.prismaService.job.findMany({
      where: {
        status: {
          in: ['failed', 'blocked'],
        },
        updatedAt: {
          gte: from,
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    return records.map((item) => this.mapToRecord(item));
  }

  private mapToRecord(item: {
    id: string;
    type: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    userId?: string | null;
    payload: Prisma.JsonValue;
    result: Prisma.JsonValue | null;
    error: string | null;
  }): JobRecord {
    return {
      id: item.id,
      type: item.type as JobType,
      status: item.status as JobStatus,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      userId: item.userId ?? null,
      payload: (item.payload ?? {}) as Record<string, unknown>,
      result: (item.result ?? undefined) as Record<string, unknown> | undefined,
      error: item.error ?? undefined,
    };
  }
}
