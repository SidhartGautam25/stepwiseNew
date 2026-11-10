import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  LocalGitSource,
  lintWorkshop,
  buildWorkshopSnapshot,
  buildDeterministicZip,
  buildDeterministicTarGz,
} from '@app/content-core';
import { success, error, info, bold } from '../utils/format.js';

const sha256 = (buf: Buffer) => crypto.createHash('sha256').update(buf).digest('hex');

export async function runSnapshot(options: { outputDir?: string }): Promise<void> {
  const repoDir = process.cwd();
  const outDir = path.resolve(repoDir, options.outputDir || '.artifacts');

  if (!fs.existsSync(path.join(repoDir, '.git'))) {
    console.error(error('handrail-author snapshot requires running inside a Git repository.'));
    process.exit(1);
  }

  console.log(info(`Building workshop snapshot from Git repository...`));
  const gitSource = new LocalGitSource(repoDir);
  const tips = await gitSource.listBranchTips();

  const mainSha = tips.get('main') || tips.get('master');
  if (!mainSha) {
    console.error(error("Could not find 'main' or 'master' branch tip."));
    process.exit(1);
  }

  const mainTree = await gitSource.readTree(mainSha);
  const chapterTrees = new Map<string, Map<string, Buffer>>();

  for (const [branch, sha] of tips.entries()) {
    if (branch.startsWith('chapter/')) {
      const tree = await gitSource.readTree(sha);
      chapterTrees.set(branch, tree);
    }
  }

  // 1. Run lint check
  console.log(info('Validating content integrity...'));
  const report = lintWorkshop({
    mainTree,
    chapterTrees,
    availableBranches: Array.from(tips.keys()),
  });

  if (!report.valid) {
    console.error(error(`Cannot build snapshot: content has ${report.errorCount} lint error(s). Run 'handrail-author lint --all'.`));
    process.exit(1);
  }

  // 2. Build snapshot model
  const snapshot = buildWorkshopSnapshot({
    mainTree,
    chapterTrees,
    mainSha,
    chapterShas: tips,
  });

  fs.mkdirSync(outDir, { recursive: true });

  // 3. Package starters
  const startersDir = path.join(outDir, 'starters');
  fs.mkdirSync(startersDir, { recursive: true });

  console.log(info('Packaging deterministic starter zips...'));
  for (const lang of snapshot.workshop.languages) {
    const starterPrefix = `starters/${lang}/`;
    const entries: Array<{ path: string; content: Buffer }> = [];

    for (const [filePath, buf] of mainTree.entries()) {
      if (filePath.startsWith(starterPrefix)) {
        const rel = filePath.substring(starterPrefix.length);
        if (rel && !rel.startsWith('.git/')) {
          entries.push({ path: rel, content: buf });
        }
      }
    }

    const zipBuffer = buildDeterministicZip(entries);
    const zipPath = path.join(startersDir, `${lang}.zip`);
    fs.writeFileSync(zipPath, zipBuffer);
    console.log(`  ${success(`starter [${lang}]`)} -> ${zipPath} (${zipBuffer.length} bytes, sha256: ${sha256(zipBuffer).slice(0, 16)}...)`);
  }

  // 4. Package test bundles
  const chaptersDir = path.join(outDir, 'chapters');
  fs.mkdirSync(chaptersDir, { recursive: true });

  console.log(info('Packaging deterministic chapter test bundles...'));
  for (const chapter of snapshot.chapters) {
    const chapterTree = chapterTrees.get(chapter.branch)!;
    const testEntries: Array<{ path: string; content: Buffer | string }> = [];

    // Collect all tests in handrail/tests
    for (const [filePath, buf] of chapterTree.entries()) {
      if (filePath.startsWith('handrail/tests/')) {
        const rel = filePath.substring('handrail/tests/'.length);
        testEntries.push({ path: rel, content: buf });
      }
    }

    // Add manifest.json
    const manifest = {
      chapterId: chapter.id,
      steps: chapter.steps.map((s) => ({
        stepId: s.id,
        tests: s.tests.map((tId) => ({
          id: tId,
          hidden: chapter.tests[tId]?.hidden ?? false,
          timeoutSeconds: chapter.tests[tId]?.timeout_seconds ?? 30,
        })),
      })),
    };
    testEntries.push({ path: 'manifest.json', content: JSON.stringify(manifest, null, 2) });

    const tarBuffer = buildDeterministicTarGz(testEntries);
    const chapterOutDir = path.join(chaptersDir, chapter.id);
    fs.mkdirSync(chapterOutDir, { recursive: true });
    const tarPath = path.join(chapterOutDir, 'tests.tar.gz');
    fs.writeFileSync(tarPath, tarBuffer);
    console.log(`  ${success(`tests [${chapter.id}]`)} -> ${tarPath} (${tarBuffer.length} bytes, sha256: ${sha256(tarBuffer).slice(0, 16)}...)`);
  }

  // 5. Write snapshot.json
  const snapshotJsonPath = path.join(outDir, 'snapshot.json');
  fs.writeFileSync(snapshotJsonPath, JSON.stringify(snapshot, null, 2), 'utf-8');

  console.log('');
  console.log(success(`Snapshot successfully written to ${bold(outDir)}`));
  console.log(info(`Artifacts generated: snapshot.json, ${snapshot.workshop.languages.length} starter zip(s), ${snapshot.chapters.length} test bundle(s).`));
}
