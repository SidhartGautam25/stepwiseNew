#!/usr/bin/env node

import { Command } from 'commander';
import { runNewWorkshop } from './commands/new-workshop.js';
import { runNewChapter } from './commands/new-chapter.js';
import { runLint } from './commands/lint.js';
import { runSnapshot } from './commands/snapshot.js';
import { runCascade } from './commands/cascade.js';

const program = new Command();

program
  .name('handrail-author')
  .description('Authoring and validation CLI for Handrail workshops')
  .version('0.1.0');

program
  .command('new-workshop <slug>')
  .description('Scaffold a new workshop on main branch')
  .option('-d, --target-dir <dir>', 'Target directory to scaffold in')
  .action((slug, options) => {
    runNewWorkshop(slug, options);
  });

program
  .command('new-chapter <id>')
  .description('Create a new chapter branch with template files')
  .action((id) => {
    runNewChapter(id);
  });

program
  .command('lint')
  .description('Lint workshop content integrity against Handrail rules')
  .option('-a, --all', 'Inspect all branch tips in the repository')
  .action(async (options) => {
    await runLint(options);
  });

program
  .command('snapshot')
  .description('Parse workshop and compile local distribution artifacts (zips, test bundles, snapshot.json)')
  .option('-o, --output-dir <dir>', 'Artifacts output directory', '.artifacts')
  .action(async (options) => {
    await runSnapshot(options);
  });

program
  .command('cascade')
  .description('Sequentially merge each chapter branch forward into the next')
  .action(() => {
    runCascade();
  });

program.parse(process.argv);
