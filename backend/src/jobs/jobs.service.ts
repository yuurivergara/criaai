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
  ): Promise<JobRecord> {
    const now = new Date().toISOString();
    const job: JobRecord = {
      id: randomUUID(),
      type,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      payload,
    };
    await this.prismaService.job.create({
      data: {
        id: job.id,
        type: job.type,
        status: job.status,
        payload: payload as Prisma.InputJsonValue,
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
      payload: (item.payload ?? {}) as Record<string, unknown>,
      result: (item.result ?? undefined) as Record<string, unknown> | undefined,
      error: item.error ?? undefined,
    };
  }
}
