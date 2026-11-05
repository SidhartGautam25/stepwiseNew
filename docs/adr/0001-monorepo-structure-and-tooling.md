# ADR 0001: Monorepo Structure and Tooling

## Status
Accepted

## Context
Handrail requires multiple NestJS microservices (`api-gateway`, `catalog-service`, `starter-service`, `verification-service`, `progress-service`, `realtime-service`), a Next.js web application, shared packages (`contracts`, `auth`, `common`), content definitions, and test tooling.
We need strict dependency isolation, fast incremental builds, and type sharing without publishing npm packages.

## Decision
1. We choose **pnpm workspaces** as the package manager and **Turborepo** as the monorepo build system.
2. Package naming uses neutral `@app/*` scopes (`@app/contracts`, `@app/auth`, `@app/common`).
3. Services are placed under `/services/*` and applications under `/apps/*`.
4. TypeScript project references and shared tsconfig bases ensure tight type safety and contract compilation across services.

## Consequences
- Fast install speeds and atomic package management.
- Turborepo pipelines orchestrate linting, testing, and building in topological order with caching.
- Product rebranding is simplified by not using company/brand names in package scopes.

