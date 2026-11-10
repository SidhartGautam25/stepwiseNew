import type { StepContent } from '../schemas/snapshot.schema.js';

export interface ParsedStepMarkdown {
  id: string;
  title: string;
  line: number;
  content: StepContent;
  hasTask: boolean;
  hasTheory: boolean;
  hasHints: boolean;
}

export interface ChapterMarkdownParseResult {
  intro: string;
  steps: ParsedStepMarkdown[];
  duplicateHeadingIds: string[];
}

export function parseChapterMarkdown(rawContent: string): ChapterMarkdownParseResult {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  let introLines: string[] = [];
  const rawSteps: Array<{
    id: string;
    title: string;
    line: number;
    lines: Array<{ line: string; lineNo: number }>;
  }> = [];

  const seenIds = new Set<string>();
  const duplicateHeadingIds: string[] = [];

  let currentStep: {
    id: string;
    title: string;
    line: number;
    lines: Array<{ line: string; lineNo: number }>;
  } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;

    // Check for H2 step heading: ## <Title> {#id}
    const stepMatch = line.match(/^##\s+(.+?)(?:\s+\{#([a-z0-9-]+)\})?\s*$/);

    if (stepMatch && !line.startsWith('###')) {
      let title = stepMatch[1].trim();
      let stepId = stepMatch[2];

      // If {#id} was part of title without clean match
      if (!stepId) {
        const idMatch = title.match(/\{#([a-z0-9-]+)\}$/);
        if (idMatch) {
          stepId = idMatch[1];
          title = title.replace(/\{#([a-z0-9-]+)\}$/, '').trim();
        }
      }

      const finalId = stepId || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      if (seenIds.has(finalId)) {
        duplicateHeadingIds.push(finalId);
      } else {
        seenIds.add(finalId);
      }

      currentStep = {
        id: finalId,
        title,
        line: lineNo,
        lines: [],
      };
      rawSteps.push(currentStep);
      continue;
    }

    if (currentStep) {
      currentStep.lines.push({ line, lineNo });
    } else {
      // Don't include top-level # Title in intro text if present
      if (!line.startsWith('# ')) {
        introLines.push(line);
      }
    }
  }

  const steps: ParsedStepMarkdown[] = rawSteps.map((raw) => {
    let taskLines: string[] = [];
    let theoryLines: string[] = [];
    let hintLines: string[] = [];
    let currentSub: 'task' | 'theory' | 'hints' | null = null;

    for (const { line } of raw.lines) {
      const subMatch = line.match(/^###\s+(.+)$/);
      if (subMatch) {
        const subTitle = subMatch[1].trim().toLowerCase();
        if (subTitle.includes('task')) {
          currentSub = 'task';
        } else if (subTitle.includes('theory')) {
          currentSub = 'theory';
        } else if (subTitle.includes('hint')) {
          currentSub = 'hints';
        } else {
          currentSub = null;
        }
        continue;
      }

      if (currentSub === 'task') {
        taskLines.push(line);
      } else if (currentSub === 'theory') {
        theoryLines.push(line);
      } else if (currentSub === 'hints') {
        hintLines.push(line);
      }
    }

    const taskText = taskLines.join('\n').trim();
    const theoryText = theoryLines.join('\n').trim();
    const hintText = hintLines.join('\n').trim();

    return {
      id: raw.id,
      title: raw.title,
      line: raw.line,
      hasTask: Boolean(taskText),
      hasTheory: Boolean(theoryText),
      hasHints: Boolean(hintText),
      content: {
        task: taskText,
        theory: theoryText,
        hints: hintText || undefined,
      },
    };
  });

  return {
    intro: introLines.join('\n').trim(),
    steps,
    duplicateHeadingIds,
  };
}
