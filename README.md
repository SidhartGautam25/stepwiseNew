# Handrail 🛠️

> **A Guided Learn-by-Building Platform for Systems Engineers**  
> Work locally in your favorite editor. Push to GitHub for automated verification. Stream real-time feedback with adaptive depth levels.

---

## 📑 Table of Contents
1. [Overview & Philosophy](#-overview--philosophy)
2. [Key Differentiators](#-key-differentiators)
3. [Architecture & System Design](#-architecture--system-design)
4. [Monorepo Structure](#-monorepo-structure)
5. [Codebase Breakdown](#-codebase-breakdown)
6. [Getting Started (Development Options)](#-getting-started-development-options)
   - [Option A: Hybrid Local Development (Recommended)](#option-a-hybrid-local-development-recommended)
   - [Option B: Full Docker Compose Environment](#option-b-full-docker-compose-environment)
   - [Option C: Native / Standalone Local Setup](#option-c-native--standalone-local-setup)
7. [Service Ports & Endpoints Directory](#-service-ports--endpoints-directory)
8. [Testing & Verification](#-testing--verification)
9. [Content Model & Linter](#-content-model--linter)
10. [Milestones & Roadmap](#-milestones--roadmap)

---

## 🎯 Overview & Philosophy

**Handrail** is built for engineers who want to master real systems programming by implementing foundational software from scratch (such as building a Redis-compatible in-memory store, an HTTP server, a Git client, or a database engine).

Unlike browser-based learning playgrounds, Handrail adheres to the **local-first philosophy**:
- **Real Engineering Tooling**: You develop on your local machine using your favorite IDE (VS Code, Neovim, GoLand, PyCharm), using standard compilers, debuggers, and language servers.
- **Git Push Verification**: You push commits directly to GitHub. Pinned GitHub Actions workflows invoke our black-box test runner.
- **Server-Decided Verdicts**: Official test outcomes and step unlocks are evaluated by our backend, preventing client-side spoofing.
- **Real-Time Synchronized UI**: Step progression, test logs, and unlocking events are pushed live to the web browser via Server-Sent Events (SSE).

---

## ✨ Key Differentiators

| Feature | Handrail | Traditional Learning Platforms |
|---|---|---|
| **Development Environment** | **Local IDE & native terminal** | Browser-based sandbox / WebContainer |
| **Content Hierarchy** | **Workshop ➔ Chapters ➔ Steps** *(Never "course" or "challenge")* | Generic courses or exercises |
| **Content Depth** | **Adaptive 3-Level Depth** (`Beginner`, `Intermediate`, `Expert`) with live switching | Static single explanation |
| **Verification Model** | **GitHub Actions + Cryptographic OIDC verification** | Heavy server microVMs or client-side checks |
| **Language Freedom** | Starters tailored for multiple languages (`Go`, `Python`, etc.) | Often locked to JavaScript/Python |

---

## 🏛️ Architecture & System Design

Handrail is built as a high-performance TypeScript monorepo orchestrated with **Turborepo** and **pnpm workspaces**, backed by NestJS microservices, a Next.js 15 App Router web application, PostgreSQL with schema-level isolation, RabbitMQ, Redis, and MinIO.

```mermaid
flowchart TD
    subgraph Client["Learner Workstation"]
        LocalIDE["Local Editor (VS Code / Neovim)"]
        GitClient["Local Git"]
    end

    subgraph GitHubActions["GitHub Platform"]
        GHRepo["Learner's GitHub Repo"]
        GHActions["GitHub Actions Runner"]
        RunnerPkg["Go Test Runner (/tools/runner)"]
    end

    subgraph Edge["Perimeter & Ingress"]
        Web["Next.js Web Client (:3000)"]
        Gateway["API Gateway (:4000)\n• JWT Perimeter Validation\n• Rate Limiting\n• Correlation IDs\n• Unbuffered SSE Proxy"]
    end

    subgraph Services["Microservices (NestJS)"]
        CatalogSvc["catalog-service (:4001)\nSchema: catalog"]
        StarterSvc["starter-service (:4002)\nSchema: starter"]
        VerifySvc["verification-service (:4003)\nSchema: verification"]
        ProgressSvc["progress-service (:4004)\nSchema: progress"]
        RealtimeSvc["realtime-service (:4005)\nSSE Streaming"]
    end

    subgraph Backing["Infrastructure Services"]
        PG[(PostgreSQL 16\nDedicated Schemas)]
        RMQ{{RabbitMQ Event Bus}}
        RedisCache[(Redis 7\nPub/Sub & Throttling)]
        S3Bucket[(MinIO S3\nStarter Templates)]
    end

    LocalIDE -->|git push| GitClient
    GitClient -->|push main| GHRepo
    GHRepo -->|trigger workflow| GHActions
    GHActions -->|execute assertions| RunnerPkg
    RunnerPkg -->|POST /v1/verify/runs (OIDC)| Gateway

    Web -->|HTTP / REST| Gateway
    Web -.->|SSE Stream| Gateway

    Gateway --> CatalogSvc
    Gateway --> StarterSvc
    Gateway --> VerifySvc
    Gateway --> ProgressSvc
    Gateway --> RealtimeSvc

    CatalogSvc --> PG
    StarterSvc --> PG & S3Bucket
    VerifySvc --> PG & RMQ
    ProgressSvc --> PG & RMQ
    RealtimeSvc --> RedisCache

    VerifySvc -.->|emit run.completed| RMQ
    RMQ -.->|consume| ProgressSvc
    ProgressSvc -.->|emit step.unlocked| RMQ
    RMQ -.->|publish| RealtimeSvc
    RealtimeSvc -.->|SSE live update| Web
```

---

## 📂 Monorepo Structure

```
.
├── apps/
│   └── web/                     # Next.js 15 (App Router, Tailwind CSS, TanStack Query, Zustand)
├── services/
│   ├── api-gateway/             # Port 4000: Edge routing, JWT validation, SSE passthrough
│   ├── catalog-service/         # Port 4001: Workshops, chapters, steps & 3-level MDX content
│   ├── starter-service/         # Port 4002: Starter bundling and MinIO/S3 signed download URLs
│   ├── verification-service/    # Port 4003: GitHub OIDC token validation & run telemetry
│   ├── progress-service/        # Port 4004: User enrollment and sequential step unlocks
│   └── realtime-service/        # Port 4005: Redis pub/sub to SSE live event bridge
├── packages/
│   ├── contracts/               # Shared Zod schemas, TypeScript DTOs, event definitions
│   ├── auth/                    # Jose Supabase JWT verification (JWKS + HS256 fallback), NestJS guard
│   └── common/                  # Structured logger, correlation ID middleware, exception filters
├── content/                     # Workshop content repository (MDX, YAML, tests, starters)
│   └── build-your-own-redis/    # Sample workshop: 2 chapters, 4 steps in 3 levels (Go & Python)
├── tools/
│   ├── content-linter/          # Content validator (enforces 3 levels, tests, sequential order)
│   └── runner/                  # Go black-box test runner package (for actions & phase 2 CLI)
├── infra/
│   ├── docker-compose.yml       # Local PostgreSQL, RabbitMQ, Redis, MinIO orchestration
│   └── init-db.sql              # Database schema initialization script
└── docs/
    ├── architecture.md          # Complete architectural specification
    ├── assumptions.md           # Log of baseline architectural assumptions
    └── adr/                     # Architecture Decision Records (ADRs 0001 - 0006)
```

---

## 🔍 Codebase Breakdown

### 1. `apps/web` (Frontend Web Application)
- **Framework**: Next.js 15 with App Router, TypeScript, and Tailwind CSS.
- **Hook-Based Architecture**: UI components do not handle data fetching or state management. All logic is encapsulated in custom hooks (`useWorkshops`, `useWorkshopOverview`, `useStepDetail`, `useLevelPreference`).
- **Centralized Configuration**:
  - `src/config/api.config.ts`: Base URLs, route mappings, and header keys.
  - `src/config/query-keys.ts`: TanStack Query key factory.
  - `src/config/content-levels.ts`: Metadata and badge definitions for depth levels.
  - `src/config/site.ts`: Centralized application branding (`PRODUCT_NAME = 'Handrail'`).
- **Atomic Reusable Design System**:
  - `components/ui/Button`: Standardized button with variants (`primary`, `secondary`, `outline`, `ghost`, `danger`, `emerald`), sizes, and loading spinners.
  - `components/ui/Badge`, `Card`, `Tabs`, `Skeleton`.
- **Live Depth Switcher**:
  - Persisted in client storage (`localStorage` via Zustand) with per-workshop overrides.
  - The step detail page prefetches all 3 levels (`beginner`, `intermediate`, `expert`), allowing instant content and theory swapping without page reloads.

### 2. `services/api-gateway`
- Acts as the single perimeter ingress for frontend and runner traffic.
- Validates Supabase JWTs at the boundary using `jose`.
- Injects verified user identity headers (`x-user-id`, `x-user-email`) into internal service requests.
- Implements token-bucket rate limiting via `@nestjs/throttler`.
- Configured with unbuffered SSE pass-through headers (`X-Accel-Buffering: no`, `Cache-Control: no-cache`) to ensure live streaming events are never buffered.

### 3. `services/catalog-service`
- Manages the workshop content catalog stored in PostgreSQL schema `catalog`.
- Isolated Prisma client (`src/generated/client`) avoiding multi-service monorepo conflicts.
- Ingestion endpoint: `POST /internal/content/sync` (secured by CI `x-internal-token`) to load filesystem content into PostgreSQL.
- Public APIs:
  - `GET /v1/workshops`: Catalog list with metadata and total steps.
  - `GET /v1/workshops/:slug`: Complete overview, what we build, what you learn, prerequisites, limitations, and syllabus.
  - `GET /v1/workshops/:slug/steps/:stepSlug?level=`: Step task, theory, hints, acceptance tests, and all-level content bundles.

### 4. `services/starter-service`
- Packages starter template archives (`starters/<language>`) with `handrail.yaml` and `.github/workflows/verify.yml`.
- Uploads archives to MinIO/S3 object storage and generates signed, short-lived download URLs for enrolled learners.

### 5. `services/verification-service`
- Handles GitHub repository links (`repo_links`).
- Validates GitHub Actions OIDC tokens against `https://token.actions.githubusercontent.com`.
- Issues test bundles and nonces for `POST /v1/verify/runs`.
- Computes server-side pass/fail verdicts on `POST /v1/verify/runs/:id/result`.
- Enforces single-use `(run_id, run_attempt)` replay protection.

### 6. `services/progress-service`
- Manages learner enrollments: `(user_id, workshop_id, language)`.
- Tracks step states: `LOCKED`, `AVAILABLE`, `COMPLETED`.
- Enforces strict sequential unlocking via `global_order` across chapters.

### 7. `services/realtime-service`
- Subscribes to Redis channels for test run and step progression events.
- Serves SSE connections at `GET /v1/realtime/events`.
- Broadcasts real-time events (`run.queued`, `run.started`, `run.passed`, `run.failed`, `step.unlocked`).

### 8. `packages/contracts`, `packages/auth`, and `packages/common`
- `@app/contracts`: Zod schemas, TypeScript DTOs, and event payloads shared between web and backend.
- `@app/auth`: Dual-mode Supabase JWT validation using asymmetric JWKS keys with HS256 secret fallback, `@CurrentUser()` parameter decorator, and `JwtAuthGuard`.
- `@app/common`: Correlation ID tracking (`x-correlation-id`), structured JSON logging, standard exception filters, and health indicators.

---

## 🚀 Getting Started (Development Options)

You can run Handrail locally using any of the three workflows below.

### Prerequisites
- **Node.js**: v20 or v22+
- **pnpm**: v10+ (`npm install -g pnpm`)
- **Docker & Docker Compose**: (for backing infrastructure)
- **Git**

---

### Option A: Hybrid Local Development (Recommended)
*Run backing databases and queues in Docker, while running NestJS microservices and Next.js locally for fast hot-reloading and debugging.*

#### 1. Clone the repository & create environment file
```bash
git clone https://github.com/your-username/stepwsie.git
cd stepwsie

# Create your local .env file from the reference template
cp .env.example .env
```

#### 2. Start backing services with Docker Compose
```bash
docker compose -f infra/docker-compose.yml up -d
```
*This starts PostgreSQL 16 (creating schemas `catalog`, `starter`, `verification`, `progress`), RabbitMQ (with management UI), Redis 7, and MinIO.*

#### 3. Install monorepo dependencies
```bash
pnpm install
```

#### 4. Generate isolated Prisma clients & run migrations
```bash
pnpm --filter catalog-service run prisma:generate
pnpm --filter starter-service run prisma:generate
pnpm --filter verification-service run prisma:generate
pnpm --filter progress-service run prisma:generate

# Apply migrations to your local Postgres schemas
pnpm --filter catalog-service prisma migrate dev --name init
pnpm --filter starter-service prisma migrate dev --name init
pnpm --filter verification-service prisma migrate dev --name init
pnpm --filter progress-service prisma migrate dev --name init
```

#### 5. Sync workshop content into the catalog database
```bash
# Ingest the sample workshop (/content/build-your-own-redis) into PostgreSQL
curl -X POST http://localhost:4001/internal/content/sync \
  -H "Content-Type: application/json" \
  -H "x-internal-token: dev_internal_sync_token_secret"
```

#### 6. Start all services and the web app in parallel
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to view the application.

---

### Option B: Full Docker Compose Environment
*Run the entire platform including all microservices and web application inside containers.*

```bash
# Start all infrastructure and application services
docker compose -f infra/docker-compose.yml up -d --build

# View logs
docker compose -f infra/docker-compose.yml logs -f
```

---

### Option C: Native / Standalone Local Setup
*If you already have PostgreSQL, Redis, and RabbitMQ installed on your host machine without Docker.*

1. **Configure Postgres**:
   Create a database named `handrail_db` and initialize schemas:
   ```sql
   CREATE SCHEMA IF NOT EXISTS catalog;
   CREATE SCHEMA IF NOT EXISTS starter;
   CREATE SCHEMA IF NOT EXISTS verification;
   CREATE SCHEMA IF NOT EXISTS progress;
   ```
2. **Update `.env`**:
   Adjust `DATABASE_URL_*`, `REDIS_URL`, and `RABBITMQ_URL` in `.env` to match your local credentials.
3. **Run Commands**:
   ```bash
   pnpm install
   pnpm build
   pnpm dev
   ```

---

## 🌐 Service Ports & Endpoints Directory

| Service | Port | Base URL | Swagger / OpenAPI Docs | Purpose |
|---|---|---|---|---|
| **Web Frontend** | `3000` | `http://localhost:3000` | N/A | Next.js Learner Portal |
| **API Gateway** | `4000` | `http://localhost:4000` | `http://localhost:4000/api/docs` | Edge routing, JWT validation, SSE passthrough |
| **Catalog Service** | `4001` | `http://localhost:4001` | `http://localhost:4001/api/docs` | Workshop & step content catalog |
| **Starter Service** | `4002` | `http://localhost:4002` | `http://localhost:4002/api/docs` | Starter templates & signed S3 downloads |
| **Verification Service** | `4003` | `http://localhost:4003` | `http://localhost:4003/api/docs` | GitHub OIDC evaluation & test coordination |
| **Progress Service** | `4004` | `http://localhost:4004` | `http://localhost:4004/api/docs` | User enrollments & step progression |
| **Realtime Service** | `4005` | `http://localhost:4005` | `http://localhost:4005/api/docs` | SSE live stream (`/v1/realtime/events`) |
| **PostgreSQL 16** | `5432` | `localhost:5432` | N/A | Database (`handrail_db`) |
| **RabbitMQ Admin** | `15672` | `http://localhost:15672` | UI: `handrail` / `handrail_password` | AMQP Management Console |
| **MinIO Console** | `9001` | `http://localhost:9001` | UI: `minioadmin` / `minioadminpassword` | S3 Object Storage Console |

---

## 🧪 Testing & Verification

Handrail maintains strict test suites across all packages and services:

```bash
# Run all unit and integration tests across the monorepo
pnpm test

# Run tests for a specific package or service
pnpm --filter @app/contracts test
pnpm --filter @app/auth test
pnpm --filter @app/common test
pnpm --filter api-gateway test
pnpm --filter catalog-service test

# Run the content linter on the content repository
pnpm lint:content
```

---

## 📚 Content Model & Linter

Every workshop resides under `/content/<workshop-slug>`:

```
content/build-your-own-redis/
├── workshop.yaml                              # Title, summary, prerequisites, limitations, languages
├── overview.mdx                               # Workshop introduction page
├── chapters/
│   ├── 01-tcp-handshake/
│   │   ├── chapter.yaml                       # Chapter title & order index
│   │   └── steps/
│   │       ├── 01-bind-port/
│   │       │   ├── step.yaml                  # Title, global_order, test definitions
│   │       │   ├── task.beginner.mdx          # Beginner task walkthrough
│   │       │   ├── task.intermediate.mdx      # Intermediate task specification
│   │       │   ├── task.expert.mdx            # Expert terse specification
│   │       │   ├── theory.beginner.mdx        # Beginner conceptual breakdown
│   │       │   ├── theory.intermediate.mdx    # Intermediate protocol nuances
│   │       │   ├── theory.expert.mdx          # Expert RFC reference
│   │       │   ├── hints.*.mdx                # Optional level-specific hints
│   │       │   └── tests/                     # Test definitions
│   │       └── 02-respond-ping/
│   └── 02-storage-engine/
│       ├── 03-set-get-commands/
│       └── 04-expiry-ttl/
└── starters/
    ├── go/                                    # Go starter template
    └── python/                                # Python starter template
```

### The Content Linter (`pnpm lint:content`)
The linter strictly enforces:
1. Every step must contain valid MDX files for **all 3 levels** (`task.{beginner,intermediate,expert}.mdx` and `theory.{beginner,intermediate,expert}.mdx`).
2. Every step must have at least one test defined in `step.yaml` or `tests/`.
3. `global_order` must be sequential without gaps across all chapters (e.g. 1, 2, 3, 4...).

---

## 🗺️ Milestones & Roadmap

- [x] **Milestone 1: Foundation**
  - Turborepo + pnpm monorepo structure.
  - Multi-schema PostgreSQL, RabbitMQ, Redis, MinIO via Docker Compose.
  - End-to-end Supabase authentication with JWKS and fallback HS256 validation.
  - Perimeter API Gateway with protected `GET /v1/me`.
  - Structured logging with correlation IDs and OpenAPI documentation.
- [x] **Milestone 2: Content & Learning UI**
  - Content hierarchy schema (`Workshop -> Chapter -> Step -> StepContent`).
  - Sample workshop: *Build Your Own Redis* (2 chapters, 4 steps in 3 levels).
  - Content linting engine with automated unit tests (`pnpm lint:content`).
  - Hook-based frontend design and atomic UI component library (`Button`, `Badge`, `Card`, `Tabs`, `Skeleton`).
  - Interactive learning pages (`/workshops`, `/workshops/[workshop]`, `/steps/[step]`) with live level switching.
- [ ] **Milestone 3: Starters & Enrollment**
  - User enrollment endpoint (`POST /workshops/:slug/enroll`).
  - Starter packaging and signed S3 URLs in `starter-service`.
  - Step progression initialization in `progress-service`.
- [ ] **Milestone 4: Verification Pipeline & Go Runner**
  - Pinned reusable GitHub Actions verification workflow.
  - Strict GitHub OIDC token validation in `verification-service`.
  - Black-box Go test runner package under `/tools/runner`.
  - Real-time SSE feedback stream and automated step progression unlocking.
- [ ] **Phase 2 (Future): Go Cobra CLI**
  - Standalone binary wrapping `/tools/runner` for offline local testing (`handrail test`).
