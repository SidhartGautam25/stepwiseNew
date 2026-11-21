import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from './generated/client/index.js';
import { PaymentConfigService } from './config/payment.config.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor(configService: PaymentConfigService) {
    super({
      datasources: {
        db: { url: configService.databaseUrl },
      },
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('Connected to payment_svc PostgreSQL schema');
    } catch (err: any) {
      this.logger.warn(`Could not connect to database on startup: ${err.message}`);
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {
      // Ignored during teardown
    }
  }
}
