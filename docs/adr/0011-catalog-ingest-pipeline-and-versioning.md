# ADR 0011: Catalog Ingest Pipeline, Draft Lifecycle, and Versioning

## Status
Accepted

## Context
The Handrail catalog service is responsible for ingesting workshop source code from Git (local repositories in development/testing, GitHub via a GitHub App in production), validating its structure, compiling deterministic artifacts (starter zips, test bundles, assets), storing structured markdown and metadata in PostgreSQL, and publishing immutable versions.

Key architectural requirements include:
1. **Single Rolling Draft Lifecycle**: Authors make frequent commits while drafting a workshop. Storing every intermediate commit as a new immutable version would pollute the database and storage. Instead, each workshop maintains at most one rolling `draft` version. Subsequent pushes with new commits update the existing draft.
2. **Strict Ingest Idempotency**: If a push or sync trigger arrives with identical commit SHAs (`mainSha` and chapter commit SHAs), the pipeline skips reprocessing and returns the existing draft.
3. **Draft Freeze on Publish**: When an administrator publishes a version with a SemVer tag (e.g. `1.0.0`) and release notes, the draft is frozen and becomes an immutable published version. A new draft is then initialized upon subsequent pushes.
4. **SemVer Enforceability**: Published versions must conform to Semantic Versioning and must be strictly increasing. Duplicate versions or downgrades are rejected.
5. **Dual-Mode Content Sourcing**: The ingest engine must support `CONTENT_SOURCE=local` (reading local git repos on disk via plumbing) and `CONTENT_SOURCE=github` (reading GitHub via GitHub App installation tokens), allowing the entire stack to be developed and tested offline without an external GitHub App dependency.

## Decision
1. **Catalog Schema & Database Isolation**:
   - The catalog service utilizes a dedicated PostgreSQL schema `catalog`.
   - The data model strictly implements the versioned schema from `docs/catalog-service-plan.md`:
     `workshop`, `workshop_version`, `chapter`, `step`, `step_content`, `chapter_intro`, `workshop_overview`, `artifact`, `ingest_run`, `audit_event`.
2. **RabbitMQ Work Queue**:
   - Ingest tasks are processed via a dedicated durable queue `catalog.ingest.jobs` with prefetch 1 and manual acknowledgments to prevent resource exhaustion during heavy archive compilation.
   - Failures retry with exponential backoff before routing to `catalog.ingest.dlq`.
3. **Storage Layout in MinIO / S3**:
   - Artifacts are stored under keys:
     - `workshops/<slug>/<version>/starters/<lang>.zip`
     - `workshops/<slug>/<version>/chapters/<chapterKey>/tests.tar.gz`
     - `workshops/<slug>/<version>/assets/<filename>`
   - Objects are written with SHA-256 verification and retrieved via signed GET URLs with short TTLs (default 300 seconds).
4. **Replay Protection & Webhook Verification**:
   - Incoming webhooks verify `X-Hub-Signature-256` using constant-time comparison.
   - The `X-GitHub-Delivery` GUID is cached in Redis with a 24-hour TTL to prevent webhook replay attacks.

## Consequences
- **Positive**: Clean separation between drafting and immutable releases, zero database bloat, reliable offline local testing, reproducible builds.
- **Negative**: Publishing requires a two-step administrative action (commit $\rightarrow$ draft $\rightarrow$ publish semver), which matches production release management standards.
