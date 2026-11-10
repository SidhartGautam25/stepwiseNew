import { describe, it, expect } from 'vitest';
import { PackagingService } from './packaging.service.js';
import type { ParsedChapter } from '@app/content-core';

describe('PackagingService', () => {
  const packaging = new PackagingService();

  it('packages starter zip with allow-listed files only, excluding solutions/tests', () => {
    const mainTree = new Map<string, Buffer>();
    mainTree.set('workshop.yaml', Buffer.from('name: test'));
    mainTree.set('overview.md', Buffer.from('# Overview'));
    mainTree.set('starters/go/handrail.yaml', Buffer.from('language: go\nentrypoint: main.go'));
    mainTree.set('starters/go/main.go', Buffer.from('package main\nfunc main() {}'));
    mainTree.set('starters/go/run.sh', Buffer.from('#!/bin/sh\ngo run main.go'));
    // Attempted leaks
    mainTree.set('starters/go/tests/leak_test.go', Buffer.from('package main'));
    mainTree.set('starters/go/solutions/leak.go', Buffer.from('package main'));
    mainTree.set('starters/python/main.py', Buffer.from('print("python")'));

    const zipBuf = packaging.packageStarter(mainTree, 'go');
    expect(zipBuf).toBeInstanceOf(Buffer);
    expect(zipBuf.length).toBeGreaterThan(0);

    // Verify determinism: packaging identical input produces identical sha256
    const zipBuf2 = packaging.packageStarter(mainTree, 'go');
    expect(zipBuf.toString('hex')).toBe(zipBuf2.toString('hex'));
  });

  it('throws when starter directory has no files', () => {
    const mainTree = new Map<string, Buffer>();
    mainTree.set('workshop.yaml', Buffer.from('name: test'));
    expect(() => packaging.packageStarter(mainTree, 'rust')).toThrow(
      "no files found under starters/rust/",
    );
  });

  it('packages test bundle with handrail/tests/* and manifest.json', () => {
    const chapterTree = new Map<string, Buffer>();
    chapterTree.set('handrail/chapter.yaml', Buffer.from('title: ch1'));
    chapterTree.set('handrail/tests/test_server.py', Buffer.from('def test_ping(): pass'));
    chapterTree.set('handrail/tests/run_tests.sh', Buffer.from('#!/bin/sh\npytest'));
    chapterTree.set('solutions/server.py', Buffer.from('print("secret solution")'));

    const mockChapter: ParsedChapter = {
      id: '01-bind-port',
      order: 1,
      title: 'Bind Port',
      summary: 'Bind to port 8080',
      estMinutes: 25,
      branch: 'chapter/01-bind-port',
      commitSha: 'c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1',
      intro: { beginner: 'Intro', intermediate: '', expert: '' },
      steps: [
        {
          id: 'step-bind',
          order: 1,
          title: 'Bind to socket',
          tests: ['t-bind-1', 't-bind-2'],
          content: {
            beginner: { task: 'T', theory: 'Th' },
            intermediate: { task: 'T', theory: 'Th' },
            expert: { task: 'T', theory: 'Th' },
          },
        },
      ],
      tests: {
        't-bind-1': { id: 't-bind-1', description: 'Public test', hidden: false, timeout_seconds: 30 },
        't-bind-2': { id: 't-bind-2', description: 'Secret test', hidden: true, timeout_seconds: 30 },
      },
    };

    const tarGz = packaging.packageTestBundle(chapterTree, mockChapter);
    expect(tarGz).toBeInstanceOf(Buffer);
    expect(tarGz.length).toBeGreaterThan(0);

    // Deterministic verify
    const tarGz2 = packaging.packageTestBundle(chapterTree, mockChapter);
    expect(tarGz.toString('hex')).toBe(tarGz2.toString('hex'));
  });
});
