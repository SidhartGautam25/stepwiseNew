# Assumptions & Ambiguities Log

This document records architectural, product, and implementation decisions made in the absence of explicit specifications, or clarifying baseline assumptions.

| ID | Topic | Decision / Assumption | Rationale |
|---|---|---|---|
| ASSUMP-001 | Supabase JWKS URL | Defaults to `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`. If not reachable or secret provided, falls back to HS256 secret verification using `SUPABASE_JWT_SECRET`. | Ensures compatibility with both modern Supabase instances using asymmetric keys and local/legacy setups using HS256. |
| ASSUMP-002 | PostgreSQL Schemas | One logical PostgreSQL database with dedicated schemas per service: `catalog`, `starter`, `verification`, `progress`. | Simulates microservice database boundaries while remaining lightweight and cost-effective in local Docker Compose. |
| ASSUMP-003 | Default Branch Verification | Verification requests from GitHub Actions only accept pushes to default branch (`refs/heads/main` or `refs/heads/master`). | Prevents side-branch cheating or submitting runs that are not on the primary development line. |
| ASSUMP-004 | Pinned Reusable Workflow | The reusable GitHub Actions workflow is identified by a pinned ref (e.g. `owner/handrail-verify/.github/workflows/verify.yml@v1`). | Guaranteed by `job_workflow_ref` claim in GitHub OIDC token to prevent tampering with test execution scripts. |
| ASSUMP-005 | Level Switcher Persistence | The learner's chosen depth level (`beginner`, `intermediate`, `expert`) is persisted globally in client storage (`localStorage` via Zustand) with an optional per-workshop override. | Learners generally have an overall experience preference, but may want deeper guidance on unfamiliar topics. |
| ASSUMP-006 | Step Progression Model | Strict sequential unlocking via `global_order` across all chapters. When step $N$ passes, step $N+1$ shifts from `LOCKED` to `AVAILABLE`. Learners cannot skip ahead. | Matches the core learn-by-building pedagogy where later steps depend directly on artifacts built in earlier steps. |
| ASSUMP-007 | Neutral Scopes & Naming | All shared libraries use `@app/*` (`@app/contracts`, `@app/auth`, `@app/common`). Brand strings are centralized in a single configuration constant `PRODUCT_NAME = "Handrail"`. | Allows white-labeling or rebranding without refactoring package imports or domain models. |

