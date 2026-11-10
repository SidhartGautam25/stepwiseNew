import crypto from 'node:crypto';
import YAML from 'yaml';
import type {
  WorkshopSnapshot,
  ParsedChapter,
  ParsedStep,
  StarterSnapshot,
  OverviewSections,
} from '../schemas/snapshot.schema.js';
import { WorkshopSchema } from '../schemas/workshop.schema.js';
import { ChapterSchema } from '../schemas/chapter.schema.js';
import { TestSchema } from '../schemas/test.schema.js';
import { StarterHandrailSchema } from '../schemas/starter-handrail.schema.js';
import { parseOverviewMarkdown } from '../markdown/overview-parser.js';
import { parseChapterMarkdown } from '../markdown/chapter-parser.js';

export interface BuildSnapshotOptions {
  mainTree: Map<string, Buffer>;
  chapterTrees: Map<string, Map<string, Buffer>>; // branchName -> tree
  mainSha?: string;
  chapterShas?: Map<string, string>; // branchName -> commitSha
}

export function buildWorkshopSnapshot(options: BuildSnapshotOptions): WorkshopSnapshot {
  const { mainTree, chapterTrees, mainSha = '0000000000000000000000000000000000000000', chapterShas = new Map() } = options;

  // 1. Workshop metadata
  const workshopYamlBuf = mainTree.get('workshop.yaml');
  if (!workshopYamlBuf) {
    throw new Error('Cannot build snapshot: missing workshop.yaml in main tree');
  }
  const rawWorkshop = YAML.parse(workshopYamlBuf.toString('utf-8'));
  const workshop = WorkshopSchema.parse(rawWorkshop);

  // 2. Overview sections
  const overviewBuf = mainTree.get('overview.md');
  if (!overviewBuf) {
    throw new Error('Cannot build snapshot: missing overview.md in main tree');
  }
  const { sections, missingSections } = parseOverviewMarkdown(overviewBuf.toString('utf-8'));
  if (missingSections.length > 0) {
    throw new Error(`Cannot build snapshot: overview.md missing sections: ${missingSections.join(', ')}`);
  }

  // 3. Starters
  const starters: StarterSnapshot[] = [];
  for (const lang of workshop.languages) {
    const handrailYamlBuf = mainTree.get(`starters/${lang}/handrail.yaml`);
    if (!handrailYamlBuf) {
      throw new Error(`Cannot build snapshot: missing starters/${lang}/handrail.yaml`);
    }
    const config = StarterHandrailSchema.parse(YAML.parse(handrailYamlBuf.toString('utf-8')));

    const starterFiles: Record<string, string> = {};
    const starterPrefix = `starters/${lang}/`;

    for (const [filePath, buf] of mainTree.entries()) {
      if (filePath.startsWith(starterPrefix)) {
        const relativePath = filePath.substring(starterPrefix.length);
        if (relativePath && !relativePath.startsWith('.git/')) {
          const sha = crypto.createHash('sha256').update(buf).digest('hex');
          starterFiles[relativePath] = sha;
        }
      }
    }

    starters.push({
      language: lang,
      config,
      files: starterFiles,
    });
  }

  // 4. Chapters in defined sequence from workshop.chapters
  const chapters: ParsedChapter[] = [];

  for (let chapterIndex = 0; chapterIndex < workshop.chapters.length; chapterIndex++) {
    const chapterId = workshop.chapters[chapterIndex];
    const branchName = `chapter/${chapterId}`;

    // Look for matching tree
    let chapterTree = chapterTrees.get(branchName);
    if (!chapterTree) {
      // Fallback check
      for (const [k, v] of chapterTrees.entries()) {
        if (k.endsWith(chapterId)) {
          chapterTree = v;
          break;
        }
      }
    }

    if (!chapterTree) {
      throw new Error(`Cannot build snapshot: missing branch tree for chapter '${chapterId}'`);
    }

    const chapterYamlBuf = chapterTree.get('handrail/chapter.yaml');
    if (!chapterYamlBuf) {
      throw new Error(`Cannot build snapshot: missing handrail/chapter.yaml in chapter '${chapterId}'`);
    }
    const chapterConfig = ChapterSchema.parse(YAML.parse(chapterYamlBuf.toString('utf-8')));

    // Parse all 3 level files
    const beginnerBuf = chapterTree.get('handrail/content/beginner.md');
    const intermediateBuf = chapterTree.get('handrail/content/intermediate.md');
    const expertBuf = chapterTree.get('handrail/content/expert.md');

    if (!beginnerBuf || !intermediateBuf || !expertBuf) {
      throw new Error(`Cannot build snapshot: chapter '${chapterId}' missing one or more content/*.md level files`);
    }

    const parsedBeginner = parseChapterMarkdown(beginnerBuf.toString('utf-8'));
    const parsedIntermediate = parseChapterMarkdown(intermediateBuf.toString('utf-8'));
    const parsedExpert = parseChapterMarkdown(expertBuf.toString('utf-8'));

    const intro = {
      beginner: parsedBeginner.intro,
      intermediate: parsedIntermediate.intro,
      expert: parsedExpert.intro,
    };

    const bStepMap = new Map(parsedBeginner.steps.map((s) => [s.id, s]));
    const iStepMap = new Map(parsedIntermediate.steps.map((s) => [s.id, s]));
    const eStepMap = new Map(parsedExpert.steps.map((s) => [s.id, s]));

    const steps: ParsedStep[] = [];
    for (let stepIndex = 0; stepIndex < chapterConfig.steps.length; stepIndex++) {
      const stepItem = chapterConfig.steps[stepIndex];
      const bStep = bStepMap.get(stepItem.id);
      const iStep = iStepMap.get(stepItem.id);
      const eStep = eStepMap.get(stepItem.id);

      if (!bStep || !iStep || !eStep) {
        throw new Error(`Cannot build snapshot: step '${stepItem.id}' not found across all markdown levels`);
      }

      steps.push({
        id: stepItem.id,
        order: stepIndex + 1,
        title: stepItem.title,
        tests: stepItem.tests,
        content: {
          beginner: bStep.content,
          intermediate: iStep.content,
          expert: eStep.content,
        },
      });
    }

    // Read tests declared in chapter
    const testsRecord: Record<string, any> = {};
    for (const step of chapterConfig.steps) {
      for (const testId of step.tests) {
        const testYamlBuf = chapterTree.get(`handrail/tests/${testId}/test.yaml`);
        if (testYamlBuf) {
          testsRecord[testId] = TestSchema.parse(YAML.parse(testYamlBuf.toString('utf-8')));
        }
      }
    }

    chapters.push({
      id: chapterConfig.id,
      order: chapterIndex + 1,
      title: chapterConfig.title,
      summary: chapterConfig.summary,
      estMinutes: chapterConfig.est_minutes,
      branch: branchName,
      commitSha: chapterShas.get(branchName) || '0000000000000000000000000000000000000000',
      intro,
      steps,
      tests: testsRecord,
    });
  }

  return {
    workshop,
    overview: sections,
    chapters,
    starters,
    mainSha,
    generatedAt: new Date().toISOString(),
  };
}
