# ADR 0013: Version Pinning, Deprecation Lifecycle, and Operational Auditing

## Status
Accepted

## Context
In Handrail, workshops evolve over time with fixes, new chapters, and updated exercises.
Learners who start a workshop expect their code environment, tests, and exercises to remain consistent until they finish.
Simultaneously, content administrators need the ability to:
1. Deprecate obsolete versions while preserving access for already-enrolled learners.
2. Prevent resource exhaustion through rate limiting on sync and starter delivery.
3. Maintain an immutable audit log for compliance and operational tracking.

## Decision

### 1. Version Pinning & Deprecation Semantics
- **Version Pinning**: An enrollment in Profile Service pins an immutable `versionId`. All gated content requests (chapter markdown, step theories/tasks/hints, test bundle references, starter zips) must serve assets belonging strictly to that pinned `versionId`.
- **Deprecation Lifecycle**:
  - Admins can deprecate a version via `POST /v1/admin/workshops/:slug/deprecate`.
  - When a version is deprecated (`kind: 'deprecated'`), it is never returned as `latestPublishedId` or shown on public discovery pages (`GET /v1/workshops`).
  - **Graceful Pinning**: Existing learners with enrollments pointing to a deprecated `versionId` retain full read access to chapters, steps, and starter downloads. Content is never deleted while enrollments exist.
  - New enrollments are only permitted on active published versions.

### 2. Operational Auditing
- All administrative mutations are recorded in the PostgreSQL `catalog.audit_events` table:
  - `workshop.register`: Creation of workshop metadata and GitHub tracking.
  - `workshop.sync`: Enqueuing ingest runs (manual or forced).
  - `workshop.publish`: Promoting draft versions to immutable SemVer tags, moving S3 artifacts, and advancing `latestPublishedId`.
  - `workshop.deprecate`: Retiring obsolete versions.
- An administrative query API is exposed: `GET /v1/admin/audit` with support for filtering by `subject`, `action`, and pagination (`limit`, `offset`).

### 3. Rate Limiting & Egress Protection
- Rate limiting is applied to resource-intensive operations:
  - `POST /v1/admin/workshops/:slug/sync`: Limited to prevent webhook flooding or excessive Git plumbing.
  - `GET /v1/workshops/:slug/starter`: Throttled per user to protect S3 egress bandwidth.
  - Public discovery endpoints: Throttled per IP.

### 4. End-to-End Verification (Smoke Script)
- An automated smoke script (`scripts/smoke-catalog.sh` and `scripts/smoke-catalog.ps1`) verifies the full operational lifecycle:
  1. Service health and readiness.
  2. Workshop registration.
  3. Git ingest and snapshot validation.
  4. SemVer publication and event emission.
  5. Public discovery.
  6. Gated chapter and step content delivery.
  7. Starter download presigned URL generation.
  8. Internal machine-to-machine resolution and test bundle contracts.
  9. Deprecation and audit log retrieval.

## Consequences
- Guaranteed stability: Learners are never disrupted by workshop updates mid-course.
- Transparent operations: Every release, deprecation, and sync is traceable.
- Operational resilience: Egress costs and Git/S3 abuse are bounded.
