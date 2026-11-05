import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'yaml';

interface StepMeta {
  title: string;
  global_order: number;
  tests?: Array<{ test_id: string; description: string; is_hidden?: boolean }>;
}

interface ChapterMeta {
  title: string;
  summary: string;
  order_index: number;
}

interface WorkshopMeta {
  title: string;
  summary: string;
  languages: string[];
  difficulty: string;
  estimated_time: string;
  prerequisites: string[];
  limitations: string[];
  what_we_build: string;
  what_you_learn: string[];
}

const REQUIRED_LEVELS = ['beginner', 'intermediate', 'expert'] as const;

export function lintContent(contentDir: string): { success: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!fs.existsSync(contentDir)) {
    return { success: false, errors: [`Content directory does not exist: ${contentDir}`] };
  }

  const workshops = fs
    .readdirSync(contentDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  if (workshops.length === 0) {
    return { success: false, errors: ['No workshops found under content/'] };
  }

  for (const workshopSlug of workshops) {
    const workshopPath = path.join(contentDir, workshopSlug);
    const workshopYamlPath = path.join(workshopPath, 'workshop.yaml');
    const overviewMdxPath = path.join(workshopPath, 'overview.mdx');

    if (!fs.existsSync(workshopYamlPath)) {
      errors.push(`[${workshopSlug}] Missing workshop.yaml`);
      continue;
    }

    try {
      const workshopMeta = yaml.parse(fs.readFileSync(workshopYamlPath, 'utf8')) as WorkshopMeta;
      const requiredFields: (keyof WorkshopMeta)[] = [
        'title',
        'summary',
        'languages',
        'difficulty',
        'estimated_time',
        'prerequisites',
        'limitations',
        'what_we_build',
        'what_you_learn',
      ];
      for (const field of requiredFields) {
        if (!workshopMeta[field]) {
          errors.push(`[${workshopSlug}] workshop.yaml missing field: "${field}"`);
        }
      }
    } catch (e: any) {
      errors.push(`[${workshopSlug}] Failed to parse workshop.yaml: ${e.message}`);
    }

    if (!fs.existsSync(overviewMdxPath)) {
      errors.push(`[${workshopSlug}] Missing overview.mdx`);
    }

    const chaptersDir = path.join(workshopPath, 'chapters');
    if (!fs.existsSync(chaptersDir)) {
      errors.push(`[${workshopSlug}] Missing chapters/ directory`);
      continue;
    }

    const chapterDirs = fs
      .readdirSync(chaptersDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    if (chapterDirs.length === 0) {
      errors.push(`[${workshopSlug}] No chapters found in chapters/`);
      continue;
    }

    const globalOrdersSeen: number[] = [];

    for (const chapterSlug of chapterDirs) {
      const chapterPath = path.join(chaptersDir, chapterSlug);
      const chapterYamlPath = path.join(chapterPath, 'chapter.yaml');

      if (!fs.existsSync(chapterYamlPath)) {
        errors.push(`[${workshopSlug}/${chapterSlug}] Missing chapter.yaml`);
        continue;
      }

      const stepsDir = path.join(chapterPath, 'steps');
      if (!fs.existsSync(stepsDir)) {
        errors.push(`[${workshopSlug}/${chapterSlug}] Missing steps/ directory`);
        continue;
      }

      const stepDirs = fs
        .readdirSync(stepsDir, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name)
        .sort();

      if (stepDirs.length === 0) {
        errors.push(`[${workshopSlug}/${chapterSlug}] Chapter has no steps`);
        continue;
      }

      for (const stepSlug of stepDirs) {
        const stepPath = path.join(stepsDir, stepSlug);
        const stepYamlPath = path.join(stepPath, 'step.yaml');
        const stepPrefix = `[${workshopSlug}/${chapterSlug}/${stepSlug}]`;

        if (!fs.existsSync(stepYamlPath)) {
          errors.push(`${stepPrefix} Missing step.yaml`);
          continue;
        }

        let stepMeta: StepMeta | null = null;
        try {
          stepMeta = yaml.parse(fs.readFileSync(stepYamlPath, 'utf8')) as StepMeta;
          if (typeof stepMeta.global_order !== 'number') {
            errors.push(`${stepPrefix} step.yaml must specify numeric "global_order"`);
          } else {
            globalOrdersSeen.push(stepMeta.global_order);
          }
        } catch (e: any) {
          errors.push(`${stepPrefix} Failed to parse step.yaml: ${e.message}`);
        }

        // Check required 3 levels for task and theory
        for (const level of REQUIRED_LEVELS) {
          const taskFile = path.join(stepPath, `task.${level}.mdx`);
          const theoryFile = path.join(stepPath, `theory.${level}.mdx`);

          if (!fs.existsSync(taskFile)) {
            errors.push(`${stepPrefix} Missing task.${level}.mdx`);
          }
          if (!fs.existsSync(theoryFile)) {
            errors.push(`${stepPrefix} Missing theory.${level}.mdx`);
          }
        }

        // Check tests
        const testsDir = path.join(stepPath, 'tests');
        const hasTestsInYaml = (stepMeta?.tests?.length ?? 0) > 0;
        const hasTestsDir = fs.existsSync(testsDir) && fs.readdirSync(testsDir).length > 0;

        if (!hasTestsInYaml && !hasTestsDir) {
          errors.push(`${stepPrefix} Step lacks tests (must specify in step.yaml or in tests/ directory)`);
        }
      }
    }

    // Check continuous global ordering across workshop
    globalOrdersSeen.sort((a, b) => a - b);
    for (let i = 0; i < globalOrdersSeen.length; i++) {
      const expected = i + 1;
      if (globalOrdersSeen[i] !== expected) {
        errors.push(
          `[${workshopSlug}] Gaps or duplicates in global_order: expected ${expected}, found ${globalOrdersSeen[i]}. Global orders: [${globalOrdersSeen.join(', ')}]`,
        );
        break;
      }
    }
  }

  return {
    success: errors.length === 0,
    errors,
  };
}

if (process.argv[1]?.replace(/\\/g, '/').includes('content-linter')) {
  const contentDir = path.resolve(process.cwd(), 'content');
  const result = lintContent(contentDir);

  if (!result.success) {
    console.error('\n❌ Content Lint Failed with errors:');
    result.errors.forEach((err) => console.error(` - ${err}`));
    process.exit(1);
  } else {
    console.log('\n✅ All workshop content passed linting successfully (3 levels, tests, and sequential order verified).');
    process.exit(0);
  }
}
