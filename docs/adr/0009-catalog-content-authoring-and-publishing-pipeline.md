# ADR 0009: Catalog Content Authoring, Pipeline, and Service Separation

## Status
Accepted

## Context
Handrail requires a scalable, maintainable content authoring and publishing system for systems programming workshops. Previous iterations considered multi-branch three-way merges, marker-based scaffolding derivation, and per-chapter starter archive distribution. 

These earlier approaches had significant downsides:
1. High runtime operational complexity (needing persistent merge workers and complex merge failure handling).
2. Risk of leaking future chapter solutions or tests to learners.
3. Tight coupling between content delivery, progress tracking, and verification.

We need a clean, decoupled architecture where:
- Content authors work naturally in Git/VS Code with branch chains.
- Publishing produces immutable, disposable artifacts in object storage (MinIO/S3) and structured text in PostgreSQL.
- Learners get a single persistent repository starter per language.
- Catalog service holds zero user or progress data.
- Profile service governs access policies, while catalog enforces gating and fails closed.

## Decision
1. **GitHub-Centric Branch-Per-Chapter Authoring**:
   - Each workshop lives in a dedicated repository.
   - The `main` branch contains workshop metadata (`workshop.yaml`), high-level narrative (`overview.md`), and language starter projects (`starters/<lang>/`).
   - Each chapter lives on a dedicated branch `chapter/<chapterId>`, branching sequentially from the prior chapter so reference code accumulates naturally.
   - Chapter content is stored in `handrail/content/{beginner,intermediate,expert}.md`, tests in `handrail/tests/<testId>/test.yaml`, and reference solutions in `solutions/<lang>/`.

2. **Publishing and Ingest Pipeline**:
   - The publisher reads the repository independently per branch tip (not relying on Git ancestry).
   - Validation occurs locally via author CLI (`handrail-author lint`) and at the catalog ingest gate. Any lint failure aborts the publishing process.
   - Artifacts (starter zips, test bundles, assets) are packaged deterministically and stored in S3/MinIO. Metadata and markdown are written to PostgreSQL schema `catalog` in a single transaction.
   - Once published, a version is immutable and nothing reads from GitHub for that version.

3. **Single Starter Zip Model**:
   - Learners receive one starter archive per workshop and language upon enrollment.
   - Subsequent chapters are delivered strictly as instructions (markdown) and black-box verification tests. Solutions are never delivered to the client.

4. **Service Boundary Separation & Identity Keys**:
   - Catalog service stores **no user data** (no enrollments, no progress, no user IDs).
   - Profile service owns enrollments, version pinning, and access evaluation (`chapterId in passedChapterIds || chapterId == currentChapterId`).
   - Verification service executes tests and determines verdicts.
   - Cross-service references use stable string keys (`workshopSlug`, `versionId`, `chapterId`, `stepId`), never foreign keys across service databases.
   - Gated catalog endpoints check access via `AccessPolicyPort` (cached in Redis for 30s) and **fail closed (503)** if the profile service is unreachable.

5. **Shared `@app/content-core` Package**:
   - Content schemas (Zod), markdown parsers (Remark/Unified), sanitization, deterministic packagers, and lint rules are maintained in a pure TypeScript package (`packages/content-core`) shared between the author CLI (`tools/author`) and the catalog service.

## Consequences
- **Positive**: Low operational overhead (no merge workers, no continuous branch syncing), zero runtime GitHub dependency, zero user data in catalog, high security and tamper-resistance.
- **Negative**: Authors must manually or via `handrail-author cascade` propagate fixes from an earlier chapter to subsequent chapter branches.
