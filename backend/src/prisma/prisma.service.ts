import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaClient } from '../../generated/prisma-v2';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async onModuleInit() {
    const strictMode =
      this.configService.get<string>('DB_STRICT_MODE')?.toLowerCase() !==
      'false';
    try {
      await this.$connect();
    } catch (error) {
      if (strictMode) {
        throw error;
      }
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
