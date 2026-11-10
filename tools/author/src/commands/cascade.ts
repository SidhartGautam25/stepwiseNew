import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import YAML from 'yaml';
import { WorkshopSchema } from '@app/content-core';
import { success, error, warn, info, bold } from '../utils/format.js';

export function runCascade(): void {
  const repoDir = process.cwd();

  if (!fs.existsSync(path.join(repoDir, '.git'))) {
    console.error(error('handrail-author cascade requires running inside a Git repository.'));
    process.exit(1);
  }

  // Check working tree clean
  const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
  if (status) {
    console.error(error('Git working tree has uncommitted changes. Please commit or stash before running cascade.'));
    process.exit(1);
  }

  // Read workshop.yaml from main or working tree
  let workshopConfig;
  try {
    const raw = execSync('git show main:workshop.yaml', { encoding: 'utf-8' });
    workshopConfig = WorkshopSchema.parse(YAML.parse(raw));
  } catch {
    if (fs.existsSync(path.join(repoDir, 'workshop.yaml'))) {
      const raw = fs.readFileSync(path.join(repoDir, 'workshop.yaml'), 'utf-8');
      workshopConfig = WorkshopSchema.parse(YAML.parse(raw));
    } else {
      console.error(error('Could not load workshop.yaml from main branch.'));
      process.exit(1);
    }
  }

  const { chapters } = workshopConfig;
  if (chapters.length < 2) {
    console.log(info(`Workshop has ${chapters.length} chapter(s). Cascade requires at least 2 chapters.`));
    return;
  }

  console.log(info(`Starting sequential branch cascade across ${chapters.length} chapters...`));

  for (let i = 0; i < chapters.length - 1; i++) {
    const sourceChapter = chapters[i];
    const targetChapter = chapters[i + 1];

    const sourceBranch = `chapter/${sourceChapter}`;
    const targetBranch = `chapter/${targetChapter}`;

    console.log(`\nMerging ${bold(sourceBranch)} -> ${bold(targetBranch)}...`);

    try {
      execSync(`git checkout ${targetBranch}`, { stdio: 'pipe' });
      execSync(`git merge ${sourceBranch} -m "chore: cascade merge from ${sourceBranch}"`, { stdio: 'pipe' });
      console.log(success(`Merged ${sourceBranch} into ${targetBranch} cleanly.`));
    } catch (err: any) {
      console.error(error(`Merge conflict or error while merging ${sourceBranch} into ${targetBranch}!`));

      // Check conflict status
      try {
        const conflictStatus = execSync('git status --porcelain', { encoding: 'utf-8' });
        console.error(warn('Conflicted files:'));
        for (const line of conflictStatus.split('\n')) {
          if (line.startsWith('UU ') || line.startsWith('AA ') || line.startsWith('UD ') || line.startsWith('DU ')) {
            console.error(`  ${line.trim()}`);
          }
        }
        // Abort merge to keep repo in consistent state
        execSync('git merge --abort', { stdio: 'pipe' });
        console.log(info('Aborted merge to leave repository clean. Resolve conflicts manually and re-run.'));
      } catch {
        // Ignored
      }

      process.exit(1);
    }
  }

  console.log('');
  console.log(success(`Cascade completed successfully across all ${chapters.length} chapters! ✨`));
}
