# ADR 0008: Transactional Outbox Pattern and RabbitMQ Event Bus Architecture

## Status
Accepted

## Context
When a user signs up or signs in for the first time via Supabase Auth, Handrail must initialize application state across distributed services:
1. `auth-service` creates a record in its local `auth_svc.user_account` table.
2. `profile-service` must create an associated learner profile (`display_name`, `default_level`, `default_language`, `avatar_url`).
3. Future consumers may listen for telemetry, billing, or welcome notification workflows.

Performing direct synchronous HTTP calls between microservices creates tight coupling, cascading latency, and partial failure states (e.g., user account created in auth-service, but profile creation fails due to network timeout). Furthermore, writing to the database and publishing directly to a message broker within the same transaction constitutes an unsafe "dual-write" where database rollbacks leave orphan messages in the broker, or broker network errors abort successful user registrations.

## Evaluation: NestJS Built-in RMQ Transport vs. `@golevelup/nestjs-rabbitmq`

We evaluated Nest's built-in microservice transport (`@nestjs/microservices` with `Transport.RMQ`) against `@golevelup/nestjs-rabbitmq`:

| Feature | NestJS `@nestjs/microservices` (RMQ) | `@golevelup/nestjs-rabbitmq` |
| :--- | :--- | :--- |
| **Messaging Paradigm** | Point-to-point RPC request/response oriented | Topic/Pub-Sub event broadcast oriented |
| **AMQP Topology Control** | Primitive; creates ad-hoc queues with single binding | Declarative topic exchanges, routing keys, and durable queue bindings |
| **Dead Lettering (DLQ)** | Manual broker setup required | Declarative Dead Letter Exchanges (`.dlx`) and dead-letter routing keys |
| **Publisher Confirms** | Not enabled natively in standard client | Native support for AMQP publisher confirms (`publish` returns confirmation) |
| **Standard AMQP Envelopes** | Wraps payloads in Nest-specific `{ pattern, data, id }` JSON frames | Clean arbitrary AMQP payload serialization |
| **Backoff & Requeue** | Primitive requeue | Granular error handling, nack/reject with backoff |

**Evaluation Verdict**:
Nest's built-in microservice transport is designed primarily for RPC-style request-reply across queues and does not natively support enterprise event-driven architectures requiring topic exchange fan-out, declarative dead-letter queues, publisher confirms, and unencumbered payload envelopes.

## Decision

1. **Transactional Outbox in `auth-service`**:
   - `auth-service` maintains an `auth_svc.outbox_event` table in PostgreSQL.
   - When a user signs in for the first time and a `user_account` record is created, the `auth.user.registered` event is inserted into `outbox_event` within the **same atomic database transaction**.
   - A dedicated background publisher polls unpublished outbox events, dispatches them to RabbitMQ with **publisher confirms**, and marks them published upon broker acknowledgment.
   - This guarantees **at-least-once delivery** without dual-write inconsistency.

2. **Standard Event Envelope & Contracts**:
   - All events adhere to a standard envelope defined in `@app/contracts`:
     ```typescript
     export interface EventEnvelope<T = unknown> {
       eventId: string;        // UUID v4
       type: string;           // e.g., 'auth.user.registered'
       version: string;        // e.g., 'v1'
       occurredAt: string;     // ISO 8601
       correlationId: string;  // Trace ID from gateway
       data: T;
     }
     ```
   - Payload for `auth.user.registered`:
     ```typescript
     export interface UserRegisteredV1 {
       userId: string;         // Supabase UUID
       email: string;
       displayName?: string;
       provider: string;       // e.g., 'email', 'github'
     }
     ```
   - **No Sensitive Tokens**: Authentication tokens (JWTs, refresh tokens, passwords) are strictly forbidden inside event payloads.

3. **Broker Topology & `@app/events` Wrapper**:
   - We utilize `@golevelup/nestjs-rabbitmq` wrapped within an internal `@app/events` package.
   - **Exchange**: Topic exchange named `platform.events` (durable).
   - **Dead Letter Exchange**: `platform.events.dlx` (durable).
   - **Routing Key**: `auth.user.registered`.
   - **Queues**: Durable, named per consumer service (e.g., `profile-service.auth-events`).
   - Consumer queues bind to `platform.events` on their respective routing keys and configure dead-letter exchange `platform.events.dlx`.

4. **Idempotency Invariant**:
   - Because outbox delivery is at-least-once, consumers may receive duplicate events.
   - Consumers (starting with `profile-service`) must guarantee idempotent handling:
     1. Primary Key Deduplication: User profiles are keyed on `user_id` as primary key (upsert rather than naive insert).
     2. Processed Event Deduplication: Optional event ID store or monotonic check.
     3. JIT Fallback: If `GET /v1/me` is called before the asynchronous event processes, `profile-service` lazily creates the default profile.

## Consequences

### Positive
- **Guaranteed Consistency**: Zero risk of dual-write failures. If the database commit succeeds, the event is guaranteed to be published.
- **Loose Coupling**: `auth-service` has zero knowledge of `profile-service` or downstream subscribers.
- **Enterprise Reliability**: RabbitMQ publisher confirms ensure messages are safely persisted to disk before being cleared from the outbox. DLQ ensures poisoned messages do not block queues.

### Negative / Trade-offs
- Small polling latency (100ms - 500ms) between database commit and broker publication.
- Requires managing outbox table retention (pruning published events after a retention window).
