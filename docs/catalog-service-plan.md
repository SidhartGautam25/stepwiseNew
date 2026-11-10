# Catalog Service Plan (simple model)

Authoritative design for catalog-service. Save it in the repo as `docs/catalog-service-plan.md`; the agent prompt refers to it.

---

## 1. Model in one paragraph

Content is authored in **GitHub** (one private repo per workshop, one branch per chapter). On **publish**, catalog-service reads the repo through a read-only GitHub App and stores **derived, disposable artifacts** in S3-compatible storage (starter zips, test bundles, assets) and rendered content in Postgres. Learners get **one starter zip per workshop and language, once**. After that they work in their own GitHub repo, which keeps growing. Chapters are delivered as **content and tests, never as code**. Passing a chapter unlocks the next chapter's content and tests. This mirrors how CodeCrafters works: a learner repo that persists, instructions revealed per stage, tests run on push.

What this removes from the earlier plan: per-chapter starter zips, the three-way merge worker and queue, marker-based stub derivation, and the "advance" flow. They stay as an optional future feature (section 14) if a workshop ever needs new scaffolding in later chapters.

---

## 2. Responsibilities (who owns what)

| Question | Answered by |
|---|---|
| What workshops, chapters and steps exist? Their text at each level? | **catalog** |
| What are the starter files? What tests belong to chapter N? | **catalog** |
| Which published version is current? | **catalog** |
| Which workshops is this user enrolled in, on which version and language? | **profile** |
| What chapters/steps has this user passed? What is their current chapter? | **profile** |
| Can this user open chapter 3's content or download the starter? | **profile decides, catalog enforces** |
| Which workshops may this user enroll in (free/paid/entitlement)? | **profile** (policy), using the workshop's `access` tag from catalog |
| What did this user do and when (activity, attempts history)? | **profile** |
| Did this push pass? (OIDC check, running the tests, verdict) | **verification-service** |
| Authenticate every request and route it | **gateway** (identity from **auth-service**) |

Catalog stores **no user data at all**. Profile stores **no content** (no markdown, no test files, no structure beyond keys). Verification stores run/attempt records for its own audit and emits results.

Note on "tests managed by catalog": catalog owns the **test definitions** as content (they are authored in the same repo and published like everything else). The **verdict** comes from verification-service, which fetches the test bundle from catalog, runs the check, and emits the result; **profile** records it.

---

## 3. How the services interact

### 3.1 Identity keys (so services stay independent)

Profile and verification never hold foreign keys into catalog's database. They store stable **keys**:

`workshopSlug`, `version` (semver) and `versionId`, `chapterId`, `stepId`.

`chapterId` and `stepId` are the ids written in `chapter.yaml` (for example `bind-port`, `accept-connection`) and are stable across versions unless the author deliberately changes them.

### 3.2 Flows

**Publish**
```
Author pushes to GitHub ─► webhook ─► catalog (draft snapshot, lint report)
Admin clicks Publish v1.2.0 ─► catalog freezes it as published ─► event catalog.workshop.published
```

**Enroll** (profile owns the enrollment)
```
Web ─► gateway ─► profile  POST /v1/enrollments {workshopSlug, language}
profile ─► catalog (service token)  GET /internal/workshops/{slug}/resolve
           ← { versionId, version, languages, access, chapters:[{id, steps:[{id}]}] }
profile: checks entitlement + language, creates enrollment pinned to versionId,
         creates progress rows (first chapter current), emits profile.enrollment.created
```

**Open content / download starter** (catalog enforces, profile decides)
```
Web ─► gateway ─► catalog  GET /v1/workshops/{slug}/chapters/{chapterId}?level=beginner
catalog ─► profile (service token, cached 30 s)  GET /internal/access/users/{userId}/workshops/{slug}
           ← { enrolled, versionId, language, currentChapterId, passedChapterIds[] }
catalog: allow iff enrolled and chapterId ∈ passed ∪ {current}; serve content of the PINNED versionId
```
If profile is unreachable, gated endpoints return 503 (fail closed). Public endpoints are unaffected.

**Verify and update progress** (GitHub Actions)
```
GitHub Actions ─► verification (OIDC)
verification ─► profile  GET /internal/users/{userId}/workshops/{slug}/current   (which chapter, which versionId)
verification ─► catalog  GET /internal/versions/{versionId}/chapters/{chapterId}/tests  (signed URL + required test ids per step)
verification: runs/validates, decides verdict
verification ─► RabbitMQ  verification.result.recorded
profile consumes: updates step progress; if all steps of the chapter passed, marks chapter passed
                  and makes the next chapter current; emits profile.step.passed / profile.chapter.passed
catalog consumes profile.* events ONLY to invalidate its access cache (no state kept)
web ◄─ SSE from profile (live status)
```

### 3.3 Internal API contracts (defined in `@app/contracts`, zod)

| Provider | Endpoint (service token, not routable by the gateway) | Used by | Scope |
|---|---|---|---|
| catalog | `GET /internal/workshops/:slug/resolve` | profile | `catalog:read` |
| catalog | `GET /internal/versions/:versionId/structure` | profile (initialize or reconcile progress) | `catalog:read` |
| catalog | `GET /internal/versions/:versionId/chapters/:chapterId/tests` | verification | `catalog:tests:read` |
| profile | `GET /internal/access/users/:userId/workshops/:slug` | catalog | `profile:access:read` |
| profile | `GET /internal/users/:userId/workshops/:slug/current` | verification | `profile:progress:read` |

Response shapes (names in contracts): `WorkshopResolveV1`, `VersionStructureV1`, `TestBundleRefV1` (`{ url, sha256, size, expiresAt, steps:[{stepId, tests:[{id, hidden}]}] }`), `AccessCheckV1`, `CurrentChapterV1`.

### 3.4 Events (RabbitMQ topic exchange `platform.events`)

| Event | Producer | Consumers | Purpose |
|---|---|---|---|
| `catalog.workshop.published` | catalog | web revalidation hook (later), profile (optional "update available") | new version live |
| `verification.result.recorded` | verification | profile | per-step results, commit sha, verdict |
| `profile.enrollment.created` | profile | catalog (cache invalidation), others | unlock access |
| `profile.step.passed`, `profile.chapter.passed` | profile | catalog (cache invalidation), SSE | unlock next chapter |

`VerificationResultRecordedV1` (draft contract for the profile milestone): `{ eventId, userId, workshopSlug, versionId, chapterId, repoFullName, commitSha, verdict, steps:[{stepId, passed, tests:[{id, passed}]}], occurredAt }`.

### 3.5 Staying independent

- Each service defines a **port** for the other: catalog has `AccessPolicyPort` (HTTP adapter plus in-memory fake); profile has `CatalogPort`.
- Each side tests against the fake and against **contract tests** built from the shared zod schemas.
- Failure behaviour is explicit: catalog public pages need no profile; profile can show progress without catalog (names come from the web calling catalog separately); gated content needs both.

### 3.6 Version pinning

An enrollment pins a `versionId`. Starter, content and tests always come from the pinned version. Patch releases (typos, test-bug fixes) can be applied to a workshop's enrollments by profile in bulk later (a pointer change); minor and major releases are opt-in upgrades. Retired versions stay stored while any enrollment pins them.

---

## 4. GitHub repo layout (authoring)

**`main`** (workshop-wide, small):

```
workshop.yaml
overview.md
starters/
  go/            # the tiny starter project (hand-written)
    handrail.yaml
    .github/workflows/verify.yml
    README.md  main.go  go.mod  .gitignore
  python/ ...
assets/          # workshop-level images
```

**`chapter/<chapterId>`** branches, a chain (each created from the previous one so code accumulates, which is how you write it in VS Code):

```
handrail/
  chapter.yaml
  content/
    beginner.md
    intermediate.md
    expert.md
    assets/
  tests/
    <testId>/test.yaml  + spec files   # PRIVATE, never delivered
solutions/
  go/            # full reference solution through this chapter (authoring + later validation only)
  python/
```

Rules:
- Order is defined by `chapters:` in `workshop.yaml`, not by branch names or history.
- Publisher reads **each branch tip independently** (never relies on ancestry), so cascade merges or rebases are the author's choice. Recommended: when fixing an old chapter, merge it forward manually or with the author CLI's `cascade` command.
- **Validation happens locally and at publish** (author CLI `lint`, catalog ingest gate). No per-branch GitHub workflows needed. Running tests against `solutions/` becomes a gate once the Go runner exists.
- `solutions/` is never published in this phase.

### 4.1 File schemas (zod, in `@app/content-core`)

`workshop.yaml`
```
slug: redis
title: Build your own Redis
summary: ...
difficulty: beginner | intermediate | advanced
estimated_hours: 12
access: free            # free | paid  (catalog only stores the tag; profile enforces policy)
languages: [go, python]
prerequisites: [...]    # short strings
chapters: [bind-port, respond-to-ping, echo]   # ordered chapter ids
```

`overview.md` required H2 sections: *What we build*, *What you will learn*, *Prerequisites*, *Limitations and scope*, *How this workshop works*.

`handrail/chapter.yaml`
```
id: bind-port             # must equal the branch name suffix
title: Bind to a port
summary: ...
est_minutes: 45
steps:
  - id: accept-connection
    title: Accept a connection
    tests: [accept-connection]     # folders under handrail/tests
```

`handrail/tests/<testId>/test.yaml`: `{ id, description, hidden: boolean, timeout_seconds }`; other files are opaque to catalog (the runner format is defined with the verification milestone).

`starters/<lang>/handrail.yaml`
```
build: ["go", "build", "-o", "app", "."]
run:
  default: ["./app"]
  windows: ["app.exe"]
```

### 4.2 Markdown rules (three levels)

`beginner.md`, `intermediate.md`, `expert.md` (your easy, medium, hard; the API, UI and files all use the product names). Structure:

```
# <Chapter title>            (optional)
<chapter overview paragraphs>

## <Step title> {#accept-connection}
### Task
### Theory
### Hints                    (optional)
```

Lint (author CLI and ingest gate): all three files exist; identical sets of step ids across levels and equal to `chapter.yaml`; each step has Task and Theory; every step lists at least one test and each test folder exists; every referenced image exists and is within size limits; no raw HTML or scripts; heading ids unique; chapter id equals the branch name; every workshop language has a starter and every chapter has a solution folder for it (warning for now).

Rendering is sanitized markdown (GFM, code fences with a language, callouts via blockquote conventions). Image links are rewritten to published asset URLs.

---

## 5. Catalog data model (Postgres schema `catalog`)

```
workshop(id, slug UNIQUE, repo_full_name, installation_id, access, status)
workshop_version(id, workshop_id, version, kind[draft|published|deprecated], main_sha,
                 release_notes_md, lint_report_json, created_at, published_at)
   -- one rolling draft per workshop; published rows immutable; latest_published_id on workshop
chapter(id, version_id, order_no, chapter_key, title, summary, est_minutes, branch, commit_sha)
step(id, chapter_id, order_in_chapter, step_key, title)
step_content(step_id, kind[task|theory|hint], level[beginner|intermediate|expert], md)
chapter_intro(chapter_id, level, md)
workshop_overview(version_id, sections_json)            -- parsed overview.md
artifact(id, version_id, chapter_id NULL, language NULL,
         kind[starter_zip|test_bundle|asset], storage_key, sha256, size)
ingest_run(id, workshop_id, trigger[webhook|manual|publish], main_sha, status, error, log_excerpt, created_at)
audit_event(id, actor, action, subject, metadata_json, created_at)
```

Idempotency: an ingest with identical `(main_sha, chapter SHAs)` reuses the existing draft.

Storage keys: `workshops/<slug>/<version>/starters/<lang>.zip`, `.../chapters/<chapterKey>/tests.tar.gz`, `.../assets/...`. Zips and tarballs are **deterministic** (sorted entries, fixed timestamps, executable bits kept, `.git` and OS junk excluded) so the same input always gives the same sha256.

---

## 6. Publish pipeline

1. **Trigger:** push webhook (signature verified) or admin "sync". Enqueue an ingest job per workshop (RabbitMQ work queue, prefetch 1, manual ack, retries, DLQ).
2. **Read** via a `ContentSource` port: `GitHubAppSource` (production) and `LocalGitSource` (dev/tests, reads a local repo path). Resolve `main` and each chapter branch tip to commit SHAs; download tarballs by SHA.
3. **Parse and lint** with `@app/content-core`. Any error marks the draft invalid (report stored, visible to admins) and nothing is published.
4. **Package:** starter zip per language (only `starters/<lang>/`, `.git` excluded), test bundle per chapter (`handrail/tests/*` for that chapter's tests plus a `manifest.json` with the required tests per step and hidden flags), assets.
5. **Persist:** metadata and markdown to Postgres in one transaction; artifacts to S3 first, with sha256 verification.
6. **Publish:** admin supplies a semver and release notes; the draft becomes an immutable published version; `latest_published` moves; emit `catalog.workshop.published`.

After publish, nothing reads GitHub for that version.

---

## 7. Catalog APIs

| Endpoint | Auth mode at gateway | Gating |
|---|---|---|
| `GET /v1/workshops` | public | none (latest published only) |
| `GET /v1/workshops/:slug` | public | overview, languages, chapter list with titles/summaries/step titles and counts |
| `GET /v1/workshops/:slug/chapters/:chapterId?level=` | jwt | enrolled and chapter unlocked (pinned version) |
| `GET /v1/workshops/:slug/chapters/:chapterId/steps/:stepId?level=` | jwt | same |
| `GET /v1/workshops/:slug/starter?language=` | jwt | enrolled; returns a short-lived signed URL for the pinned version's starter |
| `/v1/admin/workshops` (register, list), `/:slug/sync`, `/:slug/versions`, `/:slug/versions/:id/publish`, `/deprecate`, draft preview via `?version=draft` | jwt + role admin | admin only |
| `POST /v1/github/content-webhook` | passthrough | signature verified inside catalog |
| `/internal/*` | not routable | service tokens (section 3.3) |

Anonymous visitors see structure and marketing text only; chapter content, hints, starters and tests are gated.

---

## 8. Service structure (NestJS)

```
services/catalog-service/src/
  config/  health/  common/
  content-source/   # ContentSource port, GitHubAppSource, LocalGitSource
  github/           # App JWT + installation token (Redis cache), webhook controller + signature guard
  ingest/           # job producer/consumer, pipeline orchestration (uses @app/content-core)
  packaging/        # deterministic zip/tar builders
  storage/          # S3 client (MinIO locally), signed URLs
  catalog/          # public read APIs
  access/           # AccessPolicyPort, HttpAccessPolicy (cached), event consumer for invalidation
  delivery/         # starter signed URL
  internal/         # resolve, structure, tests (ServiceOnly)
  admin/            # sync, versions, publish, deprecate, audit
packages/content-core/   # schemas, markdown parsing, lint, snapshot model (shared by author CLI and catalog)
tools/author/            # author CLI
```

---

## 9. Author tooling (what makes authoring easy)

`handrail-author` CLI (`tools/author`):
- `new-workshop <slug>`: scaffold `main` content (workshop.yaml, overview.md, starters).
- `new-chapter <id>`: create `chapter/<id>` from the previous chapter branch with a `handrail/` template (three level files, chapter.yaml, test folder).
- `lint [--all]`: run the exact same lint as ingest, on the working tree or all branches.
- `snapshot`: build local artifacts (zips, test bundles, parsed JSON) into a folder to inspect.
- `cascade`: merge each chapter branch forward into the next, stopping with a clear report on conflict.
- `publish-local`: ingest from the local repo into a running dev stack.

---

## 10. Security

- Content repos private; content GitHub App is read-only (Contents, Metadata; push event subscription), separate from the learner-facing app; private key only in catalog-service secrets.
- Webhook signature (`X-Hub-Signature-256`) and replay protection by delivery id.
- Tests are never in any learner-reachable artifact; starter zip is built from an allow-list (`starters/<lang>/` only); test bundles are only reachable through the service-token endpoint, as short-lived signed URLs.
- Gated endpoints fail closed.
- Tarball handling: reject path traversal and symlinks, cap file count and sizes, temp directory per job.
- Markdown sanitization, image type and size limits.
- Secret scanning of content repos (gitleaks) recommended as a repo-level setting.
- Audit log for sync, publish, deprecate, and starter signed-URL issuance.

---

## 11. Cost and operations

- GitHub is read only at publish time, so API usage is tiny; no GitHub dependency at runtime.
- S3 holds a few small zips and tarballs per version. Everything is rebuildable from GitHub.
- No always-on workers beyond one ingest consumer (idle most of the time); no merge worker.
- Public catalog responses are cacheable (CDN or Next static/ISR); gated responses are small markdown.

---

## 12. Milestones

- **C1 Content spec and tooling:** `@app/content-core` (schemas, markdown parsing, lint, snapshot model), author CLI, sample workshop repo (3 chapters, 2 languages) and a script to turn it into a local git repo with branches.
- **C2 Catalog service core and ingest:** service skeleton, Prisma schema, ContentSource (GitHub App and local), webhook, ingest queue, packaging, S3, draft and publish, public read APIs, Compose entry.
- **C3 Gated content, starters, internal APIs:** AccessPolicyPort with HTTP adapter and fake, cache and invalidation events, gated content endpoints, starter signed URL, internal endpoints for profile and verification, contracts and contract tests, gateway route table entries.
- **C4 Admin and operations:** admin endpoints, versions, deprecate, audit, rate limits, docs, smoke script.
- **Next (not here):** profile-service milestones using these contracts, then verification wiring.

---

## 13. Assumptions made (tell me if any is wrong)

1. Chapter is the unit of unlock and code checkpoint; steps are sections inside a chapter with their own tests and status; a chapter passes when all its steps pass.
2. One repo per workshop with `starters/<lang>/` on `main` and `solutions/<lang>/` in chapter branches.
3. Level files are named `beginner`, `intermediate`, `expert`.
4. Learners see workshop overview, chapter titles and step titles publicly; everything else is gated by enrollment and unlocked chapters (they may also re-read passed chapters).
5. Each enrollment is pinned to a version; upgrades are explicit.
6. Test regression policy: verification runs the current chapter's tests; re-running earlier chapters' tests is a later option (the test bundle endpoint can already return earlier chapters on request).
7. Authors are you and a small trusted group (admin role); no community authoring yet.
8. `access` (free or paid) is only a tag in catalog; profile enforces entitlement later.

## 14. Possible later features

Reference-solution view after passing a chapter (diff between solution folders of consecutive chapters); chapter overlays (a zip of new files only, no merge); delivery of new scaffolding via pull request into the learner's repo; automatic CI validation that the solution passes and the starter fails each chapter's tests, once the Go runner exists; CDN in front of signed downloads.