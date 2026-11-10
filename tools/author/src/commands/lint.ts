import fs from 'node:fs';
import path from 'node:path';
import { LocalGitSource, lintWorkshop, lintChapterBranch, createLintReport, type LintReport, type LintDiagnostic } from '@app/content-core';
import YAML from 'yaml';
import { WorkshopSchema, type WorkshopConfig } from '@app/content-core';
import { success, error, warn, info, bold } from '../utils/format.js';

function collectFilesRecursively(dir: string, baseDir: string = dir): Map<string, Buffer> {
  const result = new Map<string, Buffer>();
  if (!fs.existsSync(dir)) return result;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.name === '.git' || entry.name === 'node_modules' || entry.name === '.artifacts') {
      continue;
    }

    if (entry.isDirectory()) {
      const nested = collectFilesRecursively(fullPath, baseDir);
      for (const [k, v] of nested) {
        result.set(k, v);
      }
    } else if (entry.isFile()) {
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
      result.set(relPath, fs.readFileSync(fullPath));
    }
  }

  return result;
}

export async function runLint(options: { all?: boolean }): Promise<void> {
  const repoDir = process.cwd();
  console.log(info(`Running Handrail content linter in: ${repoDir}`));

  let report: LintReport;

  if (options.all) {
    if (!fs.existsSync(path.join(repoDir, '.git'))) {
      console.error(error('Flag --all requires running inside a Git repository.'));
      process.exit(1);
    }

    console.log(info('Inspecting all Git branch tips via plumbing...'));
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

    report = lintWorkshop({
      mainTree,
      chapterTrees,
      availableBranches: Array.from(tips.keys()),
    });
  } else {
    // Local working tree mode
    const files = collectFilesRecursively(repoDir);

    if (files.has('workshop.yaml')) {
      // We are on main or flat repo
      const chapterTrees = new Map<string, Map<string, Buffer>>();
      report = lintWorkshop({
        mainTree: files,
        chapterTrees,
      });
    } else if (files.has('handrail/chapter.yaml')) {
      // We are inside a single chapter branch working tree
      const yamlBuf = files.get('handrail/chapter.yaml')!;
      let branchSuffix = 'unknown';
      try {
        const parsed = YAML.parse(yamlBuf.toString('utf-8'));
        branchSuffix = parsed.id || 'unknown';
      } catch {
        // Handled in lint
      }

      const diagnostics = lintChapterBranch(branchSuffix, files);
      report = createLintReport(diagnostics);
    } else {
      console.error(error('Neither workshop.yaml nor handrail/chapter.yaml found in current directory.'));
      process.exit(1);
    }
  }

  // Print results
  console.log('');
  for (const diag of report.diagnostics) {
    const loc = diag.line ? `${diag.filePath}:${diag.line}` : diag.filePath;
    if (diag.severity === 'error') {
      console.log(`  ${error(diag.ruleId)} ${bold(loc)}: ${diag.message}`);
    } else {
      console.log(`  ${warn(diag.ruleId)} ${bold(loc)}: ${diag.message}`);
    }
  }

  console.log('');
  if (report.valid) {
    if (report.warningCount > 0) {
      console.log(warn(`Lint passed with ${report.warningCount} warning(s).`));
    } else {
      console.log(success('Lint passed with zero errors or warnings! ✨'));
    }
  } else {
    console.error(error(`Lint failed with ${report.errorCount} error(s) and ${report.warningCount} warning(s).`));
    process.exit(1);
  }
}
