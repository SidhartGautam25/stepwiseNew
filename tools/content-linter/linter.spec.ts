import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { lintContent } from './index.js';

describe('Content Linter', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'handrail-content-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('fails if workshop is missing overview.mdx or workshop.yaml', () => {
    const workshopDir = path.join(tmpDir, 'test-workshop');
    fs.mkdirSync(workshopDir);
    const result = lintContent(tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('Missing workshop.yaml'))).toBe(true);
  });

  it('fails if any step lacks one of the 3 required depth levels', () => {
    const workshopDir = path.join(tmpDir, 'redis');
    fs.mkdirSync(workshopDir, { recursive: true });
    fs.writeFileSync(
      path.join(workshopDir, 'workshop.yaml'),
      `title: T\nsummary: S\nlanguages: [go]\ndifficulty: Easy\nestimated_time: 1h\nprerequisites: []\nlimitations: []\nwhat_we_build: B\nwhat_you_learn: []`,
    );
    fs.writeFileSync(path.join(workshopDir, 'overview.mdx'), '# Overview');

    const stepDir = path.join(workshopDir, 'chapters', '01-c', 'steps', '01-s');
    fs.mkdirSync(stepDir, { recursive: true });
    fs.writeFileSync(
      path.join(workshopDir, 'chapters', '01-c', 'chapter.yaml'),
      'title: C\nsummary: S\norder_index: 1',
    );
    fs.writeFileSync(
      path.join(stepDir, 'step.yaml'),
      'title: S\nglobal_order: 1\ntests:\n  - test_id: t1\n    description: d',
    );
    // Only write beginner and intermediate, omit expert
    fs.writeFileSync(path.join(stepDir, 'task.beginner.mdx'), 'task');
    fs.writeFileSync(path.join(stepDir, 'task.intermediate.mdx'), 'task');
    fs.writeFileSync(path.join(stepDir, 'theory.beginner.mdx'), 'theory');
    fs.writeFileSync(path.join(stepDir, 'theory.intermediate.mdx'), 'theory');

    const result = lintContent(tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('Missing task.expert.mdx'))).toBe(true);
    expect(result.errors.some((e) => e.includes('Missing theory.expert.mdx'))).toBe(true);
  });

  it('fails if global_order has gaps', () => {
    const workshopDir = path.join(tmpDir, 'redis');
    fs.mkdirSync(workshopDir, { recursive: true });
    fs.writeFileSync(
      path.join(workshopDir, 'workshop.yaml'),
      `title: T\nsummary: S\nlanguages: [go]\ndifficulty: Easy\nestimated_time: 1h\nprerequisites: []\nlimitations: []\nwhat_we_build: B\nwhat_you_learn: []`,
    );
    fs.writeFileSync(path.join(workshopDir, 'overview.mdx'), '# Overview');

    const stepDir = path.join(workshopDir, 'chapters', '01-c', 'steps', '01-s');
    fs.mkdirSync(stepDir, { recursive: true });
    fs.writeFileSync(
      path.join(workshopDir, 'chapters', '01-c', 'chapter.yaml'),
      'title: C\nsummary: S\norder_index: 1',
    );
    // global_order 2 instead of 1 (gap)
    fs.writeFileSync(
      path.join(stepDir, 'step.yaml'),
      'title: S\nglobal_order: 2\ntests:\n  - test_id: t1\n    description: d',
    );
    ['beginner', 'intermediate', 'expert'].forEach((l) => {
      fs.writeFileSync(path.join(stepDir, `task.${l}.mdx`), 't');
      fs.writeFileSync(path.join(stepDir, `theory.${l}.mdx`), 'th');
    });

    const result = lintContent(tmpDir);
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes('Gaps or duplicates in global_order'))).toBe(true);
  });
});
