# ADR 0002: Authentication with Supabase, JWKS, and Gateway Validation

## Status
Accepted

## Context
Handrail uses Supabase for user authentication (Email and GitHub OAuth). Web clients receive Supabase session JWTs.
The backend microservices need to verify user identity securely without querying the Supabase database or auth API on every HTTP request.

## Decision
1. In Next.js, the Supabase client handles authentication and token refresh, exposing user sessions via a React Context provider.
2. The `api-gateway` intercepts incoming requests, extracts the `Authorization: Bearer <token>` header, and validates the token.
3. Verification is performed using `jose` with `createRemoteJWKSet` pointing to `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`.
4. If JWKS retrieval fails or an explicit HS256 secret is configured, fallback HS256 verification using `jwtVerify` with the secret is executed.
5. Upon successful validation, the gateway injects trusted headers (`x-user-id`, `x-user-email`) into the downstream request.
6. Individual microservices also run `@app/auth` guards to ensure zero-trust defense-in-depth and support direct invocations where applicable. Client-provided user IDs in request bodies are forbidden and ignored.

## Consequences
- Asymmetric key validation allows instant verification with zero network roundtrips to Supabase for most requests after the key set is cached.
- Fallback allows seamless local offline testing with symmetric keys.
- Gateway and service guards share identical verification logic via `@app/auth`.

