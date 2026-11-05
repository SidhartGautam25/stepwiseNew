# ADR 0003: Microservice Architecture and Schema Separation

## Status
Accepted

## Context
Handrail operates as a set of bounded-context microservices:
- `api-gateway`
- `catalog-service`
- `starter-service`
- `verification-service`
- `progress-service`
- `realtime-service`

We need database isolation per microservice to prevent accidental coupling and maintain bounded contexts, while avoiding the overhead of running 5 separate database servers in local development.

## Decision
1. In PostgreSQL, we allocate a distinct schema for each service:
   - `catalog` for catalog-service
   - `starter` for starter-service
   - `verification` for verification-service
   - `progress` for progress-service
2. Each service maintains its own Prisma schema (`prisma/schema.prisma`) configuring its specific schema search path (e.g. `DATABASE_URL="postgresql://...?schema=catalog"`).
3. Cross-service data updates (such as a run completion triggering step unlocking) use asynchronous RabbitMQ events instead of direct cross-schema SQL joins.

## Consequences
- Clean logical boundaries and decoupled migrations.
- Single database container for development, easily split into separate cloud databases for production if needed.

