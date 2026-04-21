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

    this.redis = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });

    this.queue = new Queue('criaai-jobs', {
      connection: this.redis,
      defaultJobOptions: {
        removeOnComplete: true,
        attempts: 3,
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
        concurrency: Number(this.configService.get('QUEUE_CONCURRENCY') ?? 10),
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
}
