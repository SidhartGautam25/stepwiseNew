import { Injectable, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';
import type { AccessCheckV1 } from '@app/contracts';
import { CatalogConfigService } from '../config/catalog.config.js';
import { ACCESS_POLICY_PORT, type AccessPolicyPort } from './access-policy.port.js';

@Injectable()
export class CachedAccessPolicyService implements AccessPolicyPort {
  private readonly logger = new Logger(CachedAccessPolicyService.name);
  private readonly redis: Redis;

  constructor(
    @Inject(ACCESS_POLICY_PORT)
    private readonly underlyingPort: AccessPolicyPort,
    private readonly config: CatalogConfigService,
  ) {
    this.redis = new Redis(this.config.redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
  }

  private getCacheKey(userId: string, workshopSlug: string): string {
    return `catalog:access:${userId}:${workshopSlug}`;
  }

  async checkAccess(userId: string, workshopSlug: string): Promise<AccessCheckV1> {
    const key = this.getCacheKey(userId, workshopSlug);

    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect().catch(() => {});
      }
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached) as AccessCheckV1;
      }
    } catch (err: any) {
      this.logger.warn(`Redis access cache get error: ${err.message}`);
    }

    // Call underlying port (fail-closed if it fails)
    const result = await this.underlyingPort.checkAccess(userId, workshopSlug);

    // Cache in Redis for 60 seconds
    try {
      if (this.redis.status === 'ready') {
        await this.redis.set(key, JSON.stringify(result), 'EX', 60);
      }
    } catch (err: any) {
      this.logger.warn(`Redis access cache set error: ${err.message}`);
    }

    return result;
  }

  async invalidate(userId: string, workshopSlug: string): Promise<void> {
    const key = this.getCacheKey(userId, workshopSlug);
    try {
      if (this.redis.status !== 'ready') {
        await this.redis.connect().catch(() => {});
      }
      await this.redis.del(key);
      this.logger.log(`Invalidated access cache for user [${userId}] workshop [${workshopSlug}]`);
    } catch (err: any) {
      this.logger.warn(`Redis cache invalidation warning: ${err.message}`);
    }
  }
}
