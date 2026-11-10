import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

function copyDirRecursive(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function runGit(cmd: string, cwd: string) {
  execSync(cmd, { cwd, stdio: 'inherit' });
}

export function buildSampleRepo(targetPathArg?: string) {
  const rootDir = process.cwd();
  const targetDir = path.resolve(rootDir, targetPathArg || 'content/sample-workshop-repo');
  const srcDir = path.resolve(rootDir, 'content/sample-workshop-src');

  console.log(`=== Initializing sample workshop Git repository in ${targetDir} ===`);

  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  // 1. git init
  runGit('git init -b main', targetDir);
  runGit('git config user.name "Handrail Author"', targetDir);
  runGit('git config user.email "author@handrail.dev"', targetDir);

  // 2. Main branch
  console.log('Creating main branch...');
  copyDirRecursive(path.join(srcDir, 'main'), targetDir);
  runGit('git add .', targetDir);
  runGit('git commit -m "feat: initial workshop commit on main"', targetDir);

  // 3. Chapter 1: bind-port
  console.log('Creating chapter/bind-port branch...');
  runGit('git checkout -b chapter/bind-port', targetDir);
  copyDirRecursive(path.join(srcDir, 'chapter-1-bind-port'), targetDir);
  runGit('git add .', targetDir);
  runGit('git commit -m "feat(chapter): bind-port"', targetDir);

  // 4. Chapter 2: parse-request
  console.log('Creating chapter/parse-request branch...');
  runGit('git checkout -b chapter/parse-request', targetDir);
  copyDirRecursive(path.join(srcDir, 'chapter-2-parse-request'), targetDir);
  runGit('git add .', targetDir);
  runGit('git commit -m "feat(chapter): parse-request"', targetDir);

  // 5. Chapter 3: concurrent-connections
  console.log('Creating chapter/concurrent-connections branch...');
  runGit('git checkout -b chapter/concurrent-connections', targetDir);
  copyDirRecursive(path.join(srcDir, 'chapter-3-concurrent-connections'), targetDir);
  runGit('git add .', targetDir);
  runGit('git commit -m "feat(chapter): concurrent-connections"', targetDir);

  // Checkout main
  runGit('git checkout main', targetDir);
  console.log(`\n=== Sample workshop Git repository created successfully at ${targetDir}! ===`);
}

const arg = process.argv[2];
buildSampleRepo(arg);
