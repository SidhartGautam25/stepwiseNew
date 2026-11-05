# ADR 0005: GitHub Actions Verification Pipeline and Go Runner

## Status
Accepted

## Context
Code execution platforms often rely on heavy, costly in-browser sandbox infrastructure (Firecracker microVMs, WebContainers). Learners prefer writing in their local IDEs with their native tooling and LSP.
We need secure, scalable, and tamper-resistant verification.

## Decision
1. Learners push their code to a linked GitHub repository.
2. A pinned, immutable GitHub Actions reusable workflow runs on the push event.
3. The workflow obtains a GitHub OIDC token and calls `POST /v1/verify/runs` on `verification-service`.
4. `verification-service` validates the OIDC token claims (repository, branch, workflow reference, audience), issues a run session with test requirements and a randomized nonce.
5. The standalone Go runner executes declarative black-box tests against the learner's locally spawned process (TCP/HTTP/stdio).
6. The test runner submits telemetry to `POST /v1/verify/runs/:id/result`.
7. `verification-service` strictly computes pass/fail verdict on the server, commits the attempt, publishes events over RabbitMQ, and returns the verdict to the runner, which prints it in the GitHub Action log.
8. The runner is structured as a Go package under `/tools/runner` ready to be wrapped by a Phase 2 Go Cobra CLI.

## Consequences
- Zero server compute overhead for compiling or executing learner code.
- OIDC tokens cryptographic binding prevents spoofing.
- Server-side verdict computation prevents runner client manipulation.

