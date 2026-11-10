import YAML from 'yaml';
import { WorkshopSchema, type WorkshopConfig } from '../schemas/workshop.schema.js';
import { ChapterSchema, type ChapterConfig } from '../schemas/chapter.schema.js';
import { TestSchema } from '../schemas/test.schema.js';
import { StarterHandrailSchema } from '../schemas/starter-handrail.schema.js';
import { parseOverviewMarkdown } from '../markdown/overview-parser.js';
import { parseChapterMarkdown } from '../markdown/chapter-parser.js';
import { checkMarkdownHtmlSafety } from '../markdown/sanitizer.js';
import { createLintReport, type LintDiagnostic, type LintReport } from './diagnostics.js';

export const LINT_RULES = {
  LEVEL_FILES_EXIST: 'RULE-001',
  STEP_IDS_MATCH: 'RULE-002',
  STEP_SUBSECTIONS_PRESENT: 'RULE-003',
  STEP_TESTS_EXIST: 'RULE-004',
  BRANCH_CHAPTER_MATCH: 'RULE-005',
  WORKSHOP_BRANCHES_EXIST: 'RULE-006',
  STARTER_HANDRAIL_EXISTS: 'RULE-007',
  CHAPTER_SOLUTIONS_EXIST: 'RULE-008',
  IMAGES_VALID: 'RULE-009',
  NO_RAW_HTML: 'RULE-010',
  HEADING_IDS_UNIQUE: 'RULE-011',
  FILE_SIZE_LIMIT: 'RULE-012',
} as const;

const MAX_MARKDOWN_SIZE_BYTES = 500 * 1024; // 500KB
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface LintOptions {
  mainTree: Map<string, Buffer>;
  chapterTrees: Map<string, Map<string, Buffer>>; // branchName (e.g. "chapter/bind-port") -> tree
  availableBranches?: string[];
}

/**
 * Lints a full workshop across main and all chapter branches
 */
export function lintWorkshop(options: LintOptions): LintReport {
  const diagnostics: LintDiagnostic[] = [];
  const { mainTree, chapterTrees, availableBranches } = options;

  // 1. Lint workshop.yaml on main
  const workshopYamlBuf = mainTree.get('workshop.yaml');
  let workshopConfig: WorkshopConfig | null = null;

  if (!workshopYamlBuf) {
    diagnostics.push({
      ruleId: LINT_RULES.WORKSHOP_BRANCHES_EXIST,
      severity: 'error',
      filePath: 'workshop.yaml',
      message: 'Missing workshop.yaml in main branch',
    });
  } else {
    try {
      const parsed = YAML.parse(workshopYamlBuf.toString('utf-8'));
      const validated = WorkshopSchema.safeParse(parsed);
      if (!validated.success) {
        for (const issue of validated.error.issues) {
          diagnostics.push({
            ruleId: 'RULE-SCHEMA-WORKSHOP',
            severity: 'error',
            filePath: 'workshop.yaml',
            message: `workshop.yaml invalid: ${issue.path.join('.')} - ${issue.message}`,
          });
        }
      } else {
        workshopConfig = validated.data;
      }
    } catch (err: any) {
      diagnostics.push({
        ruleId: 'RULE-SCHEMA-WORKSHOP',
        severity: 'error',
        filePath: 'workshop.yaml',
        message: `Failed to parse workshop.yaml: ${err.message}`,
      });
    }
  }

  // 2. Lint overview.md on main
  const overviewBuf = mainTree.get('overview.md');
  if (!overviewBuf) {
    diagnostics.push({
      ruleId: 'RULE-OVERVIEW-EXISTS',
      severity: 'error',
      filePath: 'overview.md',
      message: 'Missing overview.md in main branch',
    });
  } else {
    if (overviewBuf.length > MAX_MARKDOWN_SIZE_BYTES) {
      diagnostics.push({
        ruleId: LINT_RULES.FILE_SIZE_LIMIT,
        severity: 'error',
        filePath: 'overview.md',
        message: `overview.md exceeds size limit of 500KB (${Math.round(overviewBuf.length / 1024)}KB)`,
      });
    }

    const text = overviewBuf.toString('utf-8');
    const { missingSections } = parseOverviewMarkdown(text);
    if (missingSections.length > 0) {
      diagnostics.push({
        ruleId: 'RULE-OVERVIEW-SECTIONS',
        severity: 'error',
        filePath: 'overview.md',
        message: `overview.md is missing required sections: ${missingSections.join(', ')}`,
      });
    }

    const htmlSafety = checkMarkdownHtmlSafety(text);
    if (!htmlSafety.safe) {
      diagnostics.push({
        ruleId: LINT_RULES.NO_RAW_HTML,
        severity: 'error',
        filePath: 'overview.md',
        line: htmlSafety.line,
        message: `overview.md contains unallowed raw HTML tag <${htmlSafety.offendingTag}>`,
      });
    }
  }

  // 3. RULE-007: Starter check for every declared workshop language on main
  if (workshopConfig) {
    for (const lang of workshopConfig.languages) {
      const handrailPath = `starters/${lang}/handrail.yaml`;
      const verifyPath = `starters/${lang}/.github/workflows/verify.yml`;

      const handrailBuf = mainTree.get(handrailPath);
      const verifyBuf = mainTree.get(verifyPath);

      if (!handrailBuf) {
        diagnostics.push({
          ruleId: LINT_RULES.STARTER_HANDRAIL_EXISTS,
          severity: 'error',
          filePath: handrailPath,
          message: `Starter for language '${lang}' is missing handrail.yaml`,
        });
      } else {
        try {
          const parsed = YAML.parse(handrailBuf.toString('utf-8'));
          const validated = StarterHandrailSchema.safeParse(parsed);
          if (!validated.success) {
            diagnostics.push({
              ruleId: LINT_RULES.STARTER_HANDRAIL_EXISTS,
              severity: 'error',
              filePath: handrailPath,
              message: `handrail.yaml invalid for starter '${lang}': ${validated.error.issues[0]?.message}`,
            });
          }
        } catch (err: any) {
          diagnostics.push({
            ruleId: LINT_RULES.STARTER_HANDRAIL_EXISTS,
            severity: 'error',
            filePath: handrailPath,
            message: `Syntax error in ${handrailPath}: ${err.message}`,
          });
        }
      }

      if (!verifyBuf) {
        diagnostics.push({
          ruleId: LINT_RULES.STARTER_HANDRAIL_EXISTS,
          severity: 'error',
          filePath: verifyPath,
          message: `Starter for language '${lang}' is missing .github/workflows/verify.yml`,
        });
      }
    }
  }

  // 4. RULE-006: Check that every chapter listed in workshop.yaml exists as a branch
  const allBranches = availableBranches || Array.from(chapterTrees.keys());
  if (workshopConfig) {
    for (const chapterId of workshopConfig.chapters) {
      const expectedBranch = `chapter/${chapterId}`;
      const branchExists = allBranches.some(
        (b) => b === expectedBranch || b === `origin/${expectedBranch}` || b === chapterId,
      );

      if (!branchExists) {
        diagnostics.push({
          ruleId: LINT_RULES.WORKSHOP_BRANCHES_EXIST,
          severity: 'error',
          filePath: 'workshop.yaml',
          message: `Declared chapter '${chapterId}' does not have corresponding branch '${expectedBranch}'`,
        });
      }
    }
  }

  // 5. Lint each chapter branch
  for (const [branchName, chapterTree] of chapterTrees.entries()) {
    const branchSuffix = branchName.replace(/^refs\/heads\//, '').replace(/^origin\//, '').replace(/^chapter\//, '');
    const chapterDiagnostics = lintChapterBranch(branchSuffix, chapterTree, workshopConfig);
    diagnostics.push(...chapterDiagnostics);
  }

  return createLintReport(diagnostics);
}

/**
 * Lints an individual chapter branch tree
 */
export function lintChapterBranch(
  branchSuffix: string,
  tree: Map<string, Buffer>,
  workshopConfig?: WorkshopConfig | null,
): LintDiagnostic[] {
  const diagnostics: LintDiagnostic[] = [];
  const prefix = `[branch chapter/${branchSuffix}]`;

  // 1. Read handrail/chapter.yaml
  const chapterYamlBuf = tree.get('handrail/chapter.yaml');
  let chapterConfig: ChapterConfig | null = null;

  if (!chapterYamlBuf) {
    diagnostics.push({
      ruleId: 'RULE-CHAPTER-YAML-EXISTS',
      severity: 'error',
      filePath: 'handrail/chapter.yaml',
      message: `${prefix} Missing handrail/chapter.yaml`,
    });
  } else {
    try {
      const parsed = YAML.parse(chapterYamlBuf.toString('utf-8'));
      const validated = ChapterSchema.safeParse(parsed);
      if (!validated.success) {
        diagnostics.push({
          ruleId: 'RULE-CHAPTER-YAML-VALID',
          severity: 'error',
          filePath: 'handrail/chapter.yaml',
          message: `${prefix} handrail/chapter.yaml invalid: ${validated.error.issues[0]?.message}`,
        });
      } else {
        chapterConfig = validated.data;

        // RULE-005: Branch name suffix equals chapter ID
        if (chapterConfig.id !== branchSuffix) {
          diagnostics.push({
            ruleId: LINT_RULES.BRANCH_CHAPTER_MATCH,
            severity: 'error',
            filePath: 'handrail/chapter.yaml',
            message: `${prefix} Chapter ID '${chapterConfig.id}' does not match branch suffix '${branchSuffix}'`,
          });
        }
      }
    } catch (err: any) {
      diagnostics.push({
        ruleId: 'RULE-CHAPTER-YAML-VALID',
        severity: 'error',
        filePath: 'handrail/chapter.yaml',
        message: `${prefix} Syntax error in handrail/chapter.yaml: ${err.message}`,
      });
    }
  }

  // 2. RULE-001: All three level files exist
  const levelNames = ['beginner', 'intermediate', 'expert'] as const;
  const parsedLevels = new Map<string, ReturnType<typeof parseChapterMarkdown>>();

  for (const level of levelNames) {
    const filePath = `handrail/content/${level}.md`;
    const buf = tree.get(filePath);

    if (!buf) {
      diagnostics.push({
        ruleId: LINT_RULES.LEVEL_FILES_EXIST,
        severity: 'error',
        filePath,
        message: `${prefix} Missing required level file: ${filePath}`,
      });
      continue;
    }

    // RULE-012: File size limit
    if (buf.length > MAX_MARKDOWN_SIZE_BYTES) {
      diagnostics.push({
        ruleId: LINT_RULES.FILE_SIZE_LIMIT,
        severity: 'error',
        filePath,
        message: `${prefix} ${filePath} exceeds size limit of 500KB (${Math.round(buf.length / 1024)}KB)`,
      });
    }

    const text = buf.toString('utf-8');

    // RULE-010: No raw HTML
    const htmlSafety = checkMarkdownHtmlSafety(text);
    if (!htmlSafety.safe) {
      diagnostics.push({
        ruleId: LINT_RULES.NO_RAW_HTML,
        severity: 'error',
        filePath,
        line: htmlSafety.line,
        message: `${prefix} ${filePath} contains unallowed raw HTML tag <${htmlSafety.offendingTag}>`,
      });
    }

    // Parse markdown steps
    const parsed = parseChapterMarkdown(text);
    parsedLevels.set(level, parsed);

    // RULE-011: Unique heading IDs
    if (parsed.duplicateHeadingIds.length > 0) {
      diagnostics.push({
        ruleId: LINT_RULES.HEADING_IDS_UNIQUE,
        severity: 'error',
        filePath,
        message: `${prefix} ${filePath} contains duplicate step heading IDs: ${parsed.duplicateHeadingIds.join(', ')}`,
      });
    }

    // RULE-003: Every step has Task and Theory
    for (const step of parsed.steps) {
      if (!step.hasTask) {
        diagnostics.push({
          ruleId: LINT_RULES.STEP_SUBSECTIONS_PRESENT,
          severity: 'error',
          filePath,
          line: step.line,
          message: `${prefix} Step '${step.id}' in ${filePath} is missing required '### Task' section`,
        });
      }
      if (!step.hasTheory) {
        diagnostics.push({
          ruleId: LINT_RULES.STEP_SUBSECTIONS_PRESENT,
          severity: 'error',
          filePath,
          line: step.line,
          message: `${prefix} Step '${step.id}' in ${filePath} is missing required '### Theory' section`,
        });
      }
    }
  }

  // 3. RULE-002: Identical step ID sets across all three levels and equal to chapter.yaml
  if (parsedLevels.size === 3) {
    const beginnerSteps = parsedLevels.get('beginner')!.steps.map((s) => s.id);
    const intermediateSteps = parsedLevels.get('intermediate')!.steps.map((s) => s.id);
    const expertSteps = parsedLevels.get('expert')!.steps.map((s) => s.id);

    const bSet = new Set(beginnerSteps);
    const iSet = new Set(intermediateSteps);
    const eSet = new Set(expertSteps);

    const setsEqual = (s1: Set<string>, s2: Set<string>) =>
      s1.size === s2.size && [...s1].every((item) => s2.has(item));

    if (!setsEqual(bSet, iSet) || !setsEqual(bSet, eSet)) {
      diagnostics.push({
        ruleId: LINT_RULES.STEP_IDS_MATCH,
        severity: 'error',
        filePath: 'handrail/content/',
        message: `${prefix} Step IDs do not match across level files (beginner: [${beginnerSteps.join(', ')}], intermediate: [${intermediateSteps.join(', ')}], expert: [${expertSteps.join(', ')}])`,
      });
    }

    if (chapterConfig) {
      const yamlStepIds = chapterConfig.steps.map((s) => s.id);
      const ySet = new Set(yamlStepIds);

      if (!setsEqual(bSet, ySet)) {
        diagnostics.push({
          ruleId: LINT_RULES.STEP_IDS_MATCH,
          severity: 'error',
          filePath: 'handrail/chapter.yaml',
          message: `${prefix} Steps in chapter.yaml [${yamlStepIds.join(', ')}] do not match steps in markdown content [${beginnerSteps.join(', ')}]`,
        });
      }
    }
  }

  // 4. RULE-004: Every step lists tests, and every test folder has a valid test.yaml
  if (chapterConfig) {
    for (const step of chapterConfig.steps) {
      if (!step.tests || step.tests.length === 0) {
        diagnostics.push({
          ruleId: LINT_RULES.STEP_TESTS_EXIST,
          severity: 'error',
          filePath: 'handrail/chapter.yaml',
          message: `${prefix} Step '${step.id}' does not list any tests`,
        });
        continue;
      }

      for (const testId of step.tests) {
        const testYamlPath = `handrail/tests/${testId}/test.yaml`;
        const testBuf = tree.get(testYamlPath);

        if (!testBuf) {
          diagnostics.push({
            ruleId: LINT_RULES.STEP_TESTS_EXIST,
            severity: 'error',
            filePath: testYamlPath,
            message: `${prefix} Test '${testId}' listed in step '${step.id}' does not exist at ${testYamlPath}`,
          });
        } else {
          try {
            const parsed = YAML.parse(testBuf.toString('utf-8'));
            const validated = TestSchema.safeParse(parsed);
            if (!validated.success) {
              diagnostics.push({
                ruleId: LINT_RULES.STEP_TESTS_EXIST,
                severity: 'error',
                filePath: testYamlPath,
                message: `${prefix} Test config in ${testYamlPath} is invalid: ${validated.error.issues[0]?.message}`,
              });
            }
          } catch (err: any) {
            diagnostics.push({
              ruleId: LINT_RULES.STEP_TESTS_EXIST,
              severity: 'error',
              filePath: testYamlPath,
              message: `${prefix} Syntax error in ${testYamlPath}: ${err.message}`,
            });
          }
        }
      }
    }
  }

  // 5. RULE-008: Every chapter has solutions/<lang> (warning)
  if (workshopConfig) {
    for (const lang of workshopConfig.languages) {
      const solutionPrefix = `solutions/${lang}/`;
      const hasSolution = Array.from(tree.keys()).some((k) => k.startsWith(solutionPrefix));

      if (!hasSolution) {
        diagnostics.push({
          ruleId: LINT_RULES.CHAPTER_SOLUTIONS_EXIST,
          severity: 'warning',
          filePath: `solutions/${lang}/`,
          message: `${prefix} Missing reference solution folder 'solutions/${lang}/' for declared language '${lang}'`,
        });
      }
    }
  }

  // 6. RULE-009: Referenced images exist and are within size limit
  for (const [filePath, buf] of tree.entries()) {
    if (filePath.endsWith('.md')) {
      const text = buf.toString('utf-8');
      const imgRegex = /!\[[^\]]*\]\(([^)]+)\)/g;
      let match;
      while ((match = imgRegex.exec(text)) !== null) {
        const rawUrl = match[1].trim().split(' ')[0]; // strip optional title
        if (rawUrl.startsWith('http://') || rawUrl.startsWith('https://')) {
          continue; // external image
        }

        // Resolve relative to markdown file directory
        const mdDir = filePath.includes('/') ? filePath.substring(0, filePath.lastIndexOf('/')) : '';
        const resolvedPath = (mdDir ? `${mdDir}/${rawUrl}` : rawUrl).replace(/\/\.\//g, '/').replace(/\/+/g, '/');

        const imgBuf = tree.get(resolvedPath);
        if (!imgBuf) {
          diagnostics.push({
            ruleId: LINT_RULES.IMAGES_VALID,
            severity: 'error',
            filePath,
            message: `${prefix} Referenced image '${rawUrl}' does not exist at '${resolvedPath}'`,
          });
        } else if (imgBuf.length > MAX_IMAGE_SIZE_BYTES) {
          diagnostics.push({
            ruleId: LINT_RULES.IMAGES_VALID,
            severity: 'error',
            filePath: resolvedPath,
            message: `${prefix} Image '${resolvedPath}' exceeds size limit of 5MB (${Math.round(imgBuf.length / (1024 * 1024))}MB)`,
          });
        }
      }
    }
  }

  return diagnostics;
}

/**
 * Lints a workshop snapshot or delegates to tree linting if trees provided
 */
export function lintWorkshopSnapshot(
  snapshot: any,
  options?: { mainTree?: Map<string, Buffer>; chapterTrees?: Map<string, Map<string, Buffer>> },
): LintReport {
  if (options?.mainTree && options?.chapterTrees) {
    return lintWorkshop({
      mainTree: options.mainTree,
      chapterTrees: options.chapterTrees,
    });
  }

  const diagnostics: LintDiagnostic[] = [];
  if (!snapshot || !snapshot.workshop) {
    diagnostics.push({
      ruleId: LINT_RULES.WORKSHOP_BRANCHES_EXIST,
      severity: 'error',
      filePath: 'workshop.yaml',
      message: 'Snapshot missing workshop configuration',
    });
  }
  return createLintReport(diagnostics);
}

