# Handrail Workshop Lifecycle & Operations Manual

This comprehensive guide explains how to create, author, push, ingest, publish, and monitor workshops in Handrail. It covers everything from local scaffolding to GitHub webhooks, MinIO/S3 object storage packaging, versioning, size metrics, and PostgreSQL schema tracking.

---

## Table of Contents
1. [Core Concepts & Mental Model](#1-core-concepts--mental-model)
2. [Step-by-Step: Adding a New Workshop](#2-step-by-step-adding-a-new-workshop)
3. [Adding Chapters, Steps, and Tests](#3-adding-chapters-steps-and-tests)
4. [Authoring Validation & Content Linting](#4-authoring-validation--content-linting)
5. [Git Push to GitHub & Ingest Pipeline](#5-git-push-to-github--ingest-pipeline)
6. [Promoting Draft to Published SemVer](#6-promoting-draft-to-published-semver)
7. [Inspecting Metrics: Storage Size, Chapters, Steps & Artifacts](#7-inspecting-metrics-storage-size-chapters-steps--artifacts)
8. [Version Pinning & Deprecation](#8-version-pinning--deprecation)
9. [Complete End-to-End Walkthrough Cheatsheet](#9-complete-end-to-end-walkthrough-cheatsheet)

---

## 1. Core Concepts & Mental Model

### One Git Repository Per Workshop
Each workshop lives in its own private Git repository (e.g. `github.com/handrail-workshops/build-your-own-http-server`). The repository is divided into branches:

- **`main` Branch (Workshop Root & Starters)**:
  - `workshop.yaml`: Top-level metadata, description, difficulty, estimated time, and supported languages.
  - `overview.md`: Marketing overview with mandatory sections (`What we build`, `What you will learn`, `Prerequisites`, `Limitations and scope`, `How this workshop works`).
  - `starters/<lang>/`: The starter code template for each supported language. Learners download this **once** when enrolling.
- **`chapter/<chapterKey>` Branches (One branch per chapter)**:
  - E.g. `chapter/01-ping`, `chapter/02-parse-request`, `chapter/03-concurrent-connections`.
  - `handrail/chapter.yaml`: Chapter title, summary, estimated duration, and step definitions.
  - `handrail/content/{beginner,intermediate,expert}.md`: 3-level difficulty markdown text.
  - `handrail/tests/*`: Automated test runner and test assertion scripts.
  - `solutions/<lang>/*`: Reference solutions for instructors and verification validation (never packaged into starters).

```
[Git Repository: build-your-own-http-server]
  │
  ├── main branch
  │   ├── workshop.yaml
  │   ├── overview.md
  │   └── starters/
  │       ├── go/
  │       └── python/
  │
  ├── chapter/01-ping branch
  │   ├── handrail/chapter.yaml
  │   ├── handrail/content/{beginner,intermediate,expert}.md
  │   ├── handrail/tests/*
  │   └── solutions/{go,python}/
  │
  └── chapter/02-parse-request branch
      ├── handrail/chapter.yaml
      ├── handrail/content/{beginner,intermediate,expert}.md
      ├── handrail/tests/*
      └── solutions/{go,python}/
```

### Storage Separation (Zero User Data in Catalog)
- **PostgreSQL (`catalog` schema)**: Stores structural metadata, parsed markdown sections, step hierarchy, and pointers to S3 artifacts. Stores **zero user data** (no progress, no enrollments).
- **Object Storage (S3 / MinIO `handrail-catalog` bucket)**: Stores immutable compressed binary artifacts:
  - `workshops/<slug>/<version>/starters/<language>.zip` (Deterministic starter repositories)
  - `workshops/<slug>/<version>/chapters/<chapterKey>/tests.tar.gz` (Deterministic test bundles + `manifest.json`)
- **Redis**: Caches GitHub App tokens (50m TTL) and learner access verification queries (60s TTL), invalidated reactively via RabbitMQ.

---

## 2. Step-by-Step: Adding a New Workshop

Use the built-in `handrail-author` CLI tool to scaffold your workshop.

### Step 2.1: Initialize the Workshop Root
Run the following from the root of the Handrail monorepo:

```bash
pnpm author new-workshop build-your-own-dns --languages go,python
```

This creates a directory `content/build-your-own-dns` with the following structure:
```
content/build-your-own-dns/
├── workshop.yaml
├── overview.md
└── starters/
    ├── go/
    │   ├── handrail.yaml
    │   ├── main.go
    │   └── run.sh
    └── python/
        ├── handrail.yaml
        ├── server.py
        └── run.sh
```

### Step 2.2: Configure `workshop.yaml`
Edit `workshop.yaml`:
```yaml
name: "Build your own DNS Server"
slug: "build-your-own-dns"
summary: "Understand UDP sockets and the binary DNS packet wire format from scratch."
difficulty: "intermediate"
estimatedTime: "3 hours"
languages:
  - "go"
  - "python"
prerequisites:
  - "Basic understanding of networking and byte streams"
limitations:
  - "Does not implement DNSSEC or recursive root server resolution"
whatWeBuild: "A DNS forwarding server that listens on UDP port 2053 and answers DNS queries."
whatYouLearn:
  - "UDP socket programming"
  - "Parsing 12-byte DNS headers"
  - "Encoding DNS question and answer records"
```

### Step 2.3: Write `overview.md`
Edit `overview.md`. It must contain all 5 standard headings:
```markdown
# Overview

## What we build
You will build a functional DNS server that receives UDP DNS query packets on port 2053, decodes the question, and returns standard DNS responses.

## What you will learn
- How UDP differs from TCP for low-latency protocols
- Binary bit-shifting and decoding DNS header flags (QR, Opcode, AA, TC, RD, RA, RCODE)
- Packaging binary response records

## Prerequisites
- Familiarity with Go or Python
- Basic command-line terminal navigation

## Limitations and scope
- This workshop implements iterative forwarding, not full iterative root-zone resolution.

## How this workshop works
You will work in your own local repository. Every step comes with automated unit tests and multi-level explanations.
```

### Step 2.4: Provide Clean Starter Code
In `starters/go/` and `starters/python/`, provide clean boilerplates that compile and run.
- `starters/go/handrail.yaml`:
  ```yaml
  language: go
  entrypoint: main.go
  run_command: "go run main.go"
  ```
- `starters/go/run.sh`:
  ```bash
  #!/bin/sh
  set -e
  exec go run main.go "$@"
  ```

> [!CAUTION]
> **Strict Allow-list Constraint**: Never place solution files, test runners, or `chapter.yaml` inside `starters/<lang>/`. The packaging service strictly inspects all files and will fail or strip any file mentioning `solution` or `tests/`.

---

## 3. Adding Chapters, Steps, and Tests

### Step 3.1: Initialize Git and Create `main`
```bash
cd content/build-your-own-dns
git init
git add .
git commit -m "feat: initial workshop root and starters on main"
```

### Step 3.2: Scaffold Chapter 1
Create your chapter branch using the CLI:
```bash
pnpm author new-chapter 01-dns-header --title "Parse DNS Header"
```
Or switch branches manually:
```bash
git checkout -b chapter/01-dns-header
```

### Step 3.3: Configure `handrail/chapter.yaml`
```yaml
id: "01-dns-header"
order: 1
title: "Parse DNS Header"
summary: "Bind UDP socket and decode the 12-byte DNS header."
estMinutes: 25
steps:
  - id: "udp-listen"
    title: "Bind UDP socket to port 2053"
    order: 1
    tests:
      - "test-udp-socket"
  - id: "decode-header"
    title: "Decode 12-byte DNS Header"
    order: 2
    tests:
      - "test-header-id"
      - "test-header-flags"
```

### Step 3.4: Author Multi-Level Content
In `handrail/content/`, write `beginner.md`, `intermediate.md`, and `expert.md`.
Each step requires a heading with an exact anchor ID `{#step-id}`, followed by `### Task` and `### Theory` (with optional `### Hints`):

```markdown
# Parse DNS Header

In this chapter, you will bind a UDP socket to port 2053 and parse the first 12 bytes of incoming DNS packets.

## Bind UDP socket to port 2053 {#udp-listen}

### Task
Create a UDP socket listening on `127.0.0.1:2053` and print a log message when ready.

### Theory
DNS queries predominantly use UDP rather than TCP because queries and responses are small, and connection handshakes add unnecessary latency.

### Hints
In Go, use `net.ListenUDP("udp", &net.UDPAddr{Port: 2053, IP: net.ParseIP("127.0.0.1")})`.
In Python, use `socket.socket(socket.AF_INET, socket.SOCK_DGRAM)`.

## Decode 12-byte DNS Header {#decode-header}

### Task
Read 12 bytes from the packet. Extract the 16-bit packet identifier and flags.

### Theory
A DNS header is always exactly 12 bytes (96 bits) long, structured into ID, flags, QDCOUNT, ANCOUNT, NSCOUNT, and ARCOUNT.

### Hints
Use binary unpacking (`binary.BigEndian.Uint16` in Go, `struct.unpack('!HHHHHH', buf[:12])` in Python).
```

### Step 3.5: Define Tests and Solutions
- Place test definitions in `handrail/tests/test.yaml`:
  ```yaml
  tests:
    - id: "test-udp-socket"
      description: "Verifies UDP port 2053 receives and echoes bytes"
      hidden: false
      timeout_seconds: 15
    - id: "test-header-id"
      description: "Checks that packet ID is preserved in response"
      hidden: false
      timeout_seconds: 15
    - id: "test-header-flags"
      description: "Validates QR bit is set to 1 in response"
      hidden: true
      timeout_seconds: 15
  ```
- Place reference solutions in `solutions/go/` and `solutions/python/`.

Commit the chapter branch:
```bash
git add .
git commit -m "feat(chapter-01): implement DNS header parsing exercises and tests"
```

Repeat this procedure for subsequent chapters (`chapter/02-question-section`, `chapter/03-forwarding`).

---

## 4. Authoring Validation & Content Linting

Before pushing to GitHub, always run the linter to verify compliance with all 12 validation rules:

```bash
pnpm author lint --all
```

### The 12 Rules Enforced:
1. `RULE-001` (`LEVEL_FILES_EXIST`): `beginner.md`, `intermediate.md`, and `expert.md` must all exist in `handrail/content/`.
2. `RULE-002` (`STEP_IDS_MATCH`): Every step ID declared in `chapter.yaml` must match a heading ID in markdown (`## Title {#step-id}`).
3. `RULE-003` (`STEP_SUBSECTIONS_PRESENT`): Every step must contain `### Task` and `### Theory`.
4. `RULE-004` (`STEP_TESTS_EXIST`): All test IDs referenced in steps must exist in `handrail/tests/test.yaml`.
5. `RULE-005` (`BRANCH_CHAPTER_MATCH`): The `id` in `chapter.yaml` must match the branch name (e.g. `chapter/01-ping` -> `id: "01-ping"`).
6. `RULE-006` (`WORKSHOP_BRANCHES_EXIST`): `main` branch must have valid `workshop.yaml` and `overview.md`.
7. `RULE-007` (`STARTER_HANDRAIL_EXISTS`): Every declared language must have `starters/<lang>/handrail.yaml`.
8. `RULE-008` (`CHAPTER_SOLUTIONS_EXIST`): Every chapter must have `solutions/<lang>/` for each declared language.
9. `RULE-009` (`IMAGES_VALID`): Images referenced via `![alt](path)` must exist and be <= 5MB.
10. `RULE-010` (`NO_RAW_HTML`): Raw HTML tags (like `<script>`, `<iframe>`) are strictly forbidden in markdown.
11. `RULE-011` (`HEADING_IDS_UNIQUE`): Heading IDs across a chapter must be unique.
12. `RULE-012` (`FILE_SIZE_LIMIT`): Markdown files must not exceed 500KB.

---

## 5. Git Push to GitHub & Ingest Pipeline

### 5.1 Push to GitHub
Push `main` and all chapter branches to your private GitHub repo:
```bash
git remote add origin git@github.com:handrail-workshops/build-your-own-dns.git
git push origin main
git push origin --all
```

### 5.2 Register Workshop in Catalog
Call the admin API to register the workshop:
```bash
curl -X POST http://localhost:4000/v1/admin/workshops \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "slug": "build-your-own-dns",
    "repoFullName": "handrail-workshops/build-your-own-dns",
    "access": "public",
    "installationId": "12345678"
  }'
```

### 5.3 Automated Ingest via GitHub Webhook
When code is pushed to GitHub, GitHub sends a `POST` webhook to:
```
POST https://api.handrail.dev/v1/github/content-webhook
Headers:
  x-hub-signature-256: sha256=d58c89f...
  x-github-delivery: 550e8400-e29b-41d4-a716-446655440000
  x-github-event: push
```

#### What happens during Ingest (under the hood):
1. **Signature Verification**: Validates HMAC SHA256 against `GITHUB_WEBHOOK_SECRET` using timing-safe comparisons.
2. **Delivery Deduplication**: Caches `x-github-delivery` in Redis for 24h with `NX`. Duplicates are discarded.
3. **Queue Enqueue**: Enqueues job to RabbitMQ queue `catalog.ingest.jobs` with prefetch `1`.
4. **Idempotency Check**: Resolves Git branch tips. If `(mainSha, chapterShas)` are identical to the current draft in PostgreSQL, the run completes immediately without re-uploading S3 files.
5. **Snapshot & Lint**: Parses trees into memory and runs the full 12-rule linter. If any error is found, the draft is marked `failed`, `lint_report_json` is stored, and artifacts are **not** created.
6. **Deterministic Packaging**:
   - `buildDeterministicZip`: Compresses `starters/<lang>/` -> `workshops/<slug>/draft/starters/<lang>.zip`.
   - `buildDeterministicTar`: Packages tests and attaches generated `manifest.json` -> `workshops/<slug>/draft/chapters/<chKey>/tests.tar.gz`.
7. **S3 Upload & Verification**: Uploads buffers to MinIO/S3 and verifies SHA256 matches.
8. **Atomic DB Transaction**: Replaces draft records in `catalog.workshop_versions`, `catalog.chapters`, `catalog.steps`, `catalog.step_contents`, and `catalog.artifacts`.

---

## 6. Promoting Draft to Published SemVer

Once the draft has been ingested with 0 lint errors, publish it using a SemVer tag (e.g. `1.0.0`):

```bash
curl -X POST http://localhost:4000/v1/admin/workshops/build-your-own-dns/versions/<DRAFT_VERSION_ID>/publish \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0.0",
    "releaseNotes": "Initial release of Build your own DNS Server workshop"
  }'
```

### What Happens During Publication:
1. **SemVer Validation**: Verifies `1.0.0` is valid SemVer and strictly greater than any previous version.
2. **Lint Gate**: Blocks publication if `lint_report_json` has any errors.
3. **S3 Artifact Promotion**: Copies S3 objects from `draft/` to `1.0.0/`:
   - `workshops/build-your-own-dns/draft/starters/go.zip` ➔ `workshops/build-your-own-dns/1.0.0/starters/go.zip`
   - `workshops/build-your-own-dns/draft/chapters/01-dns-header/tests.tar.gz` ➔ `workshops/build-your-own-dns/1.0.0/chapters/01-dns-header/tests.tar.gz`
4. **Pointer Advance**: Advances `workshop.latestPublishedId` to the newly published version.
5. **Event Emission**: Emits `catalog.workshop.published` event to RabbitMQ topic exchange `platform.events`.
6. **Audit Trail**: Records an immutable audit event in `catalog.audit_events`.

---

## 7. Inspecting Metrics: Storage Size, Chapters, Steps & Artifacts

### 7.1 Inspecting via Admin API

#### List All Workshops & Versions:
```bash
curl -s -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  http://localhost:4000/v1/admin/workshops | jq .
```
Response:
```json
[
  {
    "id": "ws-dns-123",
    "slug": "build-your-own-dns",
    "repoFullName": "handrail-workshops/build-your-own-dns",
    "access": "public",
    "status": "active",
    "latestPublishedId": "ver-pub-100",
    "versionsCount": 2,
    "createdAt": "2026-11-10T08:00:00.000Z"
  }
]
```

#### Inspect Version Artifacts & Chapter Counts:
```bash
curl -s -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  http://localhost:4000/v1/admin/workshops/build-your-own-dns/versions | jq .
```
Response:
```json
[
  {
    "id": "ver-pub-100",
    "version": "1.0.0",
    "kind": "published",
    "chaptersCount": 3,
    "artifactsCount": 5,
    "publishedAt": "2026-11-10T08:15:00.000Z"
  },
  {
    "id": "ver-draft-001",
    "version": "draft",
    "kind": "draft",
    "chaptersCount": 3,
    "artifactsCount": 5,
    "lintReport": {
      "valid": true,
      "errorCount": 0,
      "warningCount": 0
    }
  }
]
```

---

### 7.2 Inspecting via PostgreSQL Queries

To calculate exact storage sizes, chapter counts, and step counts across workshops, connect to PostgreSQL:

```bash
psql -U handrail -d handrail_db
```

#### Query 1: Total Workshops, Chapters, Steps & S3 Storage per Workshop
```sql
SELECT
  w.slug AS workshop_slug,
  wv.version AS latest_version,
  COUNT(DISTINCT c.id) AS total_chapters,
  COUNT(DISTINCT s.id) AS total_steps,
  COUNT(DISTINCT a.id) AS total_artifacts,
  pg_size_pretty(SUM(a.size)) AS total_storage_size,
  SUM(a.size) AS size_bytes
FROM catalog.workshops w
JOIN catalog.workshop_versions wv ON wv.id = w.latest_published_id
LEFT JOIN catalog.chapters c ON c.version_id = wv.id
LEFT JOIN catalog.steps s ON s.chapter_id = c.id
LEFT JOIN catalog.artifacts a ON a.version_id = wv.id
GROUP BY w.slug, wv.version;
```

*Example Output:*
| workshop_slug | latest_version | total_chapters | total_steps | total_artifacts | total_storage_size | size_bytes |
|---|---|---|---|---|---|---|
| `build-your-own-dns` | `1.0.0` | 3 | 6 | 5 | 185 kB | 189440 |
| `build-your-own-http-server` | `1.0.0` | 3 | 6 | 5 | 210 kB | 215040 |

#### Query 2: Detailed Breakdown of Each Artifact (Starters & Test Bundles)
```sql
SELECT
  w.slug AS workshop,
  wv.version,
  a.kind AS artifact_kind,
  COALESCE(a.language, c.chapter_key) AS target_identifier,
  a.storage_key,
  a.size AS size_bytes,
  pg_size_pretty(a.size) AS size_pretty,
  a.sha256
FROM catalog.artifacts a
JOIN catalog.workshop_versions wv ON wv.id = a.version_id
JOIN catalog.workshops w ON w.id = wv.workshop_id
LEFT JOIN catalog.chapters c ON c.id = a.chapter_id
WHERE wv.kind = 'published'
ORDER BY w.slug, a.kind, a.size DESC;
```

*Example Output:*
| workshop | version | artifact_kind | target_identifier | size_pretty | sha256 |
|---|---|---|---|---|---|
| `build-your-own-dns` | `1.0.0` | `starter_zip` | `go` | 42 kB | `7e1a...` |
| `build-your-own-dns` | `1.0.0` | `starter_zip` | `python` | 38 kB | `3b9f...` |
| `build-your-own-dns` | `1.0.0` | `test_bundle` | `01-dns-header` | 34 kB | `91ac...` |
| `build-your-own-dns` | `1.0.0` | `test_bundle` | `02-question-section` | 36 kB | `4fa0...` |
| `build-your-own-dns` | `1.0.0` | `test_bundle` | `03-forwarding` | 39 kB | `1e2c...` |

---

### 7.3 Direct Object Storage (MinIO) Inspection

Inspect the S3 bucket directly with AWS CLI or MinIO client (`mc`):

```bash
# Set credentials
export AWS_ACCESS_KEY_ID=minioadmin
export AWS_SECRET_ACCESS_KEY=minioadminpassword
export AWS_ENDPOINT_URL=http://localhost:9000

# List all objects in bucket
aws s3 ls s3://handrail-catalog/workshops/ --recursive --human-readable --summarize
```

*Output:*
```
2026-11-10 08:15:00   42.0 KiB workshops/build-your-own-dns/1.0.0/starters/go.zip
2026-11-10 08:15:00   38.0 KiB workshops/build-your-own-dns/1.0.0/starters/python.zip
2026-11-10 08:15:00   34.0 KiB workshops/build-your-own-dns/1.0.0/chapters/01-dns-header/tests.tar.gz
2026-11-10 08:15:00   36.0 KiB workshops/build-your-own-dns/1.0.0/chapters/02-question-section/tests.tar.gz
2026-11-10 08:15:00   39.0 KiB workshops/build-your-own-dns/1.0.0/chapters/03-forwarding/tests.tar.gz

Total Objects: 5
Total Size: 189.0 KiB
```

---

## 8. Version Pinning & Deprecation

### How Version Pinning Works in Practice
1. Learner visits `GET /v1/workshops/build-your-own-dns` and enrolls.
2. `profile-service` resolves the current `latestPublishedId` via internal API `GET /internal/workshops/:slug/resolve` and saves `versionId: "ver-pub-100"` in `profile_svc.enrollments`.
3. All subsequent requests by that learner:
   - `GET /v1/workshops/:slug/chapters/:chId`
   - `GET /v1/workshops/:slug/chapters/:chId/steps/:stepId`
   - `GET /v1/workshops/:slug/starter?language=go`
   resolve **strictly to the pinned `ver-pub-100` assets**, even if a newer `1.1.0` or `2.0.0` is published later.

### Deprecating an Obsolete Version
When a major release supersedes an old version:
```bash
curl -X POST http://localhost:4000/v1/admin/workshops/build-your-own-dns/deprecate \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "version": "1.0.0",
    "reason": "Superseded by 2.0.0 packet-parsing rewrite"
  }'
```

- **Effect on Public Discovery**: `1.0.0` is removed from public exploration. `latestPublishedId` advances to `2.0.0`.
- **Effect on Enrolled Learners**: Enrolled learners whose enrollment pins `1.0.0` **continue to access their exercises and starter downloads without disruption**. Their code checkpoints and tests will never break mid-workshop.
- **Audit Logging**: Recorded in `catalog.audit_events` with actor, version, and reason.

---

## 9. Complete End-to-End Walkthrough Cheatsheet

| Step | Action | Command / Payload |
|---|---|---|
| **1. Scaffold** | Scaffold workshop folder | `pnpm author new-workshop my-ws --languages go,python` |
| **2. Add Chapter** | Scaffold chapter branch | `pnpm author new-chapter 01-init --title "Init"` |
| **3. Lint** | Validate content & tests | `pnpm author lint --all` |
| **4. Push** | Push code to GitHub | `git push origin main && git push origin chapter/01-init` |
| **5. Register** | Register in Catalog | `POST /v1/admin/workshops` `{"slug": "my-ws", "repoFullName": "org/my-ws"}` |
| **6. Sync** | Enqueue manual sync | `POST /v1/admin/workshops/my-ws/sync` `{"force": true}` |
| **7. Verify Draft** | Check draft & lint | `GET /v1/admin/workshops/my-ws/versions` |
| **8. Publish** | Release SemVer `1.0.0` | `POST /v1/admin/workshops/my-ws/versions/:id/publish` `{"version": "1.0.0"}` |
| **9. Explore** | Public exploration | `GET /v1/workshops/my-ws` |
| **10. Download** | Get signed starter URL | `GET /v1/workshops/my-ws/starter?language=go` |
| **11. Test Bundle** | Internal test runner | `GET /internal/versions/:id/chapters/:chId/tests` (Service Token) |
| **12. Audit** | Query audit log | `GET /v1/admin/audit?subject=my-ws` |
