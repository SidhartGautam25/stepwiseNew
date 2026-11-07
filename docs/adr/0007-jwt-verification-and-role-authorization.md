# ADR 0007: Strict JWT Verification and Role-Based Authorization

## Status
Accepted (Supersedes ADR 0002)

## Context
Handrail uses Supabase Auth as its external identity provider. Browser and API clients receive Supabase session JSON Web Tokens (JWTs). In a distributed zero-trust microservice architecture, API Gateway and downstream services must independently verify identity and authorization without making synchronous network calls to Supabase on every request.

Previous designs allowed loose verification paths, relied on symmetric shared secrets by default, or inspected the top-level `"role"` claim. This introduced several security risks:
1. **Algorithm Confusion Attacks**: Accepting symmetric HMAC (HS256) and asymmetric RSA/ECDSA (RS256/ES256) interchangeably allows attackers to sign counterfeit tokens using the public key as an HMAC secret.
2. **Privilege Escalation**: In Supabase JWTs, the top-level `"role"` claim designates the internal PostgreSQL database role (`"authenticated"` or `"anon"`), not the application's user permissions. The `"user_metadata"` claim is user-editable and can be manipulated by malicious users unless strictly guarded by RLS or custom database triggers.
3. **Key Rotation & Distributed Verification**: Relying strictly on a shared symmetric secret (`SUPABASE_JWT_SECRET`) prevents seamless key rotation and forces distribution of a highly sensitive master secret to every microservice.

## Decision

1. **Verification Engine (`jose`) & Key Strategy**:
   - Verification is powered by the `jose` library.
   - The primary verification path uses remote JWKS fetched from `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` with in-memory caching and automatic key rotation via `createRemoteJWKSet`.
   - Symmetric verification (`HS256` with `SUPABASE_JWT_SECRET`) is supported strictly as an opt-in fallback for local offline development.
   - **No Algorithm Confusion**: The JWKS verification path explicitly enforces an allowlist of asymmetric algorithms (`['RS256', 'ES256']`). Under no circumstances is `HS256` or `none` accepted on the JWKS path.

2. **Claims Validation & Tolerances**:
   - Every token must possess a valid issuer (`iss`), matching the configured Supabase issuer URL `${SUPABASE_URL}/auth/v1`.
   - The audience (`aud`) claim must explicitly equal `"authenticated"`.
   - Expiration (`exp`) and not-before (`nbf`) claims are enforced with a maximum clock skew tolerance of 30 seconds.
   - The subject (`sub`) claim must strictly conform to a UUID format (validated via standard RFC 4122 regex).

3. **Role & Privilege Resolution**:
   - Platform roles (e.g., `admin`, `moderator`, `learner`) are extracted **strictly and exclusively** from `payload.app_metadata.roles` (an array of strings).
   - Under no circumstances is the top-level `"role"` claim used for application authorization (it is merely the PostgreSQL role `"authenticated"`).
   - The `"user_metadata"` claim is treated as untrusted user profile data and is never consulted for authorization.

4. **Defense in Depth**:
   - The API Gateway verifies the token at the edge, checks the Redis revocation denylist, and converts verified cookie sessions into `Authorization: Bearer <token>` headers.
   - Downstream services (e.g., `profile-service`, `catalog-service`) register global `JwtAuthGuard` and `RolesGuard` providers from `@app/auth` to locally re-verify the token. Downstream services never blindly trust forwarded `x-user-*` headers.

## Consequences

### Positive
- **Cryptographic Security**: Precludes algorithm confusion, forged signatures, and token replay past the 30-second skew tolerance.
- **Immunity to Metadata Tampering**: Sourcing authorization strictly from `app_metadata.roles` ensures learners cannot self-assign elevated roles.
- **High Performance**: Asymmetric verification uses cached keys without network I/O to Supabase during steady state.
- **Zero-Trust Resilience**: Downstream services verify tokens locally, ensuring internal perimeter breaches do not compromise authentication.

### Negative / Trade-offs
- Downstream services must have network egress to `${SUPABASE_URL}/auth/v1/.well-known/jwks.json` or mount the cached keys in air-gapped test environments.
- Fallback symmetric secrets must be explicitly disabled in production deployments.
