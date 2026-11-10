import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { runNewWorkshop } from '../commands/new-workshop.js';

describe('Author CLI', () => {
  it('scaffolds a new workshop directory', () => {
    const tmpDir = path.join(os.tmpdir(), `handrail-test-${Date.now()}`);
    runNewWorkshop('test-redis', { targetDir: tmpDir });

    expect(fs.existsSync(path.join(tmpDir, 'workshop.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'overview.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'starters', 'go', 'handrail.yaml'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, 'starters', 'python', 'handrail.yaml'))).toBe(true);

    // Clean up
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
