import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AccessCheckSchema, type AccessCheckV1 } from '@app/contracts';
import { CatalogConfigService } from '../config/catalog.config.js';
import type { AccessPolicyPort } from './access-policy.port.js';

@Injectable()
export class HttpAccessPolicyAdapter implements AccessPolicyPort {
  private readonly logger = new Logger(HttpAccessPolicyAdapter.name);

  constructor(private readonly config: CatalogConfigService) {}

  async checkAccess(userId: string, workshopSlug: string): Promise<AccessCheckV1> {
    const url = `${this.config.profileServiceUrl}/internal/access/users/${encodeURIComponent(userId)}/workshops/${encodeURIComponent(workshopSlug)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    try {
      const res = await fetch(url, {
        headers: {
          'x-service-token': this.config.serviceSecret,
          Authorization: `Bearer ${this.config.serviceSecret}`,
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      if (res.status === 404) {
        return {
          enrolled: false,
          unlockedChapters: [],
        };
      }

      if (!res.ok) {
        const body = await res.text();
        this.logger.error(`Profile service access check failed HTTP ${res.status}: ${body}`);
        throw new ServiceUnavailableException(
          'Profile service access check failed (fail-closed gating)',
        );
      }

      const json = await res.json();
      return AccessCheckSchema.parse(json);
    } catch (err: any) {
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      this.logger.error(
        `Failed to reach profile service at ${url}: ${err.message} (fail-closed gating)`,
      );
      throw new ServiceUnavailableException(
        'Unable to verify enrollment and unlock status with profile-service (fail-closed gating)',
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
