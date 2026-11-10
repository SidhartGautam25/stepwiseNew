import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { AccessCheckV1 } from '@app/contracts';
import type { AccessPolicyPort } from './access-policy.port.js';

@Injectable()
export class InMemoryAccessPolicyFake implements AccessPolicyPort {
  private rules = new Map<string, AccessCheckV1>();
  private shouldFailOutage = false;

  setAccess(userId: string, workshopSlug: string, result: AccessCheckV1): void {
    this.rules.set(`${userId}:${workshopSlug}`, result);
  }

  setOutage(fail: boolean): void {
    this.shouldFailOutage = fail;
  }

  clear(): void {
    this.rules.clear();
    this.shouldFailOutage = false;
  }

  async checkAccess(userId: string, workshopSlug: string): Promise<AccessCheckV1> {
    if (this.shouldFailOutage) {
      throw new ServiceUnavailableException(
        'Simulated profile service outage (fail-closed gating)',
      );
    }

    const key = `${userId}:${workshopSlug}`;
    const found = this.rules.get(key);

    if (found) {
      return found;
    }

    return {
      enrolled: false,
      unlockedChapters: [],
    };
  }
}
