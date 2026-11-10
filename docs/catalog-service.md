# Handrail Catalog Service Architecture & Operations Guide

## 1. Overview & Architectural Philosophy

The **Catalog Service** (`catalog-service`) is the single source of truth for workshop content, step theory/tasks/hints, test bundle definitions, and starter repositories across Handrail.

### Core Tenets
1. **Author in Git, Publish to Storage**: Content is authored in private GitHub repositories (or local Git branches for development). Catalog ingests and publishes content into PostgreSQL and S3/MinIO. Once published, runtime operations never read Git.
2. **Code Starters Once, Content & Tests Continually**: Learners receive **one** starter repository per workshop and language upon enrollment. Subsequent chapters unlock only markdown content and test specifications—never source code or merge branches.
3. **Strict Zero User Data in Catalog**: Catalog stores **zero** learner progress, enrollment records, or user profiles. Access gating is delegated to `profile-service` via a hexagonal port (`AccessPolicyPort`) cached in Redis with a short TTL (60s).
4. **Deterministic Packaging**: All starter ZIPs and chapter test tarballs (`tests.tar.gz`) are built byte-for-byte deterministically (lexicographically sorted paths, normalized permissions, fixed timestamps) so that identical Git trees always produce identical SHA256 hashes.
5. **Fail-Closed Security**: If `profile-service` is unreachable or returns a server error, Catalog returns HTTP 503 (Service Unavailable) rather than risking content leakage. Test bundles are accessible exclusively via internal service-token endpoints (`/internal/*`).

---

## 2. Architecture & Data Flow

```
                      +-----------------------------+
                      | GitHub / Local Git Source   |
                      +-----------------------------+
                                     |
                          Push Webhook / Manual Sync
                                     v
                      +-----------------------------+
                      |   catalog-service Ingest    |
                      | (RabbitMQ queue: prefetch 1)|
                      +-----------------------------+
                                     |
              +----------------------+----------------------+
              |                                             |
              v                                             v
     +-----------------+                           +-----------------+
     | PostgreSQL      |                           | S3 / MinIO      |
     | (schema:catalog)|                           | (handrail-      |
     | - Metadata      |                           |  catalog)       |
     | - Parsed MDX    |                           | - Starters .zip |
     | - Audit Events  |                           | - Tests .tar.gz |
     +-----------------+                           +-----------------+
              ^                                             ^
              |                                             |
              +----------------------+----------------------+
                                     |
               Public / Learner / Admin / Internal Endpoints
                                     |
        +----------------------------+----------------------------+
        |                            |                            |
        v                            v                            v
 [Public Learner]              [Gated Learner]           [Internal Services]
  GET /v1/workshops             GET .../chapters          GET /internal/...
  GET /v1/workshops/:slug       GET .../steps             - profile: resolve
                                GET .../starter           - verification: tests
```

---

## 3. Data Model (PostgreSQL Schema: `catalog`)

```
workshop
├── id (UUID)
├── slug (UNIQUE)
├── repo_full_name
├── installation_id (nullable)
├── access (public | private)
├── status (active | archived)
└── latest_published_id ────────────┐
                                    │ points to latest active
workshop_version <──────────────────┘ published version
├── id (UUID)
├── workshop_id (FK -> workshop.id)
├── version (e.g. "draft", "1.0.0", "1.1.0")
├── kind (draft | published | deprecated)
├── main_sha
├── release_notes_md
├── lint_report_json
└── published_at
    │
    ├── chapter (1:N)
    │   ├── id (UUID)
    │   ├── order_no
    │   ├── chapter_key (e.g. "01-bind-port")
    │   ├── title, summary, est_minutes
    │   ├── branch, commit_sha, manifest_json
    │   ├── chapter_intro (beginner | intermediate | expert)
    │   └── step (1:N)
    │       ├── id (UUID), order_in_chapter, step_key, title
    │       └── step_content (task | theory | hint x beginner | intermediate | expert)
    │
    ├── workshop_overview (1:1)
    │   └── sections_json (whatWeBuild, whatYouLearn, prerequisites, limitations, howItWorks)
    │
    └── artifact (1:N)
        ├── kind (starter_zip | test_bundle | asset)
        ├── language (go | python | ...)
        ├── chapter_id (nullable, for test_bundle)
        ├── storage_key (e.g. workshops/<slug>/<version>/starters/go.zip)
        ├── sha256
        └── size

ingest_run
├── id (UUID), workshop_id, trigger (webhook | manual | publish)
├── status (pending | running | completed | failed)
└── log_excerpt

audit_event
├── id (UUID), actor, action, subject, metadata_json, created_at
```

---

## 4. Gating & Access Policy Lifecycle

```
 Learner Request (e.g. GET /v1/workshops/:slug/chapters/:chId)
                      │
                      ▼
            JwtAuthGuard (Validates User JWT)
                      │
                      ▼
         CachedAccessPolicyService
         ┌────────────────────────┐
         │ Check Redis:           │
         │ catalog:access:userId  │
         └───────────┬────────────┘
                     │
          Cache Miss │ Cache Hit
         ┌───────────┴──────────┐
         │                      │
         ▼                      ▼
 HttpAccessPolicyAdapter   Return cached AccessCheckV1
 (Calls profile-service)
         │
 ┌───────┴───────┐
 │               │
 ▼ Success       ▼ Failure / Timeout
Cache 60s &      Fail Closed:
Proceed          Throw HTTP 503 (ServiceUnavailable)
```

### Invalidation Events
Catalog subscribes to `platform.events` on RabbitMQ:
- `profile.enrollment.created`: Purges `catalog:access:<userId>:<slug>`
- `profile.chapter.passed`: Purges `catalog:access:<userId>:<slug>`
- `profile.step.passed`: Purges `catalog:access:<userId>:<slug>`

---

## 5. API Reference

### 5.1 Public Endpoints
| Method | Route | Description | Auth Mode |
|---|---|---|---|
| `GET` | `/health/live` | Process liveness probe | Public |
| `GET` | `/health/ready` | Readiness check (DB, Redis, S3, RabbitMQ) | Public |
| `GET` | `/v1/workshops` | List active workshops with latest published version | Public |
| `GET` | `/v1/workshops/:slug` | Workshop overview, languages, and chapter summaries | Public (`?version=draft` requires admin) |

### 5.2 Gated Learner Endpoints
| Method | Route | Description | Auth Mode | Gating Rule |
|---|---|---|---|---|
| `GET` | `/v1/workshops/:slug/chapters/:chId?level=` | Chapter intro & steps | JWT | User enrolled & chapter unlocked |
| `GET` | `/v1/workshops/:slug/chapters/:chId/steps/:stepId?level=` | Step task, theory, hint | JWT | User enrolled & chapter unlocked |
| `GET` | `/v1/workshops/:slug/starter?language=` | Presigned S3 starter download URL | JWT | User enrolled in workshop |

### 5.3 Administrative Endpoints
| Method | Route | Description | Auth Mode |
|---|---|---|---|
| `POST` | `/v1/admin/workshops` | Register workshop repo | JWT + `admin` |
| `GET` | `/v1/admin/workshops` | List all workshops | JWT + `admin` |
| `POST` | `/v1/admin/workshops/:slug/sync` | Trigger Git ingest job | JWT + `admin` |
| `GET` | `/v1/admin/workshops/:slug/versions` | List versions & lint reports | JWT + `admin` |
| `POST` | `/v1/admin/workshops/:slug/versions/:verId/publish` | Promote draft to SemVer | JWT + `admin` |
| `POST` | `/v1/admin/workshops/:slug/deprecate` | Mark version as deprecated | JWT + `admin` |
| `GET` | `/v1/admin/audit` | Query audit log trail | JWT + `admin` |

### 5.4 Internal Machine-to-Machine Endpoints
| Method | Route | Consumer | Scope | Description |
|---|---|---|---|---|
| `GET` | `/internal/workshops/:slug/resolve` | Profile Service | `catalog:read` | Resolves latest published version ID |
| `GET` | `/internal/versions/:versionId/structure` | Profile Service | `catalog:read` | Full chapter/step sequence for progress |
| `GET` | `/internal/versions/:versionId/chapters/:chapterId/tests` | Verification | `catalog:tests:read` | Presigned URL to `tests.tar.gz` and test definitions |

---

## 6. Authoring & Verification Runbook

### Scaffolding and Authoring Locally
```bash
# 1. Create a new workshop
pnpm author new-workshop build-kv-store --languages go,python

# 2. Add chapters
pnpm author new-chapter 01-tcp-server --title "TCP Server"

# 3. Lint content against all 12 rules
pnpm author lint --all
```

### Running the End-to-End Smoke Test
```bash
# POSIX Shell
./scripts/smoke-catalog.sh

# PowerShell (Windows)
pwsh ./scripts/smoke-catalog.ps1
```

### Running Unit & Integration Tests
```bash
pnpm --filter catalog-service test
```
