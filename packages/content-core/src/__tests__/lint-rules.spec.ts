import { describe, it, expect } from 'vitest';
import { lintWorkshop, LINT_RULES } from '../lint/linter.js';

function createValidWorkshopTrees() {
  const mainTree = new Map<string, Buffer>();
  mainTree.set(
    'workshop.yaml',
    Buffer.from(`
slug: http-server
title: Build your own HTTP Server
summary: Learn HTTP from scratch
difficulty: beginner
estimated_hours: 6
access: free
languages: [go]
prerequisites: [Terminal basics]
chapters: [bind-port]
    `),
  );

  mainTree.set(
    'overview.md',
    Buffer.from(`
## What we build
An HTTP server.

## What you will learn
Sockets and HTTP 1.1 protocol.

## Prerequisites
Go installed.

## Limitations and scope
HTTP 1.1 only.

## How this workshop works
Complete steps and git push.
    `),
  );

  mainTree.set(
    'starters/go/handrail.yaml',
    Buffer.from(`
build: ["go", "build", "-o", "app", "."]
run:
  default: ["./app"]
    `),
  );

  mainTree.set(
    'starters/go/.github/workflows/verify.yml',
    Buffer.from(`
name: Verify
on: [push]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Verifying"
    `),
  );

  const chapterTree = new Map<string, Buffer>();
  chapterTree.set(
    'handrail/chapter.yaml',
    Buffer.from(`
id: bind-port
title: Bind to Port
summary: Create socket
est_minutes: 30
steps:
  - id: create-socket
    title: Create Socket
    tests: [test-create]
    `),
  );

  const validMarkdown = `
# Bind to Port
Chapter intro.

## Create Socket {#create-socket}
### Task
Call net.Listen.
### Theory
Sockets establish network endpoints.
### Hints
Use port 8080.
  `;

  chapterTree.set('handrail/content/beginner.md', Buffer.from(validMarkdown));
  chapterTree.set('handrail/content/intermediate.md', Buffer.from(validMarkdown));
  chapterTree.set('handrail/content/expert.md', Buffer.from(validMarkdown));

  chapterTree.set(
    'handrail/tests/test-create/test.yaml',
    Buffer.from(`
id: test-create
description: Verifies socket creation
hidden: false
timeout_seconds: 15
    `),
  );

  chapterTree.set('solutions/go/main.go', Buffer.from('package main\nfunc main() {}\n'));

  const chapterTrees = new Map<string, Map<string, Buffer>>();
  chapterTrees.set('chapter/bind-port', chapterTree);

  return { mainTree, chapterTrees };
}

describe('Lint Rules Engine', () => {
  it('passes a fully compliant workshop with zero errors and zero warnings', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    const report = lintWorkshop({ mainTree, chapterTrees });

    expect(report.valid).toBe(true);
    expect(report.errorCount).toBe(0);
    expect(report.warningCount).toBe(0);
  });

  it('triggers RULE-001 when a level file is missing', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    const ch = chapterTrees.get('chapter/bind-port')!;
    ch.delete('handrail/content/expert.md');

    const report = lintWorkshop({ mainTree, chapterTrees });
    expect(report.valid).toBe(false);
    expect(report.diagnostics.some((d) => d.ruleId === LINT_RULES.LEVEL_FILES_EXIST)).toBe(true);
  });

  it('triggers RULE-002 when step IDs mismatch between levels or chapter.yaml', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    const ch = chapterTrees.get('chapter/bind-port')!;
    ch.set(
      'handrail/content/expert.md',
      Buffer.from(`
## Different Step {#different-step}
### Task
Task
### Theory
Theory
      `),
    );

    const report = lintWorkshop({ mainTree, chapterTrees });
    expect(report.valid).toBe(false);
    expect(report.diagnostics.some((d) => d.ruleId === LINT_RULES.STEP_IDS_MATCH)).toBe(true);
  });

  it('triggers RULE-003 when a step is missing Task or Theory', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    const ch = chapterTrees.get('chapter/bind-port')!;
    const missingTheory = `
## Create Socket {#create-socket}
### Task
Only task here.
    `;
    ch.set('handrail/content/beginner.md', Buffer.from(missingTheory));

    const report = lintWorkshop({ mainTree, chapterTrees });
    expect(report.valid).toBe(false);
    expect(report.diagnostics.some((d) => d.ruleId === LINT_RULES.STEP_SUBSECTIONS_PRESENT)).toBe(true);
  });

  it('triggers RULE-004 when a step test folder or test.yaml is missing', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    const ch = chapterTrees.get('chapter/bind-port')!;
    ch.delete('handrail/tests/test-create/test.yaml');

    const report = lintWorkshop({ mainTree, chapterTrees });
    expect(report.valid).toBe(false);
    expect(report.diagnostics.some((d) => d.ruleId === LINT_RULES.STEP_TESTS_EXIST)).toBe(true);
  });

  it('triggers RULE-005 when chapter ID does not match branch suffix', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    const ch = chapterTrees.get('chapter/bind-port')!;
    ch.set(
      'handrail/chapter.yaml',
      Buffer.from(`
id: wrong-id
title: Title
summary: Summary
est_minutes: 20
steps: [{ id: create-socket, title: Step, tests: [test-create] }]
      `),
    );

    const report = lintWorkshop({ mainTree, chapterTrees });
    expect(report.valid).toBe(false);
    expect(report.diagnostics.some((d) => d.ruleId === LINT_RULES.BRANCH_CHAPTER_MATCH)).toBe(true);
  });

  it('triggers RULE-006 when a chapter in workshop.yaml has no matching branch', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    mainTree.set(
      'workshop.yaml',
      Buffer.from(`
slug: http-server
title: Title
summary: Summary
difficulty: beginner
estimated_hours: 4
languages: [go]
chapters: [bind-port, non-existent-chapter]
      `),
    );

    const report = lintWorkshop({ mainTree, chapterTrees });
    expect(report.valid).toBe(false);
    expect(report.diagnostics.some((d) => d.ruleId === LINT_RULES.WORKSHOP_BRANCHES_EXIST)).toBe(true);
  });

  it('triggers RULE-007 when starter handrail.yaml or verify.yml is missing', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    mainTree.delete('starters/go/.github/workflows/verify.yml');

    const report = lintWorkshop({ mainTree, chapterTrees });
    expect(report.valid).toBe(false);
    expect(report.diagnostics.some((d) => d.ruleId === LINT_RULES.STARTER_HANDRAIL_EXISTS)).toBe(true);
  });

  it('triggers RULE-008 warning when reference solution is missing', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    const ch = chapterTrees.get('chapter/bind-port')!;
    ch.delete('solutions/go/main.go');

    const report = lintWorkshop({ mainTree, chapterTrees });
    // Still valid because it's a warning, but warning is reported
    expect(report.valid).toBe(true);
    expect(report.warningCount).toBeGreaterThan(0);
    expect(report.diagnostics.some((d) => d.ruleId === LINT_RULES.CHAPTER_SOLUTIONS_EXIST)).toBe(true);
  });

  it('triggers RULE-009 when referenced image does not exist', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    const ch = chapterTrees.get('chapter/bind-port')!;
    ch.set(
      'handrail/content/beginner.md',
      Buffer.from(`
## Create Socket {#create-socket}
### Task
Look at diagram: ![Architecture](./assets/missing.png)
### Theory
Theory text.
      `),
    );

    const report = lintWorkshop({ mainTree, chapterTrees });
    expect(report.valid).toBe(false);
    expect(report.diagnostics.some((d) => d.ruleId === LINT_RULES.IMAGES_VALID)).toBe(true);
  });

  it('triggers RULE-010 when raw HTML script tags are present', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    const ch = chapterTrees.get('chapter/bind-port')!;
    ch.set(
      'handrail/content/beginner.md',
      Buffer.from(`
## Create Socket {#create-socket}
### Task
Task text <script>alert(1)</script>
### Theory
Theory text.
      `),
    );

    const report = lintWorkshop({ mainTree, chapterTrees });
    expect(report.valid).toBe(false);
    expect(report.diagnostics.some((d) => d.ruleId === LINT_RULES.NO_RAW_HTML)).toBe(true);
  });

  it('triggers RULE-011 when heading IDs are duplicated within a level file', () => {
    const { mainTree, chapterTrees } = createValidWorkshopTrees();
    const ch = chapterTrees.get('chapter/bind-port')!;
    ch.set(
      'handrail/content/beginner.md',
      Buffer.from(`
## Create Socket {#create-socket}
### Task
Task 1
### Theory
Theory 1

## Duplicate Step {#create-socket}
### Task
Task 2
### Theory
Theory 2
      `),
    );

    const report = lintWorkshop({ mainTree, chapterTrees });
    expect(report.valid).toBe(false);
    expect(report.diagnostics.some((d) => d.ruleId === LINT_RULES.HEADING_IDS_UNIQUE)).toBe(true);
  });
});
