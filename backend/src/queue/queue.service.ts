import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JobsOptions, Queue, Worker } from 'bullmq';
import IORedis, { Redis } from 'ioredis';

type QueueHandler = (payload: Record<string, unknown>) => Promise<void>;

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly handlers = new Map<string, QueueHandler>();
  private redis?: Redis;
  private queue?: Queue;
  private worker?: Worker;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (!redisUrl) {
      return;
    }

    const queueConcurrency = Number(
      this.configService.get('QUEUE_CONCURRENCY') ?? 2,
    );
    const lockDurationMs = Number(
      this.configService.get('QUEUE_LOCK_DURATION_MS') ?? 10 * 60 * 1000,
    );
    const lockRenewMs = Number(
      this.configService.get('QUEUE_LOCK_RENEW_MS') ?? 30 * 1000,
    );
    const stalledIntervalMs = Number(
      this.configService.get('QUEUE_STALLED_INTERVAL_MS') ?? 60 * 1000,
    );
    const maxStalledCount = Number(
      this.configService.get('QUEUE_MAX_STALLED_COUNT') ?? 1,
    );

    this.redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.queue = new Queue('criaai-jobs', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: true,
        attempts: 2,
        backoff: { type: 'exponential', delay: 500 },
      },
    });

    this.worker = new Worker(
      'criaai-jobs',
      async (job) => {
        const handler = this.handlers.get(job.name);
        if (!handler) {
          throw new Error(`No handler registered for job ${job.name}`);
        }
        await handler(job.data as Record<string, unknown>);
      },
      {
        connection: this.redis,
        concurrency: queueConcurrency,
        lockDuration: lockDurationMs,
        lockRenewTime: lockRenewMs,
        stalledInterval: stalledIntervalMs,
        maxStalledCount,
      },
    );

    this.worker.on('failed', (job, error) => {
      this.logger.error(
        `Queue job failed: ${job?.name ?? 'unknown'}:${job?.id ?? 'unknown'} ${error.message}`,
      );
    });
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
    await this.redis?.quit();
  }

  registerHandler(jobName: string, handler: QueueHandler) {
    this.handlers.set(jobName, handler);
  }

  async enqueue(
    jobName: string,
    payload: Record<string, unknown>,
    options?: JobsOptions,
  ) {
    if (this.queue) {
      await this.queue.add(jobName, payload, options);
      return;
    }
    const handler = this.handlers.get(jobName);
    if (!handler) {
      throw new Error(`No handler registered for job ${jobName}`);
    }
    queueMicrotask(() => {
      void handler(payload);
    });
  }

  /**
   * Reserve a short-lived dedup window for `key`. Returns `true` if the
   * caller "won" the slot (no recent identical job) and `false` if the
   * key was already claimed within the TTL.
   *
   * Backed by Redis when available (`SET … NX EX`); when Redis is not
   * configured (e.g. dev / tests) the dedup is silently a no-op so the
   * single-process queue still works.
   */
  async tryClaimDedup(key: string, ttlSeconds: number): Promise<boolean> {
    if (!this.redis) {
      return true;
    }
    try {
      const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (error) {
      this.logger.warn(
        `dedup claim failed for key=${key}: ${
          error instanceof Error ? error.message : 'unknown'
        }`,
      );
      return true;
    }
  }
}
