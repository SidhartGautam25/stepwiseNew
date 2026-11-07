# Handrail Authentication Architecture & Developer Guide

This document is the comprehensive, end-to-end reference for authentication and identity management in the Handrail platform. It explains the design principles, the exact flow of data, how each component communicates with GoTrue (Supabase Auth) and PostgreSQL, how asynchronous microservices synchronize profile data via RabbitMQ, and how the Next.js frontend interacts securely with the backend.

---

## Table of Contents

1. [Architectural Overview & Core Principles](#1-architectural-overview--core-principles)
2. [High-Level System Architecture Diagram](#2-high-level-system-architecture-diagram)
3. [The Auth Database & Engine (Supabase / GoTrue)](#3-the-auth-database--engine-supabase--gotrue)
4. [Auth Service (`auth-service`) In-Depth](#4-auth-service-auth-service-in-depth)
   - [Supabase Adapter & Custom Fetch Engine](#supabase-adapter--custom-fetch-engine)
   - [PKCE Secret Extraction & Cookie Packaging](#pkce-secret-extraction--cookie-packaging)
   - [Session Management & Cookie Strategy](#session-management--cookie-strategy)
5. [Cross-Service Interaction: Transactional Outbox & Profile Service](#5-cross-service-interaction-transactional-outbox--profile-service)
   - [Why Transactional Outbox?](#why-transactional-outbox)
   - [RabbitMQ Routing & Dead-Letter Exchanges](#rabbitmq-routing--dead-letter-exchanges)
   - [Idempotent Profile Provisioning & JIT Fallback](#idempotent-profile-provisioning--jit-fallback)
6. [Frontend Architecture (`apps/web`) In-Depth](#6-frontend-architecture-appsweb-in-depth)
   - [Zero-Supabase-in-Frontend Rule](#zero-supabase-in-frontend-rule)
   - [HttpOnly Security Model: What the Browser vs. Application Stores](#httponly-security-model-what-the-browser-vs-application-stores)
   - [TanStack Query Session Cache & Proactive Refresh](#tanstack-query-session-cache--proactive-refresh)
   - [Single-Flight Interceptor with Concurrent Queueing](#single-flight-interceptor-with-concurrent-queueing)
7. [Step-by-Step Flow Diagrams](#7-step-by-step-flow-diagrams)
   - [Flow A: GitHub OAuth with PKCE End-to-End](#flow-a-github-oauth-with-pkce-end-to-end)
   - [Flow B: Email & Password Signup / Login](#flow-b-email--password-signup--login)
   - [Flow C: Token Refresh & Session Renewal](#flow-c-token-refresh--session-renewal)
8. [Codebase Reference Directory](#8-codebase-reference-directory)

---

## 1. Architectural Overview & Core Principles

Authentication in Handrail is designed around four foundational security and architectural tenets:

1. **Backend-for-Frontend (BFF) Pattern**:
   The web application (`apps/web`) **never** talks directly to authentication databases or third-party identity providers. All auth operations route through the **API Gateway** (`http://localhost:4000`) to the dedicated **Auth Service** (`services/auth-service`).
2. **Zero Client-Side Token Exposure (HttpOnly Cookies)**:
   JWT access tokens and refresh tokens are stored in **HttpOnly, SameSite=Lax** cookies. Client-side JavaScript has zero access to token strings (`window.__token` or `localStorage.getItem('token')` do not exist). This eliminates Cross-Site Scripting (XSS) credential theft.
3. **Defense-in-Depth Against CSRF**:
   Mutating authentication endpoints require a custom header (`X-Requested-With: handrail`). Because standard cross-site HTML form submissions cannot attach custom headers, cross-site request forgery attacks are rejected at the gateway.
4. **Resilient Asynchronous Identity Sync (Transactional Outbox)**:
   Creating an account in Auth and setting up user profile records in downstream services (e.g. `profile-service`) is completely decoupled. Auth commits user data and an outbox record in a single local database transaction; an asynchronous worker reliably publishes the event to RabbitMQ.

---

## 2. High-Level System Architecture Diagram

```mermaid
flowchart TD
    subgraph Browser ["Client Browser (Next.js 15)"]
        UI["React UI (Pages / Forms)"]
        AuthCtx["AuthContext & TanStack Query"]
        FetchClient["apiFetch Client"]
        Cookies["Browser Cookie Jar\n- hr_at (HttpOnly, /)\n- hr_rt (HttpOnly, /v1/auth)\n- hr_pkce (HttpOnly, /v1/auth/oauth)"]
    end

    subgraph Gateway ["API Gateway (:4000)"]
        APIGateway["NestJS API Gateway\nProxy, Rate Limiter, CORS"]
    end

    subgraph CoreServices ["Backend Services"]
        AuthSvc["Auth Service (:4006)\nNestJS + Prisma\nCookie Manager & PKCE Handler"]
        ProfileSvc["Profile Service (:4007)\nNestJS + Prisma\nProfile Repository & JIT Provisioner"]
    end

    subgraph IdentityEngine ["Supabase / GoTrue (:54321)"]
        GoTrue["supabase/gotrue:v2.164.0\nOAuth Engine, Token Issuer, Argon2/Bcrypt"]
    end

    subgraph ExternalAuth ["External Identity Provider"]
        GitHub["GitHub OAuth API\n(github.com)"]
    end

    subgraph StorageBroker ["Storage & Message Broker"]
        Postgres[("PostgreSQL (:5432)\nhandrail_db\n- schema: auth\n- schema: auth_svc\n- schema: profile_svc")]
        RabbitMQ{{"RabbitMQ (:5672)\nExchange: platform.events\nQueue: profile-service.auth-events"}}
    end

    UI -->|"1. User Action"| AuthCtx
    AuthCtx -->|"2. API Call"| FetchClient
    FetchClient <-->|"3. Auto Cookie Attachment"| Cookies
    FetchClient -->|"4. /v1/auth/* (Credentials: include)"| APIGateway
    APIGateway -->|"5. Reverse Proxy"| AuthSvc

    AuthSvc <-->|"6. OAuth PKCE / Token RPC"| GoTrue
    GoTrue <-->|"7. Authorize / Redirect"| GitHub
    GoTrue <-->|"8. Read/Write Auth Tables"| Postgres

    AuthSvc -->|"9. Write user & outbox event"| Postgres
    AuthSvc -->|"10. Publish event (auth.user.registered)"| RabbitMQ
    RabbitMQ -->|"11. Consume event"| ProfileSvc
    ProfileSvc -->|"12. Upsert user profile"| Postgres

    GoTrue -.->|"Reads/Writes"| Postgres
```

---

## 3. The Auth Database & Engine (Supabase / GoTrue)

### What GoTrue Is
GoTrue (`supabase/gotrue:v2.164.0`) is the open-source authentication server written in Go that powers Supabase. In Handrail, it runs as an isolated, containerized microservice:

- **Container Name**: `handrail-auth`
- **Internal Port**: `9999`
- **Host Port**: `54321` (`http://localhost:54321`)
- **Database Driver**: PostgreSQL
- **Connection URL**: `postgres://handrail:handrail_password@postgres:5432/handrail_db?search_path=auth`

### GoTrue PostgreSQL Schema (`auth`)
GoTrue maintains its own dedicated schema (`auth`) inside `handrail_db`. It manages the following core tables:

| Table | Purpose |
|---|---|
| `auth.users` | Stores user credentials: `id` (UUID), `email`, `encrypted_password`, `raw_user_meta_data`, `raw_app_meta_data`, `created_at`. |
| `auth.identities` | Maps authentication providers to users (e.g. `provider = 'github'`, `provider_id = '12345678'`). Enables linking multiple OAuth providers to a single email. |
| `auth.sessions` | Tracks active refresh sessions and device fingerprints. |
| `auth.refresh_tokens` | Stores hashed refresh tokens with rotation timestamps and revocation status. |
| `auth.flow_state` | Stores transient state for OAuth PKCE flows (e.g. `auth_code`, `code_challenge`, `code_challenge_method`). |
| `auth.audit_log_entries` | Internal GoTrue security log (sign-ins, password resets, token grants). |

### Standalone Endpoints Exposed by GoTrue
When accessed directly or via the internal network, GoTrue exposes:
- `GET /authorize?provider={provider}&redirect_to={url}&code_challenge={hash}&code_challenge_method=s256`: Starts OAuth flow.
- `GET /callback`: Handles the redirect from external identity providers (e.g. GitHub).
- `POST /token?grant_type=authorization_code`: Exchanges the authorization code and PKCE verifier for a JWT session.
- `POST /token?grant_type=password`: Authenticates email/password credentials and issues a JWT session.
- `POST /token?grant_type=refresh_token`: Rotates an existing refresh token and generates a fresh access token.
- `POST /signup`: Registers a new user.
- `POST /logout`: Revokes an active session.
- `GET /user`: Inspects the currently authenticated user from a Bearer access token.

---

## 4. Auth Service (`auth-service`) In-Depth

The Handrail **Auth Service** (`services/auth-service`) acts as the intermediary between the frontend, the GoTrue auth engine, and Handrail's private business tables.

### Supabase Adapter & Custom Fetch Engine
File: `services/auth-service/src/supabase/supabase-client.service.ts`

Standard `@supabase/supabase-js` expects a Supabase API gateway (Kong) where endpoints are prefixed with `/auth/v1/`. However, standalone GoTrue runs directly at the root (`/`). 

To bridge this without breaking official SDK typings and mechanisms, Handrail implements a custom fetch adapter:

```typescript
function createSupabaseFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    let urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    
    // Normalize Kong route prefix '/auth/v1/*' to standalone GoTrue root '/*'
    if (urlStr.includes('/auth/v1/')) {
      urlStr = urlStr.replace('/auth/v1/', '/');
      return fetch(urlStr, init);
    }
    return fetch(input, init);
  };
}
```

This ensures calls like `supabase.auth.signInWithPassword()` hit `http://localhost:54321/token?grant_type=password` without 404 errors.

### PKCE Secret Extraction & Cookie Packaging
File: `services/auth-service/src/auth.service.ts`

In OAuth 2.0 with Proof Key for Code Exchange (PKCE), an unforgeable cryptographic secret (`code_verifier`) is generated on the server and hashed (`code_challenge`) for the authorization request.

Because `auth-service` runs statelessly across multiple instances, it does not keep in-memory state between the authorization redirect and the callback:
1. `auth.service.ts` initializes `@supabase/supabase-js` with an isolated, temporary `MapStorageAdapter`.
2. When `supabase.auth.signInWithOAuth()` is called with `flowType: 'pkce'`, the SDK writes the 128-character verifier into this storage adapter under `*-code-verifier`.
3. `auth-service` extracts this verifier, packages it into a strongly typed data structure (`PkceCookieData`), and sets it as an encrypted, HttpOnly cookie (`hr_pkce`).
4. When GitHub redirects back to `/v1/auth/oauth/callback`, `auth-service` reads `hr_pkce`, re-injects the verifier into the storage adapter, and calls `supabase.auth.exchangeCodeForSession(authCode)`.

### Session Management & Cookie Strategy
File: `services/auth-service/src/utils/cookie.util.ts`

Handrail issues three discrete cookies to enforce the principle of least privilege:

```typescript
export function setAuthCookies(res: Response, session: AuthCookieSession) {
  // 1. Access Token Cookie
  res.cookie('hr_at', session.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: session.expiresIn * 1000, // typically 1 hour (3600s)
  });

  // 2. Refresh Token Cookie (Path-restricted to auth endpoints)
  res.cookie('hr_rt', session.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/v1/auth',
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  });
}
```

- **`hr_at`**: Sent on every API request. Verified by `SupabaseJwtVerifier` across all microservices using the shared JWT Secret or JWKS endpoint.
- **`hr_rt`**: Restricted to `Path: /v1/auth`. The browser **never** sends this cookie to catalog, progress, or verification services—only to `/v1/auth/refresh` or `/v1/auth/logout`.
- **`hr_pkce`**: Restricted to `Path: /v1/auth/oauth`. Discarded (`Max-Age: 0`) immediately once the OAuth exchange finishes.

---

## 5. Cross-Service Interaction: Transactional Outbox & Profile Service

When a user signs up or logs in for the first time via GitHub, downstream domains (like `profile-service`) must initialize their own records.

```mermaid
sequenceDiagram
    autonumber
    participant Client as Frontend / Browser
    participant Auth as Auth Service (:4006)
    participant AuthDB as PostgreSQL (auth_svc)
    participant OutboxWorker as OutboxPublisherService
    participant Rabbit as RabbitMQ (platform.events)
    participant Profile as Profile Service (:4007)
    participant ProfileDB as PostgreSQL (profile_svc)

    Client->>Auth: POST /v1/auth/signup (or OAuth Callback)
    Auth->>AuthDB: BEGIN TRANSACTION
    Auth->>AuthDB: INSERT INTO auth_svc.users (...)
    Auth->>AuthDB: INSERT INTO auth_svc.outbox_events (type: 'auth.user.registered')
    Auth->>AuthDB: COMMIT TRANSACTION
    Auth-->>Client: 200 OK + Set-Cookie (hr_at, hr_rt)

    Note over OutboxWorker,AuthDB: Polling Loop (every 500ms)
    OutboxWorker->>AuthDB: SELECT * FROM outbox_events WHERE publishedAt IS NULL LIMIT 25
    AuthDB-->>OutboxWorker: [Event: auth.user.registered]
    OutboxWorker->>Rabbit: publishEvent('auth.user.registered', envelope)
    Rabbit-->>OutboxWorker: Publisher Confirm (ACK)
    OutboxWorker->>AuthDB: UPDATE outbox_events SET publishedAt = NOW()

    Note over Profile,Rabbit: RabbitMQ Consumer (profile-service.auth-events)
    Rabbit->>Profile: Deliver message (auth.user.registered)
    Profile->>ProfileDB: UPSERT profile_svc.profiles (userId, email, defaults)
    Profile->>ProfileDB: INSERT INTO profile_svc.activities (ACCOUNT_REGISTERED)
    Profile-->>Rabbit: channel.ack(msg)
```

### Why Transactional Outbox?
Files: 
- `services/auth-service/src/outbox/outbox-publisher.service.ts`
- `services/auth-service/src/outbox/rabbitmq-publisher.service.ts`

Directly publishing a network message to RabbitMQ inside an HTTP request handler has severe failure modes:
1. If the database commit succeeds but RabbitMQ is temporarily unreachable, the user is registered in Auth, but the profile service never hears about them (data drift).
2. If RabbitMQ succeeds but the database transaction rolls back due to a constraint error, other services initialize data for a non-existent user (ghost data).

By writing the `outbox_event` inside the **same database transaction** that creates the local user record:
- The event is guaranteed to persist if and only if the user creation persists.
- The `OutboxPublisherService` background poller reliably picks up unpublished events, sends them to RabbitMQ, awaits publisher confirmation, and marks them `publishedAt = NOW()`.

### RabbitMQ Routing & Dead-Letter Exchanges
File: `services/profile-service/src/events/auth-event-consumer.service.ts`

- **Exchange**: `platform.events` (`topic`, durable)
- **Dead-Letter Exchange (DLX)**: `platform.events.dlx` (`topic`, durable)
- **Queue**: `profile-service.auth-events` (durable)
- **Routing Key**: `auth.user.registered`

If an unrecoverable poison message arrives, `AuthEventConsumerService` calls `channel.nack(msg, false, false)`, routing the message directly to the DLX for administrator inspection without crashing the consumer.

### Idempotent Profile Provisioning & JIT Fallback
File: `services/profile-service/src/profile/profile.service.ts`

What happens if a user signs up and is instantly redirected to `/dashboard` before the 500ms RabbitMQ outbox loop executes?

Handrail implements **Just-In-Time (JIT) Lazy Provisioning**:
1. When `/dashboard` calls `GET /v1/profiles/me`, `ProfileService.getProfile(userId)` checks the database.
2. If the profile already exists (the event arrived), it returns it.
3. If the profile does not exist yet, it provisions the default profile immediately on demand:
   ```typescript
   if (!profile) {
     this.logger.log(`Profile for user [${userId}] not found. Executing JIT lazy provisioning...`);
     profile = await this.repository.upsert(userId, {
       userId,
       email: fallbackEmail,
       displayName: fallbackEmail ? fallbackEmail.split('@')[0] : 'Learner',
       defaultLevel: 'beginner',
       defaultLanguage: 'typescript',
       theme: 'dark',
     });
   }
   ```
4. When the RabbitMQ event arrives moments later, `repository.upsert` updates the record idempotently. This eliminates any race-condition 404 errors.

---

## 6. Frontend Architecture (`apps/web`) In-Depth

### Zero-Supabase-in-Frontend Rule
The frontend project (`apps/web`) contains zero Supabase SDK dependencies. This is statically verified by `tools/check-no-supabase.ts` during CI:
- **Why**: Keeps frontend bundle size minimal, prevents leaking database URLs or service keys to the client, and ensures business logic (cookies, audit logs, rate limits, profile syncing) is strictly enforced on the server.

### HttpOnly Security Model: What the Browser vs. Application Stores
When an authentication request completes:

| Storage Location | What is Stored | Who Can Access It |
|---|---|---|
| **Browser Cookie Jar** | `hr_at` (JWT)<br>`hr_rt` (Refresh Token)<br>`hr_pkce` (PKCE State) | **Browser Network Layer Only**.<br>`document.cookie` cannot read or modify them. |
| **React State (`AuthContext`)** | `user` object: `{ id, email, displayName, roles }`<br>`status`: `'authenticated'`<br>`token`: `null` | **React Components** (for rendering user avatars, navigation items, role-based controls). |
| **TanStack Query Cache** | Query `['auth', 'session']` | React tree via `useQuery` / `useAuth`. |

### TanStack Query Session Cache & Proactive Refresh
File: `apps/web/src/context/auth-context.tsx`

`AuthProvider` maintains session status in memory:
1. On initial page load, it queries `GET /v1/auth/me`.
2. The endpoint reads the `hr_at` cookie and returns user metadata.
3. `AuthProvider` calculates the token expiration time and starts a client-side timer.
4. **Proactive Refresh**: Exactly 60 seconds before `hr_at` expires, the timer automatically invokes `executeSingleFlightRefresh()` to rotate the session silently in the background without user interruption.

### Single-Flight Interceptor with Concurrent Queueing
File: `apps/web/src/utils/auth/client.ts`

If a token expires while the user is inactive and they return to a page that makes multiple simultaneous API calls (e.g. fetching user profile, courses, and notifications at the same time), standard fetch clients would send 3 separate refresh requests. This would cause token reuse errors due to refresh token rotation.

Handrail solves this with **Single-Flight Refresh Locking**:

```typescript
let singleFlightRefreshPromise: Promise<boolean> | null = null;

export async function executeSingleFlightRefresh(): Promise<boolean> {
  // If a refresh is already in flight, reuse the exact same promise!
  if (singleFlightRefreshPromise) {
    return singleFlightRefreshPromise;
  }

  singleFlightRefreshPromise = (async () => {
    try {
      const response = await fetch(`${baseUrl}/v1/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE,
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      singleFlightRefreshPromise = null;
    }
  })();

  return singleFlightRefreshPromise;
}
```

Inside `apiFetch()`, if an endpoint returns `401 Unauthorized`:
1. It pauses execution and awaits `executeSingleFlightRefresh()`.
2. All concurrent requests wait on that single promise.
3. Once the promise resolves, every waiting request replays its original call exactly once with the newly issued cookie.

---

## 7. Step-by-Step Flow Diagrams

### Flow A: GitHub OAuth with PKCE End-to-End

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Browser as Client Browser
    participant Gateway as API Gateway (:4000)
    participant AuthSvc as Auth Service (:4006)
    participant GoTrue as GoTrue (:54321)
    participant GitHub as GitHub OAuth
    participant Rabbit as RabbitMQ
    participant Profile as Profile Service

    User->>Browser: Click "Continue with GitHub"
    Browser->>Gateway: GET /v1/auth/oauth/github/start?next=/dashboard
    Gateway->>AuthSvc: Proxy request
    
    AuthSvc->>AuthSvc: Generate PKCE (code_verifier + challenge)
    AuthSvc-->>Gateway: 302 Redirect to GoTrue /authorize<br>Set-Cookie: hr_pkce (HttpOnly)
    Gateway-->>Browser: 302 Redirect + Set-Cookie: hr_pkce
    
    Browser->>GoTrue: GET /authorize?provider=github&code_challenge=...
    GoTrue-->>Browser: 302 Redirect to https://github.com/login/oauth/authorize
    
    Browser->>GitHub: GET /login/oauth/authorize?client_id=...
    User->>GitHub: Approve Authorization
    GitHub-->>Browser: 302 Redirect to GoTrue callback?code=gh_code
    
    Browser->>GoTrue: GET /callback?code=gh_code
    GoTrue->>GitHub: Exchange gh_code for GitHub Access Token
    GitHub-->>GoTrue: GitHub Access Token + User Info
    GoTrue->>GoTrue: Upsert user in auth.users & auth.identities
    GoTrue-->>Browser: 302 Redirect to Gateway /v1/auth/oauth/callback?code=gt_code
    
    Browser->>Gateway: GET /v1/auth/oauth/callback?code=gt_code<br>Cookie: hr_pkce
    Gateway->>AuthSvc: Proxy request with hr_pkce
    
    AuthSvc->>GoTrue: POST /token?grant_type=authorization_code<br>(code: gt_code, verifier: hr_pkce.verifier)
    GoTrue-->>AuthSvc: 200 OK (access_token, refresh_token, user)
    
    AuthSvc->>AuthSvc: Record OutboxEvent (auth.user.registered)
    AuthSvc-->>Gateway: 302 Redirect to /dashboard<br>Set-Cookie: hr_at, hr_rt<br>Clear-Cookie: hr_pkce
    Gateway-->>Browser: 302 Redirect + Cookies
    
    par Async Profile Sync
        AuthSvc->>Rabbit: Publish auth.user.registered
        Rabbit->>Profile: Consume auth.user.registered
        Profile->>Profile: Provision user profile
    and Page Load
        Browser->>Gateway: GET /v1/auth/me (Cookie: hr_at)
        Gateway->>AuthSvc: Verify JWT & return user
        AuthSvc-->>Browser: 200 OK { id, email, roles }
        Browser->>Browser: Render /dashboard
    end
```

### Flow B: Email & Password Signup / Login

```mermaid
sequenceDiagram
    autonumber
    actor User as User
    participant Browser as Web Browser
    participant Gateway as API Gateway (:4000)
    participant AuthSvc as Auth Service (:4006)
    participant GoTrue as GoTrue (:54321)

    User->>Browser: Fill Email & Password -> Submit
    Browser->>Gateway: POST /v1/auth/login<br>Header: X-Requested-With: handrail<br>Body: { email, password }
    Gateway->>AuthSvc: Proxy request
    
    AuthSvc->>GoTrue: POST /token?grant_type=password<br>{ email, password }
    
    alt Invalid Credentials
        GoTrue-->>AuthSvc: 400 Bad Request (Invalid credentials)
        AuthSvc-->>Gateway: 401 Unauthorized
        Gateway-->>Browser: 401 { code: "INVALID_CREDENTIALS" }
        Browser->>User: Display "Invalid email or password"
    else Valid Credentials
        GoTrue-->>AuthSvc: 200 OK { access_token, refresh_token, user }
        AuthSvc->>AuthSvc: Audit log: USER_LOGGED_IN
        AuthSvc-->>Gateway: 200 OK { user: { id, email, roles } }<br>Set-Cookie: hr_at (Expires in 1h)<br>Set-Cookie: hr_rt (Expires in 30d)
        Gateway-->>Browser: 200 OK + Cookies
        Browser->>Browser: Update React AuthContext state
        Browser->>Browser: Navigate to /dashboard
    end
```

### Flow C: Token Refresh & Session Renewal

```mermaid
sequenceDiagram
    autonumber
    participant Browser as Web Browser
    participant Gateway as API Gateway (:4000)
    participant AuthSvc as Auth Service (:4006)
    participant GoTrue as GoTrue (:54321)

    Note over Browser: Token expired (or 60s before expiry)
    Browser->>Gateway: POST /v1/auth/refresh<br>Cookie: hr_rt<br>Header: X-Requested-With: handrail
    Gateway->>AuthSvc: Proxy request with hr_rt
    
    AuthSvc->>GoTrue: POST /token?grant_type=refresh_token<br>{ refresh_token: hr_rt }
    
    alt Refresh Token Revoked / Expired
        GoTrue-->>AuthSvc: 400 Bad Request
        AuthSvc-->>Gateway: 401 Unauthorized<br>Clear-Cookie: hr_at, hr_rt
        Gateway-->>Browser: 401 Unauthorized
        Browser->>Browser: Clear AuthContext -> Redirect to /login
    else Token Rotated Successfully
        GoTrue-->>AuthSvc: 200 OK { access_token, new_refresh_token }
        AuthSvc-->>Gateway: 200 OK<br>Set-Cookie: hr_at (new)<br>Set-Cookie: hr_rt (rotated)
        Gateway-->>Browser: 200 OK + New Cookies
        Browser->>Browser: Resume any queued in-flight requests
    end
```

---

## 8. Codebase Reference Directory

Key files implementing this architecture:

```
stepwsie/
├── infra/
│   ├── docker-compose.yml              # Supabase/GoTrue container definition & port mappings
│   ├── init-db.sql                     # Postgres roles (handrail, postgres) & schemas
│   └── .env                            # Docker Compose environment fallback
├── packages/
│   ├── auth/                           # Shared NestJS authentication library
│   │   ├── src/guards/jwt-auth.guard.ts       # Route guard for endpoints requiring auth
│   │   ├── src/guards/roles.guard.ts          # RBAC guard (@Roles('admin', 'instructor'))
│   │   └── src/supabase-jwt-verifier.service.ts # JWKS & Secret JWT verification engine
│   └── contracts/                      # Shared event contracts & DTOs
│       ├── src/events/auth-events.ts          # UserRegisteredV1 event payload schema
│       └── src/constants.ts                   # CSRF header constants (X-Requested-With)
├── services/
│   ├── auth-service/                   # Core Auth Microservice
│   │   ├── src/auth.controller.ts             # Public endpoints (/v1/auth/*)
│   │   ├── src/auth.service.ts                # PKCE generation, signup, callback logic
│   │   ├── src/supabase/supabase-client.service.ts # Custom GoTrue fetch engine
│   │   ├── src/utils/cookie.util.ts           # hr_at, hr_rt cookie packaging
│   │   ├── src/utils/oauth.util.ts            # hr_pkce serialization & parsing
│   │   └── src/outbox/                        # Transactional Outbox publisher loop
│   └── profile-service/                # User Profile Microservice
│       ├── src/events/auth-event-consumer.service.ts # RabbitMQ consumer on platform.events
│       └── src/profile/profile.service.ts     # Idempotent profile creator & JIT provisioning
└── apps/
    ├── api-gateway/                    # API Gateway & Reverse Proxy
    │   └── src/app.module.ts                  # Reverse proxy routes (/v1/auth -> auth-service)
    └── web/                            # Next.js 15 Web Application
        ├── src/context/auth-context.tsx       # AuthProvider, TanStack Query session, timer
        ├── src/utils/auth/client.ts           # apiFetch, single-flight refresh interceptor
        ├── src/utils/auth/routes.ts           # Safe redirect validator
        └── src/app/(auth)/                    # Next.js Login & Signup pages
```
