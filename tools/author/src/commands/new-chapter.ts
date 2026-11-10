import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { success, error, info } from '../utils/format.js';

export function runNewChapter(chapterId: string): void {
  const repoDir = process.cwd();

  // Verify we are inside a Git repo
  if (!fs.existsSync(path.join(repoDir, '.git'))) {
    console.error(error('Must run handrail-author new-chapter inside a Git repository.'));
    process.exit(1);
  }

  const branchName = `chapter/${chapterId}`;

  try {
    // Create new branch
    execSync(`git checkout -b ${branchName}`, { stdio: 'inherit' });
  } catch (err: any) {
    console.error(error(`Failed to checkout new branch ${branchName}: ${err.message}`));
    process.exit(1);
  }

  // 1. handrail/chapter.yaml
  const handrailDir = path.join(repoDir, 'handrail');
  const contentDir = path.join(handrailDir, 'content');
  const testDir = path.join(handrailDir, 'tests', `${chapterId}-test-1`);
  fs.mkdirSync(contentDir, { recursive: true });
  fs.mkdirSync(testDir, { recursive: true });

  const chapterTitle = chapterId
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');

  const chapterYaml = `id: ${chapterId}
title: ${chapterTitle}
summary: Learn and implement ${chapterTitle}.
est_minutes: 45
steps:
  - id: ${chapterId}-step-1
    title: Initial Implementation
    tests:
      - ${chapterId}-test-1
`;
  fs.writeFileSync(path.join(handrailDir, 'chapter.yaml'), chapterYaml, 'utf-8');

  // 2. handrail/tests/<testId>/test.yaml
  const testYaml = `id: ${chapterId}-test-1
description: Verifies initial implementation for ${chapterTitle}
hidden: false
timeout_seconds: 30
`;
  fs.writeFileSync(path.join(testDir, 'test.yaml'), testYaml, 'utf-8');

  // 3. handrail/content/{beginner,intermediate,expert}.md
  const makeMarkdown = (level: string) => `# ${chapterTitle}

Welcome to ${chapterTitle} at the ${level} depth level.

## Initial Implementation {#${chapterId}-step-1}

### Task
Implement the core logic for ${chapterTitle}.

### Theory
${level === 'beginner' ? 'Foundational concepts and line-by-line explanation.' : level === 'intermediate' ? 'Architectural overview and protocol specifications.' : 'Performance considerations, edge cases, and POSIX semantics.'}

### Hints
Consult the starter files and review standard library documentation.
`;

  fs.writeFileSync(path.join(contentDir, 'beginner.md'), makeMarkdown('beginner'), 'utf-8');
  fs.writeFileSync(path.join(contentDir, 'intermediate.md'), makeMarkdown('intermediate'), 'utf-8');
  fs.writeFileSync(path.join(contentDir, 'expert.md'), makeMarkdown('expert'), 'utf-8');

  // 4. solutions/<lang>/
  const solGo = path.join(repoDir, 'solutions', 'go');
  const solPy = path.join(repoDir, 'solutions', 'python');
  fs.mkdirSync(solGo, { recursive: true });
  fs.mkdirSync(solPy, { recursive: true });

  fs.writeFileSync(path.join(solGo, 'main.go'), '// Reference Go solution\npackage main\n\nfunc main() {}\n', 'utf-8');
  fs.writeFileSync(path.join(solPy, 'server.py'), '# Reference Python solution\n\ndef main():\n    pass\n', 'utf-8');

  console.log(success(`Created and checked out branch '${branchName}' with handrail templates.`));
  console.log(info(`Ready for content authoring! Run 'handrail-author lint' to validate.`));
}
