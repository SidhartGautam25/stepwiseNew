# Handrail Workshop Authoring Guide 🛠️

This guide is the complete manual for workshop creators on the Handrail platform. It covers everything from setting up your local repository to structuring multi-level markdown content, creating black-box tests, packaging deterministic distribution archives, and propagating code changes across chapter branch chains.

---

## Table of Contents

1. [Core Authoring Philosophy](#1-core-authoring-philosophy)
2. [Repository & Branch Architecture](#2-repository--branch-architecture)
3. [Setting Up Your Environment](#3-setting-up-your-environment)
4. [Step 1: Scaffolding a New Workshop](#4-step-1-scaffolding-a-new-workshop)
5. [Step 2: Workshop Metadata & Overview](#5-step-2-workshop-metadata--overview)
6. [Step 3: Creating Starters](#6-step-3-creating-starters)
7. [Step 4: Authoring Chapters](#7-step-4-authoring-chapters)
8. [Markdown Content Rules (Three Levels)](#8-markdown-content-rules-three-levels)
9. [Writing Tests & Solutions](#9-writing-tests--solutions)
10. [Validating with the Linter (`handrail-author lint`)](#10-validating-with-the-linter-handrail-author-lint)
11. [Inspecting Distribution Artifacts (`handrail-author snapshot`)](#11-inspecting-distribution-artifacts-handrail-author-snapshot)
12. [Fixing Past Chapters & Cascading Changes (`handrail-author cascade`)](#12-fixing-past-chapters--cascading-changes-handrail-author-cascade)
13. [Lint Rules & Diagnostics Reference](#13-lint-rules--diagnostics-reference)

---

## 1. Core Authoring Philosophy

Handrail uses a **local-first, git-native learning model**:
- **One Repository per Workshop**: Authors write workshops inside standard Git repositories.
- **Code Accumulates Naturally**: Each chapter is a branch created from the previous chapter. Authors write code just like they would when building a software project in VS Code or GoLand.
- **Single Starter Distribution**: Learners receive **one starter repository** upon enrollment. They never receive future chapter code drops or merge PRs. Chapters are delivered dynamically as **instructions (markdown)** and **black-box verification tests**.
- **Three-Level Adaptive Depth**: Every chapter provides three parallel content tracks (`beginner.md`, `intermediate.md`, `expert.md`) sharing identical step keys.

---

## 2. Repository & Branch Architecture

Each workshop repository follows a strict multi-branch layout:

```
[main] branch (Workshop metadata & starters)
├── workshop.yaml
├── overview.md
├── starters/
│   ├── go/
│   │   ├── handrail.yaml
│   │   ├── .github/workflows/verify.yml
│   │   ├── go.mod
│   │   ├── main.go
│   │   └── README.md
│   └── python/
│       ├── handrail.yaml
│       ├── .github/workflows/verify.yml
│       ├── server.py
│       └── README.md
└── .gitignore

[chapter/<chapterId>] branches (Sequential branch chain)
├── handrail/
│   ├── chapter.yaml
│   ├── content/
│   │   ├── beginner.md
│   │   ├── intermediate.md
│   │   └── expert.md
│   └── tests/
│       └── <testId>/
│           ├── test.yaml
│           └── test_spec.json
└── solutions/
    ├── go/
    └── python/
```

- **`main`**: The root branch containing global workshop metadata, the long-form overview, and clean starter projects.
- **`chapter/<chapterId>`**: A linear branch chain where code and reference solutions accumulate from one chapter to the next.

---

## 3. Setting Up Your Environment

Ensure you have Node.js and the `handrail-author` CLI installed:

```bash
# In the Handrail monorepo root:
pnpm install
pnpm --filter handrail-author build

# Link CLI globally (or run via pnpm author):
pnpm author --help
```

Recommended VS Code extensions:
- **Markdown All in One**: Fast outline navigation and list editing.
- **YAML**: Schema validation and syntax highlighting.
- **GitLens**: Visualizing branch chains and commit history.

---

## 4. Step 1: Scaffolding a New Workshop

To create a brand-new workshop repository:

```bash
handrail-author new-workshop build-your-own-http-server
cd build-your-own-http-server
git init -b main
git add .
git commit -m "feat: initial workshop commit on main"
```

This scaffolds:
1. A valid `workshop.yaml` configuration.
2. An `overview.md` with all 5 mandatory H2 sections.
3. Language starter projects for Go and Python with `handrail.yaml` and `.github/workflows/verify.yml`.
4. A production `.gitignore`.

---

## 5. Step 2: Workshop Metadata & Overview

### `workshop.yaml`
Lives on `main`. Defines workshop identification, difficulty, and chapter order:

```yaml
slug: build-your-own-http-server
title: Build your own HTTP Server
summary: Learn systems networking by implementing an RFC-compliant HTTP server from scratch.
difficulty: intermediate       # beginner | intermediate | advanced
estimated_hours: 8
access: free                   # free | paid
languages:
  - go
  - python
prerequisites:
  - Basic TCP socket programming
  - Command-line terminal familiarity
chapters:
  - bind-port
  - parse-request
  - concurrent-connections
```

### `overview.md`
Lives on `main`. Must contain exactly these 5 `##` H2 sections:
1. `## What we build`: Narrative description of the end artifact.
2. `## What you will learn`: Core engineering competencies mastered.
3. `## Prerequisites`: Required tools, compilers, and prior knowledge.
4. `## Limitations and scope`: Explicit out-of-scope architectural decisions (e.g., no TLS).
5. `## How this workshop works`: Platform workflow instructions.

---

## 6. Step 3: Creating Starters

Starters live under `starters/<lang>/` on `main`. 

### `handrail.yaml` Specification
Instructs the Handrail verification runner how to build and execute the student's project:

```yaml
build: ["go", "build", "-o", "app", "."]
run:
  default: ["./app"]
  windows: ["app.exe"]
```

### Allow-List Security Rule
When Handrail generates distribution starter zips, **only** files under `starters/<lang>/` are included. Everything else (`handrail/tests`, `solutions`, `.git`, OS junk) is strictly excluded to prevent secret and solution leakage.

---

## 7. Step 4: Authoring Chapters

To create the next chapter in the sequence:

```bash
# While in your workshop repository:
handrail-author new-chapter bind-port
```

This:
1. Creates and checks out Git branch `chapter/bind-port` from the current branch.
2. Scaffolds `handrail/chapter.yaml`.
3. Scaffolds `handrail/content/{beginner,intermediate,expert}.md`.
4. Scaffolds `handrail/tests/<testId>/test.yaml`.
5. Scaffolds `solutions/<lang>/`.

### `handrail/chapter.yaml`
```yaml
id: bind-port             # Must exactly match the branch name suffix (chapter/<id>)
title: Bind to a Port
summary: Initialize a raw network socket and listen for incoming connections.
est_minutes: 45
steps:
  - id: bind-socket
    title: Create and Bind Socket
    tests:
      - bind-socket
  - id: listen-port
    title: Listen and Accept Connections
    tests:
      - listen-port
```

---

## 8. Markdown Content Rules (Three Levels)

Inside `handrail/content/`, every chapter must contain all three files:
- `beginner.md`
- `intermediate.md`
- `expert.md`

### Step Headings & Section Structure
Every level file must follow this exact markdown structure:

```markdown
# Chapter Title (Optional)
Chapter overview paragraphs giving context for the chapter.

## Step Title {#step-id}

### Task
Clear, imperative instructions telling the learner what behavior to implement.

### Theory
Deep conceptual explanation of why the system works this way.

### Hints
Optional guidance, standard library references, and debugging tips.
```

### Strict Content Rules:
1. **Explicit Step IDs**: Every `## ` step heading must specify `{#step-id}` (e.g. `## Bind Socket {#bind-socket}`).
2. **Matching Step Sets**: The set of step IDs across `beginner.md`, `intermediate.md`, and `expert.md` must be **100% identical** and match `steps` in `handrail/chapter.yaml`.
3. **Mandatory Subsections**: Every step must contain `### Task` and `### Theory`. `### Hints` is optional.
4. **No Raw HTML**: Do not use `<script>`, `<iframe>`, or raw HTML tags. Standard GitHub-Flavored Markdown (GFM), code fences, and tables are fully supported.
5. **Image References**: Local images (`./assets/diagram.png`) must exist in the branch tree and be smaller than 5MB.
6. **File Size Limit**: Markdown files must be smaller than 500KB.

---

## 9. Writing Tests & Solutions

### Tests (`handrail/tests/<testId>/test.yaml`)
Each test folder contains a descriptor:

```yaml
id: bind-socket
description: Verifies that the server binds to port 4221 without crashing.
hidden: false              # If true, test details are concealed in learner logs
timeout_seconds: 15
```

Test bundles are packaged into `.tar.gz` archives with an automatically generated `manifest.json`. Tests are stored privately in MinIO/S3 and are **only accessible by the verification runner via internal service tokens**.

### Solutions (`solutions/<lang>/`)
Each chapter branch should maintain a working implementation under `solutions/<lang>/`. This serves as the reference implementation and allows verifying that test suites pass against completed code.

---

## 10. Validating with the Linter (`handrail-author lint`)

The linter validates your entire repository against Handrail's content rules:

```bash
# Validate current working branch
handrail-author lint

# Validate all branches in the repository
handrail-author lint --all
```

Output is cleanly formatted with rule IDs, filenames, and line numbers:
```
ℹ Running Handrail content linter in: /path/to/workshop
ℹ Inspecting all Git branch tips via plumbing...

✓ Lint passed with zero errors or warnings! ✨
```

---

## 11. Inspecting Distribution Artifacts (`handrail-author snapshot`)

To test the exact packaging pipeline used by production catalog ingest:

```bash
handrail-author snapshot
```

This compiles local distribution artifacts into `.artifacts/`:
- `starters/<lang>.zip`: Deterministic starter zip with normalized timestamps (`2026-01-01T00:00:00Z`), sorted entries, and Unix permissions.
- `chapters/<chapterId>/tests.tar.gz`: Deterministic test bundle with `manifest.json`.
- `snapshot.json`: Full typed snapshot containing parsed metadata, overview sections, chapters, steps, and test configs.

```
ℹ Packaging deterministic starter zips...
  ✓ starter [go] -> .artifacts/starters/go.zip (1322 bytes, sha256: 7a5015...)
  ✓ starter [python] -> .artifacts/starters/python.zip (1201 bytes, sha256: a8cc10...)
ℹ Packaging deterministic chapter test bundles...
  ✓ tests [bind-port] -> .artifacts/chapters/bind-port/tests.tar.gz (420 bytes, sha256: 21ad20...)
```

---

## 12. Fixing Past Chapters & Cascading Changes (`handrail-author cascade`)

If you fix a typo or bug in an earlier chapter (e.g. `chapter/bind-port`), that fix must propagate forward to subsequent chapters (`chapter/parse-request` and `chapter/concurrent-connections`).

Instead of performing manual Git merges branch by branch:

```bash
handrail-author cascade
```

The CLI sequentially merges:
1. `chapter/bind-port` $\rightarrow$ `chapter/parse-request`
2. `chapter/parse-request` $\rightarrow$ `chapter/concurrent-connections`

If a merge conflict occurs, `cascade` aborts immediately, leaves the working tree clean, and reports the conflicting files so you can resolve them cleanly.

---

## 13. Lint Rules & Diagnostics Reference

| Rule ID | Name | Severity | Description |
|---|---|---|---|
| `RULE-001` | `LEVEL_FILES_EXIST` | **Error** | `beginner.md`, `intermediate.md`, and `expert.md` must all exist in `handrail/content/`. |
| `RULE-002` | `STEP_IDS_MATCH` | **Error** | Step IDs across all 3 level files must be identical and match `chapter.yaml`. |
| `RULE-003` | `STEP_SUBSECTIONS_PRESENT` | **Error** | Every step must have non-empty `### Task` and `### Theory` subsections. |
| `RULE-004` | `STEP_TESTS_EXIST` | **Error** | Every step must list tests, and `handrail/tests/<testId>/test.yaml` must exist. |
| `RULE-005` | `BRANCH_CHAPTER_MATCH` | **Error** | `id` in `chapter.yaml` must equal the Git branch suffix `chapter/<id>`. |
| `RULE-006` | `WORKSHOP_BRANCHES_EXIST` | **Error** | Every chapter in `workshop.yaml` must exist as a Git branch. |
| `RULE-007` | `STARTER_HANDRAIL_EXISTS` | **Error** | Every workshop language must have `handrail.yaml` and `.github/workflows/verify.yml` in `starters/<lang>/`. |
| `RULE-008` | `CHAPTER_SOLUTIONS_EXIST` | **Warning** | Every chapter should include a reference solution folder `solutions/<lang>/`. |
| `RULE-009` | `IMAGES_VALID` | **Error** | Referenced images in markdown must exist in the branch and be smaller than 5MB. |
| `RULE-010` | `NO_RAW_HTML` | **Error** | Raw `<script>` or unallowed HTML tags are forbidden in markdown content. |
| `RULE-011` | `HEADING_IDS_UNIQUE` | **Error** | Step heading IDs `{#id}` must be unique within each markdown level file. |
| `RULE-012` | `FILE_SIZE_LIMIT` | **Error** | Markdown content files must not exceed 500KB. |
