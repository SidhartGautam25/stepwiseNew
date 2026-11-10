import type { AccessCheckV1 } from '@app/contracts';

export type AccessCheckResult = AccessCheckV1;

export const ACCESS_POLICY_PORT = Symbol('ACCESS_POLICY_PORT');

export interface AccessPolicyPort {
  checkAccess(userId: string, workshopSlug: string): Promise<AccessCheckResult>;
}
