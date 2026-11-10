# ADR 0012: Access Policy Caching, Fail-Closed Content Gating, and Service Contracts

## Status
Accepted

## Context
Handrail separates content ownership (Catalog Service) from user state and unlock decisions (Profile Service).
Catalog stores zero user state, progress, or enrollment data in Postgres.
Learners requesting chapter markdown, hints, or starter download URLs must have their access validated:
1. Is the learner enrolled in the workshop?
2. Which version is pinned by their enrollment (`versionId`)?
3. Is the requested chapter unlocked?

If Catalog cannot communicate with Profile Service, content must never leak. Furthermore, internal APIs (such as test bundle delivery for Verification Service) require strict machine-to-machine authentication with scopes.

## Decision

### 1. AccessPolicyPort Architecture
Catalog defines a hexagonal port `AccessPolicyPort`:
```ts
export interface AccessCheckResult {
  enrolled: boolean;
  versionId?: string;
  unlockedChapters: string[];
  currentChapterId?: string;
}

export interface AccessPolicyPort {
  checkAccess(userId: string, workshopSlug: string): Promise<AccessCheckResult>;
}
```
Two adapters are provided:
- `HttpAccessPolicyAdapter`: Calls Profile Service at `GET /internal/access/users/:userId/workshops/:slug` with an internal service token (`SERVICE_SECRET`).
- `InMemoryAccessPolicyFake`: Used for unit and integration testing without running Profile Service.

### 2. Fail-Closed Policy
If `HttpAccessPolicyAdapter` encounters a network error, timeout, or 5xx from Profile Service, it throws `ServiceUnavailableException` (HTTP 503).
Content is never served when access cannot be definitively confirmed.

### 3. Redis Access Cache & Reactive Invalidation
- Access check results are cached in Redis: `catalog:access:<userId>:<slug>` with a short TTL (60 seconds).
- Catalog consumes events on RabbitMQ exchange `platform.events` with queue `catalog.access.invalidation`:
  - `profile.enrollment.created`
  - `profile.chapter.passed`
  - `profile.step.passed`
- Upon receiving an event, Catalog deletes the corresponding cache key `catalog:access:<userId>:<slug>`. Catalog stores zero persistent user state.

### 4. Gated Endpoints
- `GET /v1/workshops/:slug/chapters/:chapterId?level=beginner|intermediate|expert`
  - Requires JWT (`@CurrentUser()`).
  - Calls `AccessPolicyPort`.
  - Verifies user is enrolled and `chapterId` is in `unlockedChapters`.
  - Serves chapter intro and steps from the user's pinned `versionId`.
- `GET /v1/workshops/:slug/chapters/:chapterId/steps/:stepId?level=`
  - Serves step task, theory, and hints from the pinned `versionId`.
- `GET /v1/workshops/:slug/starter?language=`
  - Requires JWT.
  - Verifies user is enrolled.
  - Generates short-lived signed S3 download URL (5 minutes) for the pinned `versionId`'s starter.

### 5. Internal Service-Token Endpoints
Protected by `@ServiceOnly(...)` and blocked from external ingress at API Gateway:
- `GET /internal/workshops/:slug/resolve` (`catalog:read`): Returns `WorkshopResolveV1` with `latestPublishedVersionId`.
- `GET /internal/versions/:versionId/structure` (`catalog:read`): Returns `VersionStructureV1` with full chapter order and step keys for enrollment initialization or progress reconciliation.
- `GET /internal/versions/:versionId/chapters/:chapterId/tests` (`catalog:tests:read`): Returns `TestBundleRefV1` containing a short-lived presigned URL to the test bundle tarball in S3, its SHA256 checksum, size, and test manifests.

### 6. Contract Schemas in `@app/contracts`
Defined in Zod and exported with TypeScript types:
- `WorkshopResolveV1`
- `VersionStructureV1`
- `TestBundleRefV1`
- `AccessCheckV1`

## Consequences
- Strict decoupling: Catalog and Profile can be deployed, scaled, and versioned independently.
- Zero user data in Catalog database; cache is strictly in Redis with TTL and reactive invalidation.
- Security: Test bundles are never accessible through user JWT or public endpoints.
- High availability with safety: Public exploration is 100% available even if Profile Service is down; gated endpoints fail closed safely.
