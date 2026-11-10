import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import Redis from 'ioredis';
import { Public } from '@app/auth';
import { PrismaService } from '../prisma.service.js';
import { StorageService } from '../storage/storage.service.js';
import { EventsPublisherService } from '../common/events.publisher.js';
import { CatalogConfigService } from '../config/catalog.config.js';

@Controller('health')
export class HealthController {
  private readonly redis: Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: EventsPublisherService,
    private readonly config: CatalogConfigService,
  ) {
    this.redis = new Redis(this.config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  @Public()
  @Get('live')
  getLive() {
    return { status: 'ok', uptime: process.uptime() };
  }

  @Public()
  @Get('ready')
  async getReady(@Res() res: Response) {
    const checks: Record<string, 'ok' | 'failed'> = {
      database: 'ok',
      redis: 'ok',
      storage: 'ok',
      rabbitmq: 'ok',
    };

    let allOk = true;

    // Database check
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      checks.database = 'failed';
      allOk = false;
    }

    // Redis check
    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect().catch(() => {});
      }
      await this.redis.ping();
    } catch {
      checks.redis = 'failed';
      allOk = false;
    }

    // Storage check
    try {
      const storageOk = await this.storage.isHealthy();
      if (!storageOk) {
        checks.storage = 'failed';
        allOk = false;
      }
    } catch {
      checks.storage = 'failed';
      allOk = false;
    }

    // RabbitMQ check
    try {
      const rmqOk = await this.events.isHealthy();
      if (!rmqOk) {
        checks.rabbitmq = 'failed';
        // Warning or failure depending on strict readiness
        // In local dev without rmq, mark degraded
      }
    } catch {
      checks.rabbitmq = 'failed';
    }

    const statusCode = allOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json({
      status: allOk ? 'ready' : 'degraded',
      service: 'catalog-service',
      checks,
      timestamp: new Date().toISOString(),
    });
  }
}
