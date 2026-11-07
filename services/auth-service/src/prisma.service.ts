import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from './generated/client/index.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const url =
      process.env.DATABASE_URL_AUTH ||
      process.env.DATABASE_URL ||
      'postgresql://handrail:handrail_password@localhost:5432/handrail_db?schema=auth_svc';

    super({
      datasources: {
        db: { url },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to auth_svc database schema');
    } catch (err: any) {
      this.logger.warn(`Could not connect to database on startup: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {
      // Ignored on teardown
    }
  }
}
